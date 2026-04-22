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
        print(f"[!] LMS Fraud Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic LMS Fraud table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS lms_fraud_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gl_id TEXT,
                fraud_type TEXT,
                severity TEXT,
                description TEXT,
                detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
        print("[*] LMS Fraud table initialized")
    except Exception as e:
        print(f"[!] LMS Fraud Init Error: {str(e)}")

init_db()

@app.route('/fraud', methods=['POST', 'OPTIONS'])
def get_fraud_logs():
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
        # Fetch fraud logs for the given GL ID
        query = "SELECT * FROM lms_fraud_logs WHERE gl_id = ? ORDER BY detected_at DESC LIMIT 50"
        cur.execute(query, (gl_id,))
        rows = cur.fetchall()
        logs = [dict(row) for row in rows]
        conn.close()
        
        return jsonify(logs)
    except Exception as e:
        print(f"[!] LMS Fraud Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- LMS FRAUD DETECTION BRIDGE SQLITE ACTIVE (PORT 5006) ---")
    app.run(host='0.0.0.0', port=5006)
