"""
Analytics service for tracking user activity and generating insights
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

from database.models import Analytics, File

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for analytics and metrics"""
    
    def get_user_activity(self, user_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get user activity for the past N days"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get events from database
        events = Analytics.get_user_events(
            user_id=user_id,
            start_date=start_date
        )
        
        # Aggregate by day
        activity_by_day = {}
        for event in events:
            day = event['timestamp'].date().isoformat()
            if day not in activity_by_day:
                activity_by_day[day] = {
                    'date': day,
                    'uploads': 0,
                    'downloads': 0,
                    'deletes': 0,
                    'shares': 0
                }
            
            event_type = event['event_type']
            if event_type == 'file_upload':
                activity_by_day[day]['uploads'] += 1
            elif event_type == 'file_download':
                activity_by_day[day]['downloads'] += 1
            elif event_type == 'file_delete':
                activity_by_day[day]['deletes'] += 1
            elif event_type == 'file_share':
                activity_by_day[day]['shares'] += 1
        
        return list(activity_by_day.values())
    
    def get_usage_stats(self, user_id: str, period: str = 'month') -> Dict[str, Any]:
        """Get detailed usage statistics"""
        # Calculate period
        if period == 'day':
            start_date = datetime.utcnow() - timedelta(days=1)
        elif period == 'week':
            start_date = datetime.utcnow() - timedelta(weeks=1)
        elif period == 'month':
            start_date = datetime.utcnow() - timedelta(days=30)
        elif period == 'year':
            start_date = datetime.utcnow() - timedelta(days=365)
        else:
            start_date = datetime.utcnow() - timedelta(days=30)
        
        events = Analytics.get_user_events(
            user_id=user_id,
            start_date=start_date
        )
        
        return {
            'total_events': len(events),
            'uploads': sum(1 for e in events if e['event_type'] == 'file_upload'),
            'downloads': sum(1 for e in events if e['event_type'] == 'file_download'),
            'deletes': sum(1 for e in events if e['event_type'] == 'file_delete'),
            'shares': sum(1 for e in events if e['event_type'] == 'file_share'),
            'period_start': start_date.isoformat(),
            'period_end': datetime.utcnow().isoformat()
        }
    
    def get_upload_history(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get file upload history over time"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        events = Analytics.get_user_events(
            user_id=user_id,
            event_type='file_upload',
            start_date=start_date
        )
        
        # Group by date
        history = {}
        for event in events:
            date = event['timestamp'].date().isoformat()
            if date not in history:
                history[date] = {
                    'date': date,
                    'count': 0,
                    'total_size': 0
                }
            history[date]['count'] += 1
            history[date]['total_size'] += event['event_data'].get('file_size', 0)
        
        return sorted(history.values(), key=lambda x: x['date'])
    
    def track_file_upload(self, user_id: str, file_id: str, file_size: int, filename: str) -> None:
        """Track file upload event"""
        Analytics.create_event({
            'user_id': user_id,
            'event_type': 'file_upload',
            'event_data': {
                'file_id': file_id,
                'file_size': file_size,
                'filename': filename
            },
            'timestamp': datetime.utcnow()
        })
    
    def track_file_download(self, user_id: str, file_id: str) -> None:
        """Track file download event"""
        Analytics.create_event({
            'user_id': user_id,
            'event_type': 'file_download',
            'event_data': {'file_id': file_id},
            'timestamp': datetime.utcnow()
        })
    
    def track_file_delete(self, user_id: str, file_id: str) -> None:
        """Track file deletion event"""
        Analytics.create_event({
            'user_id': user_id,
            'event_type': 'file_delete',
            'event_data': {'file_id': file_id},
            'timestamp': datetime.utcnow()
        })
