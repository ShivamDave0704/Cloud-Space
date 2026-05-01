# Cloud Storage Application - Python Microservice

A robust Python-based microservice for handling file storage, analytics, and user management.

## Features

- 🔐 **Authentication & Authorization**: JWT-based authentication with secure password hashing
- 📁 **File Management**: Upload, download, delete, and share files
- ☁️ **Cloud Storage**: Integration with AWS S3 for scalable file storage
- 📊 **Analytics**: Track user activity, usage statistics, and file metrics
- 🚀 **High Performance**: Redis caching and async operations
- 🔒 **Security**: Rate limiting, CORS, and security headers
- 📝 **Logging**: Comprehensive logging with rotating file handlers

## Tech Stack

- **Framework**: Flask 3.0
- **Databases**: PostgreSQL, MongoDB, Redis
- **Cloud Storage**: AWS S3
- **Task Queue**: Celery
- **Authentication**: JWT (PyJWT)
- **Password Hashing**: bcrypt

## Setup

### Prerequisites

- Python 3.9+
- PostgreSQL
- MongoDB
- Redis
- AWS Account (for S3 storage)

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (create `.env` file):
```env
PYTHON_HOST=0.0.0.0
PYTHON_PORT=5000
PYTHON_DEBUG=True

SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret

DATABASE_URL=postgresql://user:password@localhost:5432/cloud_storage
MONGODB_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379

AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

3. Initialize database:
```bash
python -c "from database.db_manager import init_database; init_database()"
```

4. Run the application:
```bash
python app.py
```

Or use Gunicorn for production:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user

### File Management
- `POST /api/files/upload` - Upload file
- `GET /api/files/list` - List user files
- `GET /api/files/<file_id>` - Get file details
- `DELETE /api/files/<file_id>` - Delete file
- `POST /api/files/<file_id>/share` - Generate share link

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/usage` - Usage statistics
- `GET /api/analytics/file-types` - File type distribution
- `GET /api/analytics/upload-history` - Upload history
- `GET /api/analytics/top-files` - Largest files
- `POST /api/analytics/track` - Track custom event

### Health Check
- `GET /health` - Service health check
- `GET /api/status` - API status (authenticated)

## Architecture

```
python-server/
├── app.py                  # Main application entry point
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── routes/               # API route handlers
│   ├── auth_routes.py
│   ├── file_routes.py
│   └── analytics_routes.py
├── database/            # Database models and managers
│   ├── models.py
│   └── db_manager.py
├── middleware/          # Middleware components
│   └── auth.py
├── services/           # Business logic services
│   ├── storage_service.py
│   └── analytics_service.py
└── utils/             # Utility functions
    ├── logger.py
    ├── validators.py
    ├── password.py
    └── file_handler.py
```

## Security Features

- JWT token-based authentication
- Bcrypt password hashing
- Rate limiting (200 req/hour, 50 req/min)
- CORS configuration
- Security headers (CSP, XSS, Frame Options)
- Input validation and sanitization
- SQL injection prevention

## Development

Run in development mode:
```bash
export FLASK_ENV=development
python app.py
```

Run tests:
```bash
pytest tests/
```

## Production Deployment

1. Set environment to production
2. Use Gunicorn or uWSGI
3. Set up SSL/TLS certificates
4. Configure load balancer
5. Set up monitoring and logging
6. Configure backup systems

## License

MIT License
