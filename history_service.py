import mysql.connector
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# MySQL Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'connectw_proxylysis',
    'password': 'RQSzQeUB5jD44Tcy3bez',
    'database': 'connectw_proxylysis'
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to MySQL: {e}")
        return None

@app.route('/init_db', methods=['GET'])
def init_db():
    """Initialize the database and tables."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Could not connect to database"}), 500
    
    try:
        cursor = conn.cursor()
        
        # Create sessions table with MySQL compatible types
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_sessions (
                id VARCHAR(255) PRIMARY KEY,
                gl_id VARCHAR(50) NOT NULL,
                product_name VARCHAR(255),
                parameters LONGTEXT,
                csl_data LONGTEXT,
                match_data LONGTEXT,
                mcat_data LONGTEXT,
                analysis_results LONGTEXT,
                scan_results LONGTEXT,
                company_overviews LONGTEXT,
                additional_comments LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        return jsonify({"message": "Database (MySQL) initialized successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/save_session', methods=['POST', 'OPTIONS'])
def save_session():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    """Save a complete analysis session snapshot."""
    data = request.json or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor()
        
        # Generate custom ID: glid-current date
        current_date = datetime.now().strftime("%Y-%m-%d")
        gl_id = data.get('gl_id', 'unknown')
        custom_id = f"{gl_id}-{current_date}"
        
        # MySQL replacement syntax
        query = """
            REPLACE INTO analysis_sessions 
            (id, gl_id, product_name, parameters, csl_data, match_data, mcat_data, analysis_results, scan_results, company_overviews, additional_comments)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # Convert dicts to JSON strings for storage
        params = json.dumps(data.get('parameters', {}))
        csl = json.dumps(data.get('csl_data', {}))
        match = json.dumps(data.get('match_data', {}))
        mcat = json.dumps(data.get('mcat_data', []))
        analysis = json.dumps(data.get('analysis_results', []))
        scan = json.dumps(data.get('scan_results', {}))
        overviews = json.dumps(data.get('company_overviews', {}))
        comments = data.get('additional_comments', '')
        
        cursor.execute(query, (
            custom_id,
            gl_id,
            data.get('product_name'),
            params,
            csl,
            match,
            mcat,
            analysis,
            scan,
            overviews,
            comments
        ))
        conn.commit()
        return jsonify({"message": "Session saved successfully", "id": custom_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/list_sessions', methods=['GET'])
def list_sessions():
    """List all saved sessions (metadata only)."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        # Use dictionary cursor for easier mapping
        cursor = conn.cursor(dictionary=True)
        # Cast created_at to string for JSON compatibility
        cursor.execute("SELECT id, gl_id, product_name, CAST(created_at AS CHAR) as created_at FROM analysis_sessions ORDER BY created_at DESC")
        sessions = cursor.fetchall()
        return jsonify(sessions), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/get_session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Retrieve a full session snapshot by ID."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        # Explicitly list columns and cast created_at to CHAR for JSON compatibility
        query = """
            SELECT id, gl_id, product_name, parameters, csl_data, match_data, mcat_data, 
                   analysis_results, scan_results, company_overviews, additional_comments, 
                   CAST(created_at AS CHAR) as created_at 
            FROM analysis_sessions WHERE id = %s
        """
        cursor.execute(query, (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return jsonify({"error": "Session not found"}), 404
            
        # Parse JSON strings back to dicts
        session['parameters'] = json.loads(session.get('parameters', '{}'))
        session['csl_data'] = json.loads(session.get('csl_data', '{}'))
        session['match_data'] = json.loads(session.get('match_data', '{}'))
        session['mcat_data'] = json.loads(session.get('mcat_data', '[]'))
        session['analysis_results'] = json.loads(session.get('analysis_results', '[]'))
        session['scan_results'] = json.loads(session.get('scan_results', '{}'))
        session['company_overviews'] = json.loads(session.get('company_overviews', '{}'))
        
        return jsonify(session), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/delete_session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session by ID."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM analysis_sessions WHERE id = %s", (session_id,))
        conn.commit()
        return jsonify({"message": "Session deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Initialize database tables on start
    print("Initializing MySQL database...")
    with app.app_context():
        init_db()
            
    print("--- PROXYLYSIS HISTORY SERVICE ACTIVE (PORT 5009) | DB: MYSQL ---")
    app.run(host='0.0.0.0', port=5009)
