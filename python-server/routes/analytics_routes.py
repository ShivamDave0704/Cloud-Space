"""
Analytics and metrics routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta

from middleware.auth import require_auth
from database.models import User, File, Analytics
from services.analytics_service import AnalyticsService

bp = Blueprint('analytics', __name__)
analytics_service = AnalyticsService()


@bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard():
    """Get user dashboard statistics"""
    user = request.current_user
    
    # Get storage stats
    storage_used = user.get('storage_used', 0)
    storage_limit = user.get('storage_limit', 5368709120)
    
    # Get file stats
    total_files = File.count_by_user(user['id'])
    recent_files = File.find_by_user(user['id'], page=1, per_page=5)
    
    # Get activity stats
    days = request.args.get('days', 7, type=int)
    activity = analytics_service.get_user_activity(user['id'], days)
    
    return jsonify({
        'storage': {
            'used': storage_used,
            'limit': storage_limit,
            'percentage': (storage_used / storage_limit * 100) if storage_limit > 0 else 0
        },
        'files': {
            'total': total_files,
            'recent': [{
                'id': str(f['id']),
                'filename': f['filename'],
                'size': f['size'],
                'uploaded_at': f['uploaded_at'].isoformat()
            } for f in recent_files]
        },
        'activity': activity
    }), 200


@bp.route('/usage', methods=['GET'])
@require_auth
def get_usage_stats():
    """Get detailed usage statistics"""
    user = request.current_user
    period = request.args.get('period', 'month')  # day, week, month, year
    
    stats = analytics_service.get_usage_stats(user['id'], period)
    
    return jsonify({
        'period': period,
        'statistics': stats
    }), 200


@bp.route('/file-types', methods=['GET'])
@require_auth
def get_file_type_distribution():
    """Get distribution of file types"""
    user = request.current_user
    
    distribution = File.get_file_type_distribution(user['id'])
    
    return jsonify({
        'distribution': distribution
    }), 200


@bp.route('/upload-history', methods=['GET'])
@require_auth
def get_upload_history():
    """Get upload history over time"""
    user = request.current_user
    days = request.args.get('days', 30, type=int)
    
    history = analytics_service.get_upload_history(user['id'], days)
    
    return jsonify({
        'history': history,
        'period_days': days
    }), 200


@bp.route('/top-files', methods=['GET'])
@require_auth
def get_top_files():
    """Get largest files"""
    user = request.current_user
    limit = request.args.get('limit', 10, type=int)
    
    top_files = File.get_largest_files(user['id'], limit)
    
    return jsonify({
        'files': [{
            'id': str(f['id']),
            'filename': f['filename'],
            'size': f['size'],
            'mime_type': f['mime_type'],
            'uploaded_at': f['uploaded_at'].isoformat()
        } for f in top_files]
    }), 200


@bp.route('/track', methods=['POST'])
@require_auth
def track_event():
    """Track custom analytics event"""
    user = request.current_user
    data = request.get_json()
    
    event_type = data.get('event_type')
    event_data = data.get('data', {})
    
    if not event_type:
        return jsonify({'error': 'event_type is required'}), 400
    
    Analytics.create_event({
        'user_id': user['id'],
        'event_type': event_type,
        'event_data': event_data,
        'timestamp': datetime.utcnow()
    })
    
    return jsonify({
        'message': 'Event tracked successfully'
    }), 201
