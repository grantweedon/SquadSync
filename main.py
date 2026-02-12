import os
import logging
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.')
CORS(app) # Enable CORS for all routes

# Initialize Firestore safely
db = None
COLLECTION = "squad_availability"

try:
    from google.cloud import firestore
    try:
        # The Firestore client will automatically use Application Default Credentials
        # when running on Google Cloud Run.
        db = firestore.Client()
        logger.info("Firestore client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Firestore client: {e}")
        db = None
except ImportError:
    logger.warning("google-cloud-firestore library not found. Running in no-db mode.")
    db = None

@app.after_request
def add_header(response):
    """Disable caching for all API routes to ensure real-time sync."""
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

# --- API ROUTES ---

@app.route('/health')
def health_check():
    return jsonify({
        "status": "healthy", 
        "database_connected": db is not None,
        "environment": os.environ.get('K_SERVICE', 'local')
    }), 200

@app.route('/env.js')
def env_js():
    """
    Dynamically serve environment variables to the frontend.
    This allows the browser to access the API_KEY set in Cloud Run.
    """
    api_key = os.environ.get('API_KEY', '')
    js_content = f'window.process = {{ env: {{ API_KEY: "{api_key}" }} }};'
    return js_content, 200, {'Content-Type': 'application/javascript'}

@app.route('/api/weekends', methods=['GET'])
def get_weekends():
    if not db:
        logger.error("Database not initialized during GET request")
        return jsonify({"error": "Database not initialized"}), 503
    try:
        docs = db.collection(COLLECTION).order_by("id").stream()
        weekends = []
        for doc in docs:
            data = doc.to_dict()
            # Ensure the ID from the document is used if missing in data
            if 'id' not in data:
                data['id'] = doc.id
            weekends.append(data)
        return jsonify(weekends)
    except Exception as e:
        logger.error(f"Error fetching weekends: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/weekends', methods=['POST'])
def update_weekend():
    if not db:
        return jsonify({"error": "Database not initialized"}), 503
    try:
        data = request.json
        weekend_id = data.get('id')
        if not weekend_id:
            return jsonify({"error": "ID required"}), 400
        
        # We use set with merge=True to ensure we update specific fields without wiping others
        db.collection(COLLECTION).document(weekend_id).set(data, merge=True)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error updating weekend {request.json.get('id', 'unknown')}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/initialize', methods=['POST'])
def initialize_data():
    if not db:
        return jsonify({"error": "Database not initialized"}), 503
    try:
        data_list = request.json
        # Check if collection is already populated
        existing = db.collection(COLLECTION).limit(1).get()
        if len(existing) == 0:
            logger.info("Initializing Firestore with default weekend data...")
            batch = db.batch()
            for item in data_list:
                doc_ref = db.collection(COLLECTION).document(item['id'])
                batch.set(doc_ref, item)
            batch.commit()
            return jsonify({"success": True, "message": "Database initialized with 20 weekends."})
        return jsonify({"success": True, "message": "Database already contains data."})
    except Exception as e:
        logger.error(f"Initialization error: {e}")
        return jsonify({"error": str(e)}), 500

# --- STATIC FILE ROUTES ---

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    # Ensure API calls never hit the static file handler
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404

    # Path resolution for ES modules in the browser
    file_path = path
    if not os.path.exists(file_path):
        if os.path.exists(path + '.tsx'):
            file_path = path + '.tsx'
        elif os.path.exists(path + '.ts'):
            file_path = path + '.ts'

    # Serve TSX/TS files with javascript mime type so browsers execute them (requires importmap support)
    if file_path.endswith('.tsx') or file_path.endswith('.ts'):
        return send_from_directory('.', file_path, mimetype='text/javascript')
    
    return send_from_directory('.', file_path)

if __name__ == "__main__":
    # Local development server
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)