"""
File management routes for upload, download, and storage operations
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from datetime import datetime

from config import Config
from middleware.auth import require_auth
from database.models import File
from utils.file_handler import save_file, delete_file, get_file_path
from utils.validators import allowed_file
from services.storage_service import StorageService

bp = Blueprint('files', __name__)
storage_service = StorageService()


@bp.route('/upload', methods=['POST'])
@require_auth
def upload_file():
    """Upload a file to cloud storage"""
    user = request.current_user
    
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Check storage quota
    file_size = len(file.read())
    file.seek(0)  # Reset file pointer
    
    if user['storage_used'] + file_size > user.get('storage_limit', 5368709120):
        return jsonify({'error': 'Storage quota exceeded'}), 413
    
    # Save file
    filename = secure_filename(file.filename)
    file_data = save_file(file, user['id'], filename)
    
    # Upload to cloud storage
    cloud_url = storage_service.upload(file_data['path'], user['id'], filename)
    
    # Save file metadata to database
    file_record = File.create({
        'user_id': user['id'],
        'filename': filename,
        'original_name': file.filename,
        'size': file_size,
        'mime_type': file.content_type,
        'path': file_data['path'],
        'cloud_url': cloud_url,
        'uploaded_at': datetime.utcnow()
    })
    
    # Update user storage usage
    from database.models import User
    User.update_storage(user['id'], file_size, increment=True)
    
    return jsonify({
        'message': 'File uploaded successfully',
        'file': {
            'id': str(file_record['id']),
            'filename': filename,
            'size': file_size,
            'url': cloud_url,
            'uploaded_at': file_record['uploaded_at'].isoformat()
        }
    }), 201


@bp.route('/list', methods=['GET'])
@require_auth
def list_files():
    """List all files for current user"""
    user = request.current_user
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    files = File.find_by_user(user['id'], page=page, per_page=per_page)
    total = File.count_by_user(user['id'])
    
    return jsonify({
        'files': [{
            'id': str(f['id']),
            'filename': f['filename'],
            'size': f['size'],
            'mime_type': f['mime_type'],
            'url': f['cloud_url'],
            'uploaded_at': f['uploaded_at'].isoformat()
        } for f in files],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': (total + per_page - 1) // per_page
        }
    }), 200


@bp.route('/<file_id>', methods=['GET'])
@require_auth
def get_file(file_id):
    """Get file details"""
    user = request.current_user
    file = File.find_by_id(file_id)
    
    if not file or file['user_id'] != user['id']:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({
        'file': {
            'id': str(file['id']),
            'filename': file['filename'],
            'original_name': file['original_name'],
            'size': file['size'],
            'mime_type': file['mime_type'],
            'url': file['cloud_url'],
            'uploaded_at': file['uploaded_at'].isoformat()
        }
    }), 200


@bp.route('/<file_id>', methods=['DELETE'])
@require_auth
def delete_file_route(file_id):
    """Delete a file"""
    user = request.current_user
    file = File.find_by_id(file_id)
    
    if not file or file['user_id'] != user['id']:
        return jsonify({'error': 'File not found'}), 404
    
    # Delete from cloud storage
    storage_service.delete(file['cloud_url'])
    
    # Delete local file
    delete_file(file['path'])
    
    # Delete database record
    File.delete(file_id)
    
    # Update user storage usage
    from database.models import User
    User.update_storage(user['id'], file['size'], increment=False)
    
    return jsonify({
        'message': 'File deleted successfully'
    }), 200


@bp.route('/<file_id>/share', methods=['POST'])
@require_auth
def share_file(file_id):
    """Generate shareable link for file"""
    user = request.current_user
    file = File.find_by_id(file_id)
    
    if not file or file['user_id'] != user['id']:
        return jsonify({'error': 'File not found'}), 404
    
    # Generate presigned URL
    expiry = request.json.get('expiry', 3600)  # 1 hour default
    share_url = storage_service.generate_presigned_url(file['cloud_url'], expiry)
    
    # Save share record
    File.create_share_link(file_id, share_url, expiry)
    
    return jsonify({
        'share_url': share_url,
        'expires_in': expiry
    }), 200
