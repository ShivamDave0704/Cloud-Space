"""
Authentication middleware
"""
from functools import wraps
from flask import request, jsonify
import jwt

from config import Config
from database.models import User


def require_auth(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get token from header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401
        
        try:
            # Extract token (format: "Bearer <token>")
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != 'bearer':
                return jsonify({'error': 'Invalid authorization header format'}), 401
            
            token = parts[1]
            
            # Decode and verify token
            payload = jwt.decode(
                token,
                Config.JWT_SECRET_KEY,
                algorithms=[Config.JWT_ALGORITHM]
            )
            
            # Get user from database
            user_id = payload.get('user_id')
            if not user_id:
                return jsonify({'error': 'Invalid token payload'}), 401
            
            user = User.find_by_id(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            # Attach user to request
            request.current_user = user
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            return jsonify({'error': f'Authentication failed: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


def optional_auth(f):
    """Decorator for optional authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() == 'bearer':
                    token = parts[1]
                    payload = jwt.decode(
                        token,
                        Config.JWT_SECRET_KEY,
                        algorithms=[Config.JWT_ALGORITHM]
                    )
                    user_id = payload.get('user_id')
                    user = User.find_by_id(user_id)
                    request.current_user = user
            except:
                pass
        
        if not hasattr(request, 'current_user'):
            request.current_user = None
        
        return f(*args, **kwargs)
    
    return decorated_function
