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
        print(f"[!] CategoryReport Bridge Connection Error: {str(e)}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        # Basic CategoryReport table structure
        cur.execute("""
            CREATE TABLE IF NOT EXISTS category_report_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gl_id TEXT,
                product_mismatched TEXT,
                mismatch_details TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[*] CategoryReport table initialized")
    except Exception as e:
        print(f"[!] CategoryReport Init Error: {str(e)}")

init_db()

@app.route('/category', methods=['POST', 'OPTIONS'])
def get_category_report():
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
        # Fetch category report data for the given GL ID
        query = "SELECT * FROM category_report_data WHERE gl_id = ? LIMIT 1"
        cur.execute(query, (gl_id,))
        row = cur.fetchone()
        conn.close()
        
        if row:
            return jsonify(dict(row))
        else:
            return jsonify({"gl_id": gl_id, "product_mismatched": "NO", "mismatch_details": "No mismatch found"})
    except Exception as e:
        print(f"[!] CategoryReport Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- CATEGORYREPORT BRIDGE SQLITE ACTIVE (PORT 5003) ---")
    app.run(host='0.0.0.0', port=5003)
