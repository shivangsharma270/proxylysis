import requests
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# Google Sheet Script URL (Set this in your environment variables)
# How to get this: 
# 1. Open your Google Sheet
# 2. Go to Extensions -> Apps Script
# 3. Paste the provided Apps Script code
# 4. Click Deploy -> New Deployment -> Web App
# 5. Execute as: Me, Who has access: Anyone
# 6. Copy the Web App URL and set as GOOGLE_SHEET_API_URL
SHEET_API_URL = os.environ.get('GOOGLE_SHEET_API_URL', '')

def call_sheet_api(method='GET', data=None):
    if not SHEET_API_URL:
        return {"error": "GOOGLE_SHEET_API_URL not configured. Please set it in App Settings."}, 500
    
    try:
        if method == 'GET':
            response = requests.get(SHEET_API_URL)
        else:
            response = requests.post(SHEET_API_URL, json=data)
        
        if response.status_code == 200:
            return response.json(), 200
        else:
            return {"error": f"Sheet API error: {response.text}"}, response.status_code
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/init_db', methods=['GET'])
def init_db():
    """Initialize the Google Sheet with correct headers."""
    # This is handled dynamically by the Apps Script on first POST
    return jsonify({"message": "Google Sheet history bridge active. Headers will be initialized on first save."}), 200

@app.route('/save_session', methods=['POST', 'OPTIONS'])
def save_session():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    
    data = request.json or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Generate custom ID: glid-current date
    current_date = datetime.now().strftime("%Y-%m-%d")
    gl_id = data.get('gl_id', 'unknown')
    custom_id = f"{gl_id}-{current_date}"
    
    # Prepare payload for Apps Script
    payload = {
        "id": custom_id,
        "gl_id": gl_id,
        "product_name": data.get('product_name', ''),
        "parameters": data.get('parameters', {}),
        "csl_data": data.get('csl_data', {}),
        "match_data": data.get('match_data', {}),
        "mcat_data": data.get('mcat_data', []),
        "analysis_results": data.get('analysis_results', []),
        "scan_results": data.get('scan_results', {}),
        "company_overviews": data.get('company_overviews', {}),
        "additional_comments": data.get('additional_comments', ''),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "action": "save" # Custom action for Apps Script
    }
    
    result, status = call_sheet_api('POST', payload)
    return jsonify(result), status

@app.route('/list_sessions', methods=['GET'])
def list_sessions():
    """List all saved sessions from the Google Sheet."""
    sessions, status = call_sheet_api('GET')
    if status != 200:
        return jsonify(sessions), status
    
    # Return metadata only
    metadata = []
    for s in sessions:
        metadata.append({
            "id": s.get('id'),
            "gl_id": s.get('gl_id'),
            "product_name": s.get('product_name'),
            "created_at": s.get('created_at')
        })
    return jsonify(metadata), 200

@app.route('/get_session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Retrieve a full session from the Google Sheet."""
    sessions, status = call_sheet_api('GET')
    if status != 200:
        return jsonify(sessions), status
    
    session = next((s for s in sessions if str(s.get('id')) == str(session_id)), None)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    # Note: Apps Script Doppler bridge handles JSON parsing if set up correctly, 
    # but we ensure it here just in case.
    for key in ['parameters', 'csl_data', 'match_data', 'mcat_data', 'analysis_results', 'scan_results', 'company_overviews']:
        if isinstance(session.get(key), str):
            try:
                session[key] = json.loads(session[key])
            except:
                pass
                
    return jsonify(session), 200

@app.route('/delete_session/<session_id>', methods=['DELETE', 'OPTIONS'])
def delete_session(session_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
        
    payload = {
        "id": session_id,
        "action": "delete"
    }
    result, status = call_sheet_api('POST', payload)
    return jsonify(result), status

if __name__ == '__main__':
    print("--- PROXYLYSIS HISTORY SERVICE ACTIVE (PORT 5009) | STORAGE: GOOGLE SHEETS ---")
    if not SHEET_API_URL:
        print("WARNING: GOOGLE_SHEET_API_URL is NOT set. The service will not be able to save/load history.")
    app.run(host='0.0.0.0', port=5009)
