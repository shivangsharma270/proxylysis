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
        print(f"Error connecting to SQLite: {e}")
        return None

@app.route('/init_db', methods=['GET'])
def init_db():
    """Initialize the database and tables."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Could not connect to database"}), 500
    
    try:
        cursor = conn.cursor()
        
        # Create sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_sessions (
                id TEXT PRIMARY KEY,
                gl_id TEXT NOT NULL,
                product_name TEXT,
                parameters TEXT,
                csl_data TEXT,
                match_data TEXT,
                mcat_data TEXT,
                analysis_results TEXT,
                scan_results TEXT,
                company_overviews TEXT,
                additional_comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        return jsonify({"message": "Database initialized successfully"}), 200
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
        
        # In SQLite, REPLACE INTO works similarly to MySQL
        query = """
            INSERT OR REPLACE INTO analysis_sessions 
            (id, gl_id, product_name, parameters, csl_data, match_data, mcat_data, analysis_results, scan_results, company_overviews, additional_comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        cursor = conn.cursor()
        cursor.execute("SELECT id, gl_id, product_name, created_at FROM analysis_sessions ORDER BY created_at DESC")
        rows = cursor.fetchall()
        sessions = [dict(row) for row in rows]
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
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analysis_sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({"error": "Session not found"}), 404
            
        session = dict(row)
        
        # Parse JSON strings back to dicts
        session['parameters'] = json.loads(session['parameters'])
        session['csl_data'] = json.loads(session['csl_data'])
        session['match_data'] = json.loads(session['match_data'])
        session['mcat_data'] = json.loads(session.get('mcat_data', '[]'))
        session['analysis_results'] = json.loads(session['analysis_results'])
        session['scan_results'] = json.loads(session['scan_results'])
        session['company_overviews'] = json.loads(session['company_overviews'])
        
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
        cursor.execute("DELETE FROM analysis_sessions WHERE id = ?", (session_id,))
        conn.commit()
        return jsonify({"message": "Session deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Auto-initialize database if it doesn't exist
    if not os.path.exists(DB_PATH):
        print("Initializing new SQLite database...")
        with app.app_context():
            init_db()
            
    print("--- PROXYLYSIS HISTORY SERVICE ACTIVE (PORT 5009) ---")
    app.run(host='0.0.0.0', port=5009)
