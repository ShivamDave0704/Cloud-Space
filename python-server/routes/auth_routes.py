"""
Authentication routes for user management
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import jwt

from config import Config
from middleware.auth import require_auth
from database.models import User
from utils.password import hash_password, verify_password
from utils.validators import validate_email, validate_password

bp = Blueprint('auth', __name__)


@bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    # Validate input
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    username = data.get('username', email.split('@')[0])
    
    # Validate email format
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    # Validate password strength
    is_valid, message = validate_password(password)
    if not is_valid:
        return jsonify({'error': message}), 400
    
    # Check if user already exists
    if User.find_by_email(email):
        return jsonify({'error': 'User already exists'}), 409
    
    # Create user
    hashed_password = hash_password(password)
    user = User.create({
        'email': email,
        'username': username,
        'password': hashed_password,
        'created_at': datetime.utcnow()
    })
    
    # Generate JWT token
    token = jwt.encode({
        'user_id': str(user['id']),
        'email': user['email'],
        'exp': datetime.utcnow() + Config.JWT_EXPIRATION
    }, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)
    
    return jsonify({
        'message': 'User registered successfully',
        'token': token,
        'user': {
            'id': str(user['id']),
            'email': user['email'],
            'username': user['username']
        }
    }), 201


@bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    
    # Find user
    user = User.find_by_email(email)
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Verify password
    if not verify_password(password, user['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Update last login
    User.update_last_login(user['id'])
    
    # Generate JWT token
    token = jwt.encode({
        'user_id': str(user['id']),
        'email': user['email'],
        'exp': datetime.utcnow() + Config.JWT_EXPIRATION
    }, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {
            'id': str(user['id']),
            'email': user['email'],
            'username': user['username'],
            'created_at': user['created_at'].isoformat()
        }
    }), 200


@bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current authenticated user"""
    user = request.current_user
    
    return jsonify({
        'user': {
            'id': str(user['id']),
            'email': user['email'],
            'username': user['username'],
            'created_at': user['created_at'].isoformat(),
            'storage_used': user.get('storage_used', 0),
            'storage_limit': user.get('storage_limit', 5368709120)  # 5GB default
        }
    }), 200


@bp.route('/refresh', methods=['POST'])
@require_auth
def refresh_token():
    """Refresh JWT token"""
    user = request.current_user
    
    # Generate new token
    token = jwt.encode({
        'user_id': str(user['id']),
        'email': user['email'],
        'exp': datetime.utcnow() + Config.JWT_EXPIRATION
    }, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)
    
    return jsonify({
        'token': token
    }), 200


@bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Logout user (client-side token removal)"""
    return jsonify({
        'message': 'Logged out successfully'
    }), 200
