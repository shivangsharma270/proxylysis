from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os
import traceback

app = Flask(__name__)
CORS(app)

# Redshift Configuration
DB_CONFIG = {
    'dbname': 'biredshiftdevelopment',
    'user': 'rd_shivang_113816',
    'password': '0fS8t9FishvZ',
    'host': 'bi-dwh-redshift-development.c98rtyhhgrpm.ap-south-1.redshift.amazonaws.com',
    'port': '5439',
    'sslmode': 'require'  # Added for Redshift security
}

@app.route('/complaints', methods=['POST', 'OPTIONS'])
def get_complaints():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'):
            return jsonify({"status": "online"}), 200

        gl_id = data.get('glId')
        if not gl_id:
            return jsonify({"error": "Missing parameter (glId)"}), 400

        print(f"[*] Querying Redshift for glId={gl_id}")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        query = "SELECT count(customer_ticket_id) FROM im_dwh_rpt.fact_iil_customer_tickets WHERE respondent_glusr_id = %s"
        cur.execute(query, (gl_id,))
        result = cur.fetchone()
        count = result[0] if result else 0
        cur.close()
        conn.close()
        return jsonify({"glId": gl_id, "count": count})
    except Exception as e:
        print(f"[!] Redshift Bridge Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/redshift_overview', methods=['POST', 'OPTIONS'])
def get_redshift_overview():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    print("\n" + "="*50)
    print("--- REDSHIFT OVERVIEW REQUEST RECEIVED ---")
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'):
            return jsonify({"status": "online"}), 200

        gl_id = data.get('glId')
        if not gl_id:
            print("[!] Missing glId in request")
            return jsonify({"error": "Missing parameter (glId)"}), 400

        print(f"[*] Processing glId: {gl_id}")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        results = {
            'ipr_complaints': 0,
            'hrs_history': 0,
            'activation_history': 0,
            'social_media_escalations': 0,
            'nach_bounce': 0,
            'self_service_tickets': 0,
            'bs_tickets_summary': {'lifetime': 0, 'last_12_months': 0, 'wip': 0}
        }

        # 1. IPR Complaints
        try:
            print("[*] Running Query 1: IPR Complaints")
            q1 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 256 AND t1.RESPONDENT_GLUSR_ID = %s
            """
            cur.execute(q1, (gl_id,))
            row = cur.fetchone()
            results['ipr_complaints'] = row[0] if row else 0
            print(f"    -> Result: {results['ipr_complaints']}")
        except Exception as e:
            print(f"    [!] Query 1 Error: {str(e)}")

        # 2. HRS History
        try:
            print("[*] Running Query 2: HRS History")
            q2 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 247 AND t1.COMPLAINANT_GLUSR_ID = %s
            """
            cur.execute(q2, (gl_id,))
            row = cur.fetchone()
            results['hrs_history'] = row[0] if row else 0
            print(f"    -> Result: {results['hrs_history']}")
        except Exception as e:
            print(f"    [!] Query 2 Error: {str(e)}")

        # 3. Activation History
        try:
            print("[*] Running Query 3: Activation History")
            q3 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 245 AND t1.COMPLAINANT_GLUSR_ID = %s
            """
            cur.execute(q3, (gl_id,))
            row = cur.fetchone()
            results['activation_history'] = row[0] if row else 0
            print(f"    -> Result: {results['activation_history']}")
        except Exception as e:
            print(f"    [!] Query 3 Error: {str(e)}")

        # 4. Social Media Escalations
        try:
            print("[*] Running Query 4: Social Media Escalations")
            q4 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 247 AND t1.RESPONDENT_GLUSR_ID = %s
            """
            cur.execute(q4, (gl_id,))
            row = cur.fetchone()
            results['social_media_escalations'] = row[0] if row else 0
            print(f"    -> Result: {results['social_media_escalations']}")
        except Exception as e:
            print(f"    [!] Query 4 Error: {str(e)}")

        # 5. NACH Bounce
        try:
            print("[*] Running Query 5: NACH Bounce")
            q5 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 243 AND t1.COMPLAINANT_GLUSR_ID = %s
            """
            cur.execute(q5, (gl_id,))
            row = cur.fetchone()
            results['nach_bounce'] = row[0] if row else 0
            print(f"    -> Result: {results['nach_bounce']}")
        except Exception as e:
            print(f"    [!] Query 5 Error: {str(e)}")

        # 6. Self Service Tickets
        try:
            print("[*] Running Query 6: Self Service Tickets")
            q6 = """
            SELECT COUNT(DISTINCT t1.CUSTOMER_TICKET_ID)
            FROM im_dwh_rpt.fact_iil_customer_tickets t1
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type t2 ON t1.CUSTOMER_TICKET_ID = t2.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t2.FK_TYPE_ID = 162 AND t1.COMPLAINANT_GLUSR_ID = %s
            """
            cur.execute(q6, (gl_id,))
            row = cur.fetchone()
            results['self_service_tickets'] = row[0] if row else 0
            print(f"    -> Result: {results['self_service_tickets']}")
        except Exception as e:
            print(f"    [!] Query 6 Error: {str(e)}")

        # 7. BS Tickets Summary
        try:
            print("[*] Running Query 7: BS Tickets Summary")
            # Removed GROUP BY to ensure we get a row even if no tickets exist
            q7 = """
            SELECT 
                SUM(CASE WHEN tt.fk_type_id = 181 THEN 1 ELSE 0 END) AS lifetime,
                SUM(CASE WHEN tt.fk_type_id = 181 AND t.customer_ticket_issuedate >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN 1 ELSE 0 END) AS last_12,
                SUM(CASE WHEN tt.fk_type_id = 181 AND tt.TICKET_TYPE_STATUS = 'W' THEN 1 ELSE 0 END) AS wip
            FROM im_dwh_rpt.fact_iil_customer_tickets t
            JOIN im_dwh_rpt.fact_iil_customer_tickets_type tt ON t.CUSTOMER_TICKET_ID = tt.FK_IIL_CUSTOMER_TICKETS_ID
            WHERE t.respondent_glusr_id = %s
            """
            cur.execute(q7, (gl_id,))
            bs_row = cur.fetchone()
            print(f"    -> Result: {bs_row}")
            if bs_row:
                results['bs_tickets_summary'] = {
                    'lifetime': int(bs_row[0] or 0),
                    'last_12_months': int(bs_row[1] or 0),
                    'wip': int(bs_row[2] or 0)
                }
        except Exception as qe:
            print(f"    [!] Query 7 Error: {str(qe)}")
            results['bs_tickets_summary']['error'] = str(qe)

        cur.close()
        conn.close()
        
        print(f"[*] Final Results for {gl_id}: {results}")
        print("="*50 + "\n")
        return jsonify(results)

    except Exception as e:
        print(f"[!] Global Redshift Overview Error: {str(e)}")
        traceback.print_exc()
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/bs_complaints', methods=['POST', 'OPTIONS'])
def get_bs_complaints():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    conn = None
    try:
        data = request.json or {}
        if data.get('ping'):
            return jsonify({"status": "online"}), 200

        gl_id = data.get('glId')
        if not gl_id:
            return jsonify({"error": "Missing parameter (glId)"}), 400

        print(f"[*] Querying Redshift for Verification Status glId={gl_id}")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Query for both LatLong (2073) and Address (2074) verification
        query = """
        SELECT 
            MAX(CASE WHEN v.FK_GL_ATTRIBUTE_ID = 2073 THEN 'Verified' ELSE 'Not Verified' END) as latlong_status,
            MAX(CASE WHEN v.FK_GL_ATTRIBUTE_ID = 2074 THEN 'Verified' ELSE 'Not Verified' END) as address_status
        FROM 
            im_dwh_rpt.dim_glusr_usr g
        LEFT JOIN 
            im_dwh_rpt.fact_IIL_VERIFICATION_DETAILS v 
            ON g.glusr_usr_id = v.FK_GLUSR_USR_ID AND v.FK_GL_ATTRIBUTE_ID IN (2073, 2074)
        WHERE 
            g.glusr_usr_id = %s
        GROUP BY 
            g.glusr_usr_id
        """
        cur.execute(query, (gl_id,))
        result = cur.fetchone()
        
        latlong_status = "Not Verified"
        address_status = "Not Verified"
        
        if result:
            latlong_status = "LatLong Verified" if result[0] == 'Verified' else "Not Verified"
            address_status = "Address Verified" if result[1] == 'Verified' else "Not Verified"
            
        cur.close()
        conn.close()
        return jsonify({
            "glId": gl_id, 
            "latlong_status": latlong_status,
            "address_status": address_status
        })
    except Exception as e:
        print(f"[!] Redshift Verification Error: {str(e)}")
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- BS COMPLAINTS REDSHIFT BRIDGE ACTIVE (PORT 5004) ---")
    app.run(host='0.0.0.0', port=5004)
