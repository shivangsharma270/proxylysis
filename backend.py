import sqlite3
import json
import os
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import psycopg2

app = Flask(__name__)
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
        # Analysis Sessions
        cur.execute("""CREATE TABLE IF NOT EXISTS analysis_sessions (id TEXT PRIMARY KEY, gl_id TEXT NOT NULL, product_name TEXT, parameters TEXT, csl_data TEXT, match_data TEXT, analysis_results TEXT, scan_results TEXT, company_overviews TEXT, additional_comments TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
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

# --- CSL ROUTES ---
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

# --- MATCHMAKING ROUTES ---
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
        return jsonify(matches)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- PAIDSINCE ROUTES ---
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
            return jsonify(paid_data)
        return jsonify({"gl_id": gl_id, "paid_since": "Not Available", "last_product_match": "N/A", "services_availed": []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- CATEGORY REPORT ROUTES ---
@app.route('/category/report', methods=['POST'])
def get_category_report():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM category_report_data WHERE gl_id = ? LIMIT 1", (gl_id,))
        row = cur.fetchone()
        conn.close()
        if row: return jsonify(dict(row))
        return jsonify({"gl_id": gl_id, "product_mismatched": "NO", "mismatch_details": "No mismatch found"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- SUPPLIER RATING ROUTES ---
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
        if row: return jsonify(dict(row))
        return jsonify({"gl_id": gl_id, "rating": 0, "total_reviews": 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- LMS FRAUD ROUTES ---
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

# --- COMPANY OVERVIEW ROUTES ---
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
            product_names = [p['product_name'] for p in products] if products else ["Industrial Oxygen", "Medical Nitrogen", "Argon Gas"]
            return jsonify({"data": {"glusr_data": glusr_data, "client_contact_numbers": [{"value": "Not Available"}], "product_data": {"approved_products": {"count": len(product_names), "names": product_names}}}})
        conn.close()
        return jsonify({"data": {"glusr_data": {"glusr_usr_id": gl_id, "companyname": "Unknown Company", "contactperson": "N/A", "city": "Unknown", "state": "Unknown", "address": "N/A", "email": "N/A"}, "client_contact_numbers": [{"value": "N/A"}], "product_data": {"approved_products": {"count": 0, "names": []}}}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- TOP BAR SUMMARY ROUTES ---
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

# --- HISTORY ROUTES ---
@app.route('/history/init_db', methods=['GET'])
def history_init():
    init_db()
    return jsonify({"message": "Database initialized successfully"}), 200

@app.route('/history/save_session', methods=['POST'])
def save_session():
    data = request.json
    if not data: return jsonify({"error": "No data provided"}), 400
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        current_date = datetime.now().strftime("%Y-%m-%d")
        gl_id = data.get('gl_id', 'unknown')
        custom_id = f"{gl_id}-{current_date}"
        query = "INSERT OR REPLACE INTO analysis_sessions (id, gl_id, product_name, parameters, csl_data, match_data, analysis_results, scan_results, company_overviews, additional_comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        cur.execute(query, (custom_id, gl_id, data.get('product_name'), json.dumps(data.get('parameters', {})), json.dumps(data.get('csl_data', {})), json.dumps(data.get('match_data', {})), json.dumps(data.get('analysis_results', [])), json.dumps(data.get('scan_results', {})), json.dumps(data.get('company_overviews', {})), data.get('additional_comments', '')))
        conn.commit()
        return jsonify({"message": "Session saved successfully", "id": custom_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()

@app.route('/history/list_sessions', methods=['GET'])
def list_sessions():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, gl_id, product_name, created_at FROM analysis_sessions ORDER BY created_at DESC")
        sessions = [dict(row) for row in cur.fetchall()]
        return jsonify(sessions), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()

@app.route('/history/get_session/<session_id>', methods=['GET'])
def get_session(session_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM analysis_sessions WHERE id = ?", (session_id,))
        row = cur.fetchone()
        if not row: return jsonify({"error": "Session not found"}), 404
        session = dict(row)
        for key in ['parameters', 'csl_data', 'match_data', 'analysis_results', 'scan_results', 'company_overviews']:
            session[key] = json.loads(session[key])
        return jsonify(session), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()

@app.route('/history/delete_session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM analysis_sessions WHERE id = ?", (session_id,))
        conn.commit()
        return jsonify({"message": "Session deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally: conn.close()

# --- REDSHIFT ROUTES ---
@app.route('/redshift/complaints', methods=['POST'])
def get_redshift_complaints():
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = psycopg2.connect(**REDSHIFT_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT count(customer_ticket_id) FROM im_dwh_rpt.fact_iil_customer_tickets WHERE respondent_glusr_id = %s", (gl_id,))
        result = cur.fetchone()
        count = result[0] if result else 0
        conn.close()
        return jsonify({"glId": gl_id, "count": count})
    except Exception as e:
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/redshift/overview', methods=['POST'])
def get_redshift_overview():
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = psycopg2.connect(**REDSHIFT_CONFIG)
        cur = conn.cursor()
        results = {'ipr_complaints': 0, 'hrs_history': 0, 'activation_history': 0, 'social_media_escalations': 0, 'nach_bounce': 0, 'self_service_tickets': 0, 'bs_tickets_summary': {'lifetime': 0, 'last_12_months': 0, 'wip': 0}}
        
        queries = {
            'ipr_complaints': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 256 AND t1.RESPONDENT_GLUSR_ID = %s",
            'hrs_history': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 247 AND t1.COMPLAINANT_GLUSR_ID = %s",
            'activation_history': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 245 AND t1.COMPLAINANT_GLUSR_ID = %s",
            'social_media_escalations': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 247 AND t1.RESPONDENT_GLUSR_ID = %s",
            'nach_bounce': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 243 AND t1.COMPLAINANT_GLUSR_ID = %s",
            'self_service_tickets': "SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID) FROM im_dwh_rpt.fact_iil_customer_tickets t1 JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID WHERE t2.FK_TYPE_ID = 162 AND t1.COMPLAINANT_GLUSR_ID = %s"
        }
        
        for key, q in queries.items():
            try:
                cur.execute(q, (gl_id,))
                row = cur.fetchone()
                results[key] = row[0] if row else 0
            except: pass
            
        try:
            cur.execute("SELECT SUM(CASE WHEN tt.fk_type_id = 181 THEN 1 ELSE 0 END) AS lifetime, SUM(CASE WHEN tt.fk_type_id = 181 AND t.customer_ticket_issuedate >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN 1 ELSE 0 END) AS last_12, SUM(CASE WHEN tt.fk_type_id = 181 AND tt.TICKET_TYPE_STATUS = 'W' THEN 1 ELSE 0 END) AS wip FROM im_dwh_rpt.fact_iil_customer_tickets t JOIN im_dwh_rpt.fact_iil_customer_tickets_type tt ON t.CUSTOMER_TICKET_ID = tt.FK_IIL_CUSTOMER_TICKETS_ID WHERE t.respondent_glusr_id = %s", (gl_id,))
            bs_row = cur.fetchone()
            if bs_row: results['bs_tickets_summary'] = {'lifetime': int(bs_row[0] or 0), 'last_12_months': int(bs_row[1] or 0), 'wip': int(bs_row[2] or 0)}
        except: pass

        conn.close()
        return jsonify(results)
    except Exception as e:
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/redshift/verification', methods=['POST'])
def get_redshift_verification():
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'): return jsonify({"status": "online"}), 200
        gl_id = data.get('glId')
        conn = psycopg2.connect(**REDSHIFT_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT MAX(CASE WHEN v.FK_GL_ATTRIBUTE_ID = 2073 THEN 'Verified' ELSE 'Not Verified' END) as latlong_status, MAX(CASE WHEN v.FK_GL_ATTRIBUTE_ID = 2074 THEN 'Verified' ELSE 'Not Verified' END) as address_status FROM im_dwh_rpt.dim_glusr_usr g LEFT JOIN im_dwh_rpt.fact_IIL_VERIFICATION_DETAILS v ON g.glusr_usr_id = v.FK_GLUSR_USR_ID AND v.FK_GL_ATTRIBUTE_ID IN (2073, 2074) WHERE g.glusr_usr_id = %s GROUP BY g.glusr_usr_id", (gl_id,))
        result = cur.fetchone()
        latlong_status = "Not Verified"
        address_status = "Not Verified"
        if result:
            latlong_status = "LatLong Verified" if result[0] == 'Verified' else "Not Verified"
            address_status = "Address Verified" if result[1] == 'Verified' else "Not Verified"
        conn.close()
        return jsonify({"glId": gl_id, "latlong_status": latlong_status, "address_status": address_status})
    except Exception as e:
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

# --- LOGIN ACCESS ROUTES ---
@app.route('/login/access', methods=['POST'])
def get_login_access():
    try:
        data = request.json
        if data.get('ping'): return jsonify({"status": "online"}), 200
        return jsonify({"glId": data.get('glId'), "status": "Access Granted", "last_login": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- UNIFIED PROXYLYSIS BACKEND ACTIVE (PORT 5000) ---")
    app.run(host='0.0.0.0', port=5000)
