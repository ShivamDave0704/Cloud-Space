"""
Unit tests for file operations
"""
import pytest
import io
from app import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_upload_without_auth(client):
    """Test file upload without authentication"""
    data = {
        'file': (io.BytesIO(b'test content'), 'test.txt')
    }
    
    response = client.post('/api/files/upload', 
        data=data,
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 401


def test_list_files_without_auth(client):
    """Test listing files without authentication"""
    response = client.get('/api/files/list')
    assert response.status_code == 401


def test_delete_file_without_auth(client):
    """Test deleting file without authentication"""
    response = client.delete('/api/files/test-file-id')
    assert response.status_code == 401
