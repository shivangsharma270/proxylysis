import sqlite3
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_PATH = 'proxylysis_history.db'

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"[!] CSL Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic CSL logs table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS csl_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                glusr_id TEXT,
                url_weight TEXT,
                datevalue TEXT,
                fk_activity_id TEXT,
                fk_display_title TEXT,
                domain_name TEXT,
                insertion_time TEXT,
                log_status_flag TEXT,
                modid TEXT,
                referer TEXT,
                adminln TEXT,
                cat_id TEXT,
                catalog_owner_glusr_id TEXT,
                coordinate_accuracy TEXT,
                coordinate_latitude TEXT,
                coordinate_longitude TEXT,
                empid TEXT,
                fk_glcat_grp_id TEXT,
                ga_utma_cookie TEXT,
                gl_country TEXT,
                gl_custtype_weight TEXT,
                glb_city TEXT,
                glb_latitude TEXT,
                glb_longitude TEXT,
                glb_state TEXT,
                glusr_usr_listing_status TEXT,
                http_status TEXT,
                imeshvisitor_glusr_email TEXT,
                imeshvisitor_glusr_id TEXT,
                keyword TEXT,
                location_pref_city_ids TEXT,
                location_pref_city_names TEXT,
                mcat_ids TEXT,
                mcat_names TEXT,
                owner_gl_country TEXT,
                owner_gl_custtype_weight TEXT,
                owner_glusr_usr_listing_status TEXT,
                product_disp_id TEXT,
                remote_ip TEXT,
                request_url TEXT,
                response_size TEXT,
                response_time TEXT,
                seller_city_id TEXT,
                server_name TEXT,
                user_agent TEXT,
                v4iilex_glusr_email TEXT,
                v4iilex_glusr_id TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[*] CSL logs table initialized")
    except Exception as e:
        print(f"[!] CSL Init Error: {str(e)}")

init_db()

@app.route('/fetch', methods=['POST', 'OPTIONS'])
def fetch_logs():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    conn = None
    try:
        data = request.json or {}
        
        # Handle ping
        if data.get('ping'):
            return jsonify({"status": "online"}), 200

        gl_id = data.get('glId')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 503
            
        cur = conn.cursor()
        # Fetch logs for the given GL ID
        query = "SELECT * FROM csl_logs WHERE glusr_id = ? ORDER BY datevalue DESC LIMIT 100"
        cur.execute(query, (gl_id,))
        rows = cur.fetchall()
        logs = [dict(row) for row in rows]
        conn.close()
        
        return jsonify(logs)
    except Exception as e:
        print(f"[!] CSL Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- CSL BRIDGE SQLITE ACTIVE (PORT 5000) ---")
    app.run(host='0.0.0.0', port=5000)
