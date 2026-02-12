import os
import logging
from flask import Flask, send_from_directory, jsonify, request
from google.cloud import firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.')

# The Firestore client will automatically use Application Default Credentials
# when running on Google Cloud Run.
try:
    db = firestore.Client()
    COLLECTION = "squad_availability"
    logger.info("Firestore client initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize Firestore: {e}")
    db = None

@app.after_request
def add_header(response):
    """Disable caching for all API routes to ensure sync."""
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

# --- API ROUTES ---

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy", "database": db is not None}), 200

@app.route('/api/weekends', methods=['GET'])
def get_weekends():
    if not db:
        return jsonify({"error": "Database not initialized"}), 503
    try:
        docs = db.collection(COLLECTION).order_by("id").stream()
        weekends = []
        for doc in docs:
            data = doc.to_dict()
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
        
        db.collection(COLLECTION).document(weekend_id).set(data, merge=True)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error updating weekend: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/initialize', methods=['POST'])
def initialize_data():
    if not db:
        return jsonify({"error": "Database not initialized"}), 503
    try:
        data_list = request.json
        existing = db.collection(COLLECTION).limit(1).get()
        if len(existing) == 0:
            batch = db.batch()
            for item in data_list:
                doc_ref = db.collection(COLLECTION).document(item['id'])
                batch.set(doc_ref, item)
            batch.commit()
            return jsonify({"success": True, "message": "Initialized"})
        return jsonify({"success": True, "message": "Already exists"})
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

    file_path = path
    if not os.path.exists(file_path):
        if os.path.exists(path + '.tsx'):
            file_path = path + '.tsx'
        elif os.path.exists(path + '.ts'):
            file_path = path + '.ts'

    if file_path.endswith('.tsx') or file_path.endswith('.ts'):
        return send_from_directory('.', file_path, mimetype='text/javascript')
    
    return send_from_directory('.', file_path)

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
