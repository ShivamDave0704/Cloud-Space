"""
Cloud Storage Application - Python Microservice
Main application entry point
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging
from datetime import datetime

from config import Config
from routes import auth_routes, file_routes, analytics_routes
from middleware.auth import require_auth
from utils.logger import setup_logger
from database.db_manager import DatabaseManager

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Setup CORS
CORS(app, resources={
    r"/api/*": {
        "origins": Config.ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per hour", "50 per minute"]
)

# Setup logging
logger = setup_logger(__name__)

# Initialize database
db_manager = DatabaseManager()

# Register blueprints
app.register_blueprint(auth_routes.bp, url_prefix='/api/auth')
app.register_blueprint(file_routes.bp, url_prefix='/api/files')
app.register_blueprint(analytics_routes.bp, url_prefix='/api/analytics')


@app.before_request
def log_request():
    """Log incoming requests"""
    logger.info(f"{request.method} {request.path} - {get_remote_address()}")


@app.after_request
def after_request(response):
    """Add security headers"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'python-microservice',
        'version': '1.0.0'
    }), 200


@app.route('/api/status', methods=['GET'])
@require_auth
def api_status():
    """API status endpoint (authenticated)"""
    db_status = db_manager.check_connection()
    return jsonify({
        'api': 'operational',
        'database': 'connected' if db_status else 'disconnected',
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad Request', 'message': str(error)}), 400


@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401


@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden', 'message': 'Access denied'}), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found', 'message': 'Resource not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred'}), 500


if __name__ == '__main__':
    logger.info("Starting Cloud Storage Python Microservice...")
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )
