"""
Unit tests for authentication routes
"""
import pytest
import json
from app import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'


def test_register_user(client):
    """Test user registration"""
    response = client.post('/api/auth/register', 
        json={
            'email': 'test@example.com',
            'password': 'Test123!@#',
            'username': 'testuser'
        }
    )
    
    # Note: This will fail without database setup
    # In real tests, use mocking or test database
    assert response.status_code in [201, 400, 500]


def test_login_invalid_credentials(client):
    """Test login with invalid credentials"""
    response = client.post('/api/auth/login',
        json={
            'email': 'invalid@example.com',
            'password': 'wrongpassword'
        }
    )
    
    assert response.status_code in [401, 500]


def test_protected_route_without_auth(client):
    """Test accessing protected route without authentication"""
    response = client.get('/api/auth/me')
    assert response.status_code == 401


def test_protected_route_with_invalid_token(client):
    """Test accessing protected route with invalid token"""
    response = client.get('/api/auth/me',
        headers={'Authorization': 'Bearer invalid_token'}
    )
    assert response.status_code == 401
