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
        print(f"[!] PaidSince Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic PaidSince table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS paid_since_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gl_id TEXT,
                paid_since TEXT,
                last_product_match TEXT,
                services_availed TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[*] PaidSince table initialized")
    except Exception as e:
        print(f"[!] PaidSince Init Error: {str(e)}")

init_db()

@app.route('/services', methods=['POST', 'OPTIONS'])
def get_paid_since():
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
        # Fetch paid since data for the given GL ID
        query = "SELECT * FROM paid_since_data WHERE gl_id = ? LIMIT 1"
        cur.execute(query, (gl_id,))
        row = cur.fetchone()
        conn.close()
        
        if row:
            paid_data = dict(row)
            # Convert services_availed from text to list if it's a JSON string
            if paid_data['services_availed']:
                try:
                    paid_data['services_availed'] = json.loads(paid_data['services_availed'])
                except:
                    paid_data['services_availed'] = [paid_data['services_availed']]
            return jsonify(paid_data)
        else:
            return jsonify({"gl_id": gl_id, "paid_since": "Not Available", "last_product_match": "N/A", "services_availed": []})
    except Exception as e:
        print(f"[!] PaidSince Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- PAIDSINCE BRIDGE SQLITE ACTIVE (PORT 5002) ---")
    app.run(host='0.0.0.0', port=5002)
