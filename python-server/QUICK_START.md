# Cloud Storage Application - Python Server

## Quick Start

```powershell
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your configuration

# Initialize database
python -c "from database.db_manager import init_database; init_database()"

# Run the server
python app.py
```

## Docker Setup

```powershell
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Features

✅ RESTful API with Flask
✅ JWT Authentication
✅ File Upload/Download
✅ Cloud Storage (AWS S3)
✅ Analytics & Metrics
✅ Background Tasks (Celery)
✅ Multi-Database Support (PostgreSQL, MongoDB, Redis)
✅ Docker Support
✅ Unit Tests
✅ API Documentation

## API Endpoints

### Auth
- POST `/api/auth/register` - Register
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user

### Files
- POST `/api/files/upload` - Upload file
- GET `/api/files/list` - List files
- DELETE `/api/files/<id>` - Delete file

### Analytics
- GET `/api/analytics/dashboard` - Dashboard stats
- GET `/api/analytics/usage` - Usage stats

## Tech Stack

- Flask 3.0
- PostgreSQL
- MongoDB
- Redis
- Celery
- AWS S3
- Docker
