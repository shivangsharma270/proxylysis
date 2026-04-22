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
        print(f"[!] Matchmaking Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic Matchmaking table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS matchmaking_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gl_id TEXT,
                matchmaking_type TEXT,
                contacts_name TEXT,
                contacts_company TEXT,
                contacts_mobile1 TEXT,
                contact_last_product TEXT,
                last_product_qty TEXT,
                last_message TEXT,
                unread_message_cnt TEXT,
                contacts_add_date TEXT,
                last_contact_date TEXT,
                last_contact_date_view TEXT,
                latest_txn_date TEXT,
                latest_txn_date_view TEXT,
                contact_state TEXT,
                country_name TEXT,
                contact_ph_country TEXT,
                contact_number_type TEXT,
                is_txn_initiator TEXT,
                latest_txn_initiator TEXT,
                is_call TEXT,
                mcat_id TEXT,
                mcat_name TEXT,
                contacts_glid TEXT,
                im_contact_id TEXT,
                uniqueId TEXT,
                fk_glusr_usr_id TEXT,
                contacts_type TEXT,
                starred_lead_color TEXT,
                contact_type_remarks TEXT,
                glusr_usr_logo_img TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[*] Matchmaking table initialized")
    except Exception as e:
        print(f"[!] Matchmaking Init Error: {str(e)}")

init_db()

@app.route('/search', methods=['POST', 'OPTIONS'])
def fetch_matchmaking():
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
        # Fetch matchmaking data for the given GL ID
        query = "SELECT * FROM matchmaking_data WHERE gl_id = ? ORDER BY contacts_add_date DESC LIMIT 100"
        cur.execute(query, (gl_id,))
        rows = cur.fetchall()
        matches = [dict(row) for row in rows]
        conn.close()
        
        return jsonify(matches)
    except Exception as e:
        print(f"[!] Matchmaking Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- MATCHMAKING BRIDGE SQLITE ACTIVE (PORT 5001) ---")
    app.run(host='0.0.0.0', port=5001)
