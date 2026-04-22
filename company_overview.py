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
        print(f"[!] CompanyOverview Bridge Connection Error: {str(e)}")
        return None

@app.route('/overview', methods=['POST', 'OPTIONS'])
def get_overview():
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
        # Fetch company overview data from dim_glusr_usr (initialized in bscomplaints.py)
        query = "SELECT * FROM dim_glusr_usr WHERE glusr_usr_id = ? LIMIT 1"
        cur.execute(query, (gl_id,))
        row = cur.fetchone()
        
        if row:
            glusr_data = dict(row)
            # Fetch approved products for this GL ID
            cur.execute("SELECT product_name FROM approved_products WHERE gl_id = ?", (gl_id,))
            products = cur.fetchall()
            conn.close()
            
            product_names = [p['product_name'] for p in products] if products else ["Industrial Oxygen", "Medical Nitrogen", "Argon Gas"]
            
            return jsonify({
                "data": {
                    "glusr_data": glusr_data,
                    "client_contact_numbers": [{"value": "Not Available"}],
                    "product_data": {
                        "approved_products": {
                            "count": len(product_names),
                            "names": product_names
                        }
                    }
                }
            })
        else:
            conn.close()
            return jsonify({
                "data": {
                    "glusr_data": {
                        "glusr_usr_id": gl_id,
                        "companyname": "Unknown Company",
                        "contactperson": "N/A",
                        "city": "Unknown",
                        "state": "Unknown",
                        "address": "N/A",
                        "email": "N/A"
                    },
                    "client_contact_numbers": [{"value": "N/A"}],
                    "product_data": {
                        "approved_products": {
                            "count": 0,
                            "names": []
                        }
                    }
                }
            })
    except Exception as e:
        print(f"[!] CompanyOverview Fetch Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- COMPANY OVERVIEW BRIDGE SQLITE ACTIVE (PORT 5007) ---")
    app.run(host='0.0.0.0', port=5007)
