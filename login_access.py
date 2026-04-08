import sqlite3
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_PATH = 'proxylysis_history.db'

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"[!] LoginAccess Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic LoginAccess table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS login_access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gl_id TEXT,
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                device_info TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[*] LoginAccess table initialized")
    except Exception as e:
        print(f"[!] LoginAccess Init Error: {str(e)}")

init_db()

@app.route('/login_logs', methods=['POST'])
def get_login_logs():
    conn = None
    try:
        data = request.json
        gl_id = data.get('glId')
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 503
            
        cur = conn.cursor()
        # Fetch login logs for the given GL ID
        query = "SELECT * FROM login_access_logs WHERE gl_id = ? ORDER BY login_time DESC LIMIT 50"
        cur.execute(query, (gl_id,))
        rows = cur.fetchall()
        logs = [dict(row) for row in rows]
        conn.close()
        
        return jsonify(logs)
    except Exception as e:
        print(f"[!] LoginAccess Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- LOGIN ACCESS BRIDGE SQLITE ACTIVE (PORT 5010) ---")
    app.run(host='0.0.0.0', port=5010)
