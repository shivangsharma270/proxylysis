import sqlite3
import json
import os
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import psycopg2
import gemini_service

app = Flask(__name__, static_folder='dist')
CORS(app)

DB_PATH = 'proxylysis_history.db'

# Redshift Configuration
REDSHIFT_CONFIG = {
    'dbname': 'biredshiftdevelopment',
    'user': 'rd_shivang_113816',
    'password': '0fS8t9FishvZ',
    'host': 'bi-dwh-redshift-development.c98rtyhhgrpm.ap-south-1.redshift.amazonaws.com',
    'port': '5439',
    'sslmode': 'require'
}

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Error connecting to SQLite: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn: return
    try:
        cur = conn.cursor()
        # CSL Logs
        cur.execute("""CREATE TABLE IF NOT EXISTS csl_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, glusr_id TEXT, url_weight TEXT, datevalue TEXT, fk_activity_id TEXT, fk_display_title TEXT, domain_name TEXT, insertion_time TEXT, log_status_flag TEXT, modid TEXT, referer TEXT, adminln TEXT, cat_id TEXT, catalog_owner_glusr_id TEXT, coordinate_accuracy TEXT, coordinate_latitude TEXT, coordinate_longitude TEXT, empid TEXT, fk_glcat_grp_id TEXT, ga_utma_cookie TEXT, gl_country TEXT, gl_custtype_weight TEXT, glb_city TEXT, glb_latitude TEXT, glb_longitude TEXT, glb_state TEXT, glusr_usr_listing_status TEXT, http_status TEXT, imeshvisitor_glusr_email TEXT, imeshvisitor_glusr_id TEXT, keyword TEXT, location_pref_city_ids TEXT, location_pref_city_names TEXT, mcat_ids TEXT, mcat_names TEXT, owner_gl_country TEXT, owner_gl_custtype_weight TEXT, owner_glusr_usr_listing_status TEXT, product_disp_id TEXT, remote_ip TEXT, request_url TEXT, response_size TEXT, response_time TEXT, seller_city_id TEXT, server_name TEXT, user_agent TEXT, v4iilex_glusr_email TEXT, v4iilex_glusr_id TEXT)""")
        # Matchmaking
        cur.execute("""CREATE TABLE IF NOT EXISTS matchmaking_data (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, matchmaking_type TEXT, contacts_name TEXT, contacts_company TEXT, contacts_mobile1 TEXT, contact_last_product TEXT, last_product_qty TEXT, last_message TEXT, unread_message_cnt TEXT, contacts_add_date TEXT, last_contact_date TEXT, last_contact_date_view TEXT, latest_txn_date TEXT, latest_txn_date_view TEXT, contact_state TEXT, country_name TEXT, contact_ph_country TEXT, contact_number_type TEXT, is_txn_initiator TEXT, latest_txn_initiator TEXT, is_call TEXT, mcat_id TEXT, mcat_name TEXT, contacts_glid TEXT, im_contact_id TEXT, uniqueId TEXT, fk_glusr_usr_id TEXT, contacts_type TEXT, starred_lead_color TEXT, contact_type_remarks TEXT, glusr_usr_logo_img TEXT)""")
        # PaidSince
        cur.execute("""CREATE TABLE IF NOT EXISTS paid_since_data (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, paid_since TEXT, last_product_match TEXT, services_availed TEXT)""")
        # Category Report
        cur.execute("""CREATE TABLE IF NOT EXISTS category_report_data (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, product_mismatched TEXT, mismatch_details TEXT)""")
        # Supplier Rating
        cur.execute("""CREATE TABLE IF NOT EXISTS supplier_rating_data (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, rating REAL, total_reviews INTEGER)""")
        # LMS Fraud
        cur.execute("""CREATE TABLE IF NOT EXISTS lms_fraud_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, fraud_type TEXT, severity TEXT, description TEXT, detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        # Top Bar Summary
        cur.execute("""CREATE TABLE IF NOT EXISTS top_bar_summary_data (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, bl_lm INTEGER DEFAULT 0, qry_reply_lm INTEGER DEFAULT 0, total_leads INTEGER DEFAULT 0, active_products INTEGER DEFAULT 0)""")
        # Dim Glusr Usr
        cur.execute("""CREATE TABLE IF NOT EXISTS dim_glusr_usr (glusr_usr_id TEXT PRIMARY KEY, companyname TEXT, contactperson TEXT, city TEXT, state TEXT, address TEXT, email TEXT)""")
        # Approved Products
        cur.execute("""CREATE TABLE IF NOT EXISTS approved_products (id INTEGER PRIMARY KEY AUTOINCREMENT, gl_id TEXT, product_name TEXT)""")
        
        conn.commit()
        conn.close()
        print("[*] Unified Database initialized")
    except Exception as e:
        print(f"[!] Init Error: {str(e)}")

init_db()

# --- CSL ROUTES (Port 5000) ---
@app.route('/fetch', methods=['POST'])
@app.route('/csl/fetch', methods=['POST'])
def fetch_csl():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM csl_logs WHERE glusr_id = ? ORDER BY datevalue DESC LIMIT 100", (gl_id,))
        logs = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify(logs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- MATCHMAKING ROUTES (Port 5001) ---
@app.route('/search', methods=['POST'])
@app.route('/match/search', methods=['POST'])
def fetch_matchmaking():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM matchmaking_data WHERE gl_id = ? ORDER BY contacts_add_date DESC LIMIT 100", (gl_id,))
        matches = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify({"response": {"contacts": matches}, "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- PAIDSINCE ROUTES (Port 5002) ---
@app.route('/services', methods=['POST'])
@app.route('/paidsince/services', methods=['POST'])
def get_paid_since():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM paid_since_data WHERE gl_id = ? LIMIT 1", (gl_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            paid_data = dict(row)
            if paid_data['services_availed']:
                try: paid_data['services_availed'] = json.loads(paid_data['services_availed'])
                except: paid_data['services_availed'] = [paid_data['services_availed']]
            return jsonify({"data": {"service_details": [{"SERVICE_NAME": s, "STARTDATE": paid_data['paid_since']} for s in paid_data['services_availed']]}})
        return jsonify({"data": {"service_details": []}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- CATEGORY REPORT ROUTES (Port 5003) ---
@app.route('/category', methods=['POST'])
@app.route('/category/report', methods=['POST'])
def get_category_report():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT product_name FROM approved_products WHERE gl_id = ?", (gl_id,))
        rows = cur.fetchall()
        conn.close()
        items = [{"ITEM_NAME": r['product_name']} for r in rows] if rows else [{"ITEM_NAME": "Unknown Product"}]
        return jsonify({"DATA": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- SUPPLIER RATING ROUTES (Port 5005) ---
@app.route('/rating', methods=['POST'])
@app.route('/rating/get', methods=['POST'])
def get_rating():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM supplier_rating_data WHERE gl_id = ? LIMIT 1", (gl_id,))
        row = cur.fetchone()
        conn.close()
        if row: return jsonify({"avg_rating": row['rating']})
        return jsonify({"avg_rating": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- LMS FRAUD ROUTES (Port 5006) ---
@app.route('/fraud', methods=['POST'])
@app.route('/fraud/logs', methods=['POST'])
def get_fraud_logs():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM lms_fraud_logs WHERE gl_id = ? ORDER BY detected_at DESC LIMIT 50", (gl_id,))
        logs = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify(logs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- COMPANY OVERVIEW ROUTES (Port 5007) ---
@app.route('/overview', methods=['POST'])
@app.route('/overview/get', methods=['POST'])
def get_overview():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM dim_glusr_usr WHERE glusr_usr_id = ? LIMIT 1", (gl_id,))
        row = cur.fetchone()
        if row:
            glusr_data = dict(row)
            cur.execute("SELECT product_name FROM approved_products WHERE gl_id = ?", (gl_id,))
            products = cur.fetchall()
            conn.close()
            product_names = [p['product_name'] for p in products] if products else ["Default Product"]
            return jsonify({"data": {"glusr_data": glusr_data, "client_contact_numbers": [{"value": "Not Available"}], "product_data": {"approved_products": {"count": len(product_names), "names": product_names}}}})
        conn.close()
        return jsonify({"data": {"glusr_data": {"glusr_usr_id": gl_id, "companyname": "Unknown"}, "client_contact_numbers": [{"value": "N/A"}], "product_data": {"approved_products": {"count": 0, "names": []}}}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- TOP BAR SUMMARY ROUTES (Port 5008) ---
@app.route('/summary', methods=['POST'])
@app.route('/summary/get', methods=['POST'])
def get_summary():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM top_bar_summary_data WHERE gl_id = ? LIMIT 1", (gl_id,))
        row = cur.fetchone()
        conn.close()
        if row: return jsonify(dict(row))
        return jsonify({"gl_id": gl_id, "bl_lm": 0, "qry_reply_lm": 0, "total_leads": 0, "active_products": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- MCAT ROUTES (Port 5010) ---
@app.route('/mcat', methods=['POST'])
def get_mcat():
    try:
        data = request.json
        gl_id = data.get('glId')
        return jsonify({"mcat_data": ["Test Category 1", "Test Category 2"]}) # Placeholder
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- GEMINI AI ROUTES ---
@app.route('/ai/analyze_activity', methods=['POST'])
def ai_activity():
    try:
        data = request.json
        result = gemini_service.analyze_activity_data(data.get('logs'), data.get('productName'))
        return text_response(result)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/ai/identify_glids', methods=['POST'])
def ai_glids():
    try:
        data = request.json
        result = gemini_service.identify_involved_glids(data.get('logs'), data.get('matchmaking'), data.get('productName'))
        return jsonify({"involvedGLIDs": result})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/ai/mismatch_check', methods=['POST'])
def ai_mismatch():
    try:
        data = request.json
        result = gemini_service.analyze_product_mismatch(data.get('productName'), data.get('mcatCategories'))
        return jsonify(result)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/ai/scan_docs', methods=['POST'])
def ai_scan():
    try:
        data = request.json
        result = gemini_service.scan_documents_with_gemini(data.get('files'))
        return jsonify(result)
    except Exception as e: return jsonify({"error": str(e)}), 500

def text_response(text):
    try: return jsonify(json.loads(text))
    except: return jsonify({"content": text})

# --- REDSHIFT ROUTES ---
@app.route('/complaints', methods=['POST'])
@app.route('/redshift/complaints', methods=['POST'])
def get_redshift_complaints():
    try:
        conn = psycopg2.connect(**REDSHIFT_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM im_dwh_rpt.fact_iil_customer_tickets WHERE respondent_glusr_id = %s", (request.json.get('glId'),))
        count = cur.fetchone()[0]
        conn.close()
        return jsonify({"count": count})
    except: return jsonify({"count": 0})

@app.route('/redshift_overview', methods=['POST'])
@app.route('/redshift/overview', methods=['POST'])
def get_redshift_overview():
    return jsonify({"ipr_complaints": 0, "bs_tickets_summary": {"lifetime": 0}})

@app.route('/mcat_verification', methods=['POST'])
@app.route('/redshift/verification', methods=['POST'])
def redshift_verification():
    return jsonify({"latlong_status": "Verified", "address_status": "Verified"})

# --- STATIC FILES ---
@app.route('/')
def serve_ui():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Only serve if the file exists in static folder
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # Fallback to index.html for logic
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    print("--- UNIFIED DESKTOP BACKEND ACTIVE (PORT 3000) ---")
    app.run(host='0.0.0.0', port=3000)
