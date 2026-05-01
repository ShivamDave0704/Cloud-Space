"""
Unit tests for analytics endpoints
"""
import pytest
from app import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_dashboard_without_auth(client):
    """Test dashboard access without authentication"""
    response = client.get('/api/analytics/dashboard')
    assert response.status_code == 401


def test_usage_stats_without_auth(client):
    """Test usage stats without authentication"""
    response = client.get('/api/analytics/usage')
    assert response.status_code == 401


def test_track_event_without_auth(client):
    """Test tracking event without authentication"""
    response = client.post('/api/analytics/track',
        json={
            'event_type': 'test_event',
            'data': {}
        }
    )
    assert response.status_code == 401
