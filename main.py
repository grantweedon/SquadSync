
import os
import logging
import json
import datetime
from flask import Flask, send_from_directory, jsonify, request, make_response
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.')
CORS(app)

# --- DATABASE ABSTRACTION ---
db = None
COLLECTION = "squad_availability"
USING_MEMORY_DB = False
memory_db = {} 

try:
    from google.cloud import firestore
    try:
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT')
        if project_id:
            db = firestore.Client(project=project_id)
        else:
            db = firestore.Client()
        logger.info("Firestore client initialized successfully.")
    except Exception as e:
        logger.warning(f"Firestore connection failed: {e}. Switching to In-Memory DB.")
        USING_MEMORY_DB = True
except ImportError:
    logger.warning("google-cloud-firestore not installed. Switching to In-Memory DB.")
    USING_MEMORY_DB = True

@app.after_request
def add_header(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

# --- API ROUTES ---

@app.route('/health')
def health_check():
    return jsonify({
        "status": "healthy",
        "storage_mode": "memory" if USING_MEMORY_DB else "firestore",
        "database_connected": True
    }), 200

@app.route('/env.js')
def env_js():
    api_key = os.environ.get('API_KEY', '')
    # Safely merge into window.process.env
    # We escape quotes just in case
    safe_key = json.dumps(api_key)
    js_content = f"""
    if (!window.process) window.process = {{}};
    if (!window.process.env) window.process.env = {{}};
    window.process.env.API_KEY = {safe_key};
    """
    response = make_response(js_content)
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/api/weekends', methods=['GET'])
def get_weekends():
    try:
        weekends = []
        if USING_MEMORY_DB:
            weekends = sorted(memory_db.values(), key=lambda x: x.get('id', ''))
        else:
            if not db:
                 return jsonify({"error": "DB not ready"}), 503
            docs = db.collection(COLLECTION).order_by("id").stream()
            for doc in docs:
                data = doc.to_dict()
                if 'id' not in data:
                    data['id'] = doc.id
                weekends.append(data)
        return jsonify(weekends)
    except Exception as e:
        logger.error(f"Error fetching weekends: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/weekends', methods=['POST'])
def update_weekend():
    try:
        data = request.json
        weekend_id = data.get('id')
        if not weekend_id:
            return jsonify({"error": "ID required"}), 400
        
        if USING_MEMORY_DB:
            if weekend_id in memory_db:
                memory_db[weekend_id].update(data)
            else:
                memory_db[weekend_id] = data
        else:
            if not db:
                return jsonify({"error": "DB not ready"}), 503
            db.collection(COLLECTION).document(weekend_id).set(data, merge=True)
            
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error updating: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/initialize', methods=['POST'])
def initialize_data():
    try:
        data_list = request.json
        if USING_MEMORY_DB:
            if not memory_db:
                for item in data_list:
                    memory_db[item['id']] = item
            return jsonify({"success": True, "message": "Initialized In-Memory DB"})
        else:
            if not db:
                return jsonify({"error": "DB not ready"}), 503
            existing = db.collection(COLLECTION).limit(1).get()
            if len(existing) == 0:
                batch = db.batch()
                for item in data_list:
                    doc_ref = db.collection(COLLECTION).document(item['id'])
                    batch.set(doc_ref, item)
                batch.commit()
                return jsonify({"success": True, "message": "Initialized Firestore"})
            return jsonify({"success": True, "message": "Firestore already has data"})
    except Exception as e:
        logger.error(f"Init error: {e}")
        return jsonify({"error": str(e)}), 500

# --- STATIC FILE ROUTES ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404

    # Resolve file path
    file_path = path
    
    # Handle .tsx extension auto-resolution if needed
    if not os.path.exists(file_path):
        if os.path.exists(path + '.tsx'):
            file_path = path + '.tsx'
        elif os.path.exists(path + '.ts'):
            file_path = path + '.ts'

    # Security check: ensure file is in current directory
    if '..' in file_path or file_path.startswith('/'):
        return jsonify({"error": "Access denied"}), 403

    # Use send_from_directory safely
    directory = os.path.dirname(file_path) or '.'
    filename = os.path.basename(file_path)
    
    # Check existence before sending to avoid 500s from send_from_directory
    if not os.path.exists(os.path.join(directory, filename)):
         return "File not found", 404

    if file_path.endswith('.tsx') or file_path.endswith('.ts'):
         return send_from_directory(directory, filename, mimetype='text/plain')
    
    return send_from_directory(directory, filename)

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
