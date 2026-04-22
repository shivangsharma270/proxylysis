import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

# Redshift Configuration
DB_CONFIG = {
    'dbname': 'biredshiftdevelopment',
    'user': 'rd_shivang_113816',
    'password': '0fS8t9FishvZ',
    'host': 'bi-dwh-redshift-development.c98rtyhhgrpm.ap-south-1.redshift.amazonaws.com',
    'port': '5439',
    'sslmode': 'require'
}

# Simple in-memory cache
mcat_cache = {}

def get_redshift_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"[!] Redshift Connection Error: {str(e)}")
        return None

@app.route('/mcat', methods=['POST', 'OPTIONS'])
def fetch_mcat():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    data = request.json or {}
    
    # Handle ping
    if data.get('ping'):
        return jsonify({"status": "online"}), 200

    gl_id = data.get('glId')
    
    if not gl_id:
        return jsonify({"error": "glId is required"}), 400
    
    # Check cache first
    if gl_id in mcat_cache:
        print(f"[Cache] Returning MCAT data for GLID: {gl_id}")
        return jsonify({"glId": gl_id, "mcat_data": mcat_cache[gl_id]})

    print(f"[Redshift] Fetching MCAT data for GLID: {gl_id}")
    conn = get_redshift_connection()
    if not conn:
        return jsonify({"error": "Failed to connect to Redshift"}), 503

    try:
        cur = conn.cursor()
        query = """
        SELECT DISTINCT D.glcat_cat_name
        FROM im_dwh_rpt.dim_glcat_grp_to_cat A
        JOIN im_dwh_rpt.dim_glcat_cat_to_mcat B
        ON A.fk_glcat_cat_id = B.fk_glcat_cat_id
        JOIN im_dwh_rpt.fact_pc_item_to_glcat_mcat C
        ON B.fk_glcat_mcat_id = C.fk_glcat_mcat_id
        JOIN im_dwh_rpt.dim_glcat_cat D
        ON A.fk_glcat_cat_id = D.glcat_cat_id
        JOIN im_dwh_rpt.dim_glcat_grp E
        ON E.glcat_grp_id = A.fk_glcat_grp_id
        JOIN im_dwh_rpt.dim_glcat_mcat F
        ON F.glcat_cat_id = A.fk_glcat_cat_id
        WHERE A.isprimegrp = -1
        AND B.isprime = -1
        AND C.item_mapping_isprime = -1
        AND C.fk_glusr_usr_id = %s
        """
        cur.execute(query, (gl_id,))
        rows = cur.fetchall()
        
        mcat_list = [row[0] for row in rows]
        
        # Store in cache
        mcat_cache[gl_id] = mcat_list
        
        cur.close()
        conn.close()
        
        return jsonify({"glId": gl_id, "mcat_data": mcat_list})
    except Exception as e:
        print(f"[!] Redshift Query Error: {str(e)}")
        if conn:
            conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("--- MCAT FETCH BRIDGE ACTIVE (PORT 5010) ---")
    app.run(host='0.0.0.0', port=5010)
