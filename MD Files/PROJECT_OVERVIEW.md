# 🚀 Cloud Storage Application - Full Stack Microservices Architecture

A modern, scalable cloud storage application built with a microservices architecture, combining Node.js and Python backends with a powerful feature set.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

## 🎯 Overview

This is a production-ready cloud storage application featuring:

- **Dual Backend Architecture**: Node.js for real-time operations + Python for analytics & ML
- **Microservices Design**: Scalable, maintainable, and independently deployable services
- **Cloud-Native**: Docker support, Kubernetes ready, AWS S3 integration
- **Modern Features**: Real-time chat, friends system, coin economy, backup system
- **Enterprise Grade**: JWT auth, rate limiting, logging, monitoring

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Frontend (React/Vue)                │
└─────────────┬───────────────────────┬────────────┘
              │                       │
    ┌─────────▼─────────┐   ┌────────▼──────────┐
    │   Node.js Server  │   │  Python Server    │
    │   (Port 3000)     │   │  (Port 5000)      │
    │                   │   │                   │
    │ • Real-time ops   │   │ • Analytics       │
    │ • File management │   │ • ML processing   │
    │ • User auth       │   │ • Background jobs │
    │ • WebSockets      │   │ • Data pipelines  │
    └─────────┬─────────┘   └────────┬──────────┘
              │                      │
    ┌─────────▼──────────────────────▼──────────┐
    │          Shared Data Layer                 │
    │  • PostgreSQL  • MongoDB  • Redis  • S3   │
    └────────────────────────────────────────────┘
```

## ✨ Features

### Core Features

- 🔐 **Authentication & Authorization**: JWT-based secure authentication
- 📁 **File Management**: Upload, download, share, and organize files
- ☁️ **Cloud Storage**: AWS S3 integration for scalable storage
- 👥 **Friends System**: Connect and share with other users
- 💬 **Real-time Chat**: WebSocket-based messaging system
- 🪙 **Coin Economy**: Virtual currency system with admin controls
- 🎫 **Ticket System**: Support ticket management
- 📊 **Analytics Dashboard**: Comprehensive usage statistics
- 🔄 **Backup System**: Automated data backup and recovery
- 📱 **Responsive Design**: Modern, mobile-friendly interface

### Advanced Features

- 🤖 **Background Jobs**: Celery for async task processing
- 📈 **Monitoring**: Built-in health checks and metrics
- 🔍 **Search**: Full-text search across files and content
- 🎨 **Themes**: Customizable UI themes
- 🌍 **i18n**: Multi-language support ready
- 🔔 **Notifications**: Real-time push notifications
- 📊 **Rate Limiting**: API throttling and abuse prevention
- 🔒 **Security**: CORS, CSP, XSS protection, and more

## 🛠️ Tech Stack

### Backend - Node.js

```
• Express.js - Web framework
• Socket.io - Real-time communication
• Sequelize - ORM for PostgreSQL
• JWT - Authentication
• Redis - Caching & sessions
```

### Backend - Python

```
• Flask 3.0 - Web framework
• Celery - Background tasks
• SQLAlchemy - ORM
• Boto3 - AWS SDK
• PyJWT - Authentication
• Bcrypt - Password hashing
```

### Databases

```
• PostgreSQL - Primary database
• MongoDB - Document storage
• Redis - Cache & message broker
```

### DevOps

```
• Docker & Docker Compose
• GitHub Actions - CI/CD
• Gunicorn - WSGI server
• Nginx - Reverse proxy
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- Python >= 3.9
- PostgreSQL >= 13
- MongoDB >= 5.0
- Redis >= 6.0
- Docker (optional)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd cloud-storage-app

# Start Python services
cd python-server
docker-compose up -d

# Start Node.js server (in another terminal)
cd ..
npm install
npm start
```

### Option 2: Manual Setup

#### Python Server

```bash
cd python-server

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your settings

# Initialize database
python -c "from database.db_manager import init_database; init_database()"

# Run server
python app.py
```

#### Node.js Server

```bash
# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Edit .env with your settings

# Run migrations
npm run migrate

# Start server
npm start
```

## 📁 Project Structure

```
cloud-storage-app/
├── python-server/              # Python Flask microservice
│   ├── app.py                  # Main application
│   ├── config.py               # Configuration
│   ├── requirements.txt        # Python dependencies
│   ├── routes/                 # API routes
│   │   ├── auth_routes.py      # Authentication
│   │   ├── file_routes.py      # File operations
│   │   └── analytics_routes.py # Analytics
│   ├── database/               # Database layer
│   │   ├── models.py           # Data models
│   │   └── db_manager.py       # DB connection
│   ├── services/               # Business logic
│   │   ├── storage_service.py  # S3 operations
│   │   └── analytics_service.py # Analytics
│   ├── middleware/             # Middleware
│   │   └── auth.py             # JWT verification
│   ├── utils/                  # Utilities
│   ├── tests/                  # Unit tests
│   ├── Dockerfile              # Docker config
│   ├── docker-compose.yml      # Services orchestration
│   └── README.md               # Python docs
│
├── server/                     # Node.js server (if exists)
├── client/                     # Frontend (if exists)
├── .vscode/                    # VS Code settings
│   ├── settings.json           # Editor settings
│   ├── launch.json             # Debug configs
│   ├── tasks.json              # Build tasks
│   └── extensions.json         # Recommended extensions
├── docs/                       # Documentation
└── README.md                   # This file
```

## 📚 Documentation

Comprehensive documentation is available:

- [Python Server Documentation](python-server/README.md)
- [API Documentation](API_ENDPOINT_VERIFICATION.md)
- [Authentication System](AUTH_SYSTEM_DOCS.md)
- [Friends System Guide](FRIENDS_SYSTEM_GUIDE.md)
- [Backup System](BACKUP_SYSTEM_DOCUMENTATION.md)
- [Admin Coins Architecture](ADMIN_COINS_ARCHITECTURE.md)
- [Developer Quick Start](DEVELOPER_QUICK_START.md)

## 🔌 API Endpoints

### Node.js Server (Port 3000)

```
POST   /api/auth/login          # User login
POST   /api/auth/register       # User registration
GET    /api/files               # List files
POST   /api/files/upload        # Upload file
GET    /api/friends             # List friends
POST   /api/chat/send           # Send message
```

### Python Server (Port 5000)

```
GET    /health                  # Health check
POST   /api/auth/register       # User registration
POST   /api/auth/login          # User login
POST   /api/files/upload        # Upload to S3
GET    /api/analytics/dashboard # Analytics dashboard
GET    /api/analytics/usage     # Usage statistics
```

## 💻 Development

### Running Tests

```bash
# Python tests
cd python-server
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Node.js tests (if configured)
npm test
```

### Code Formatting

```bash
# Python
cd python-server
black . --line-length 120
flake8 .

# JavaScript/TypeScript
npm run lint
npm run format
```

### Database Migrations

```bash
# Python (Alembic)
cd python-server
alembic upgrade head

# Node.js (Sequelize)
npm run migrate
```

## 🐳 Docker Deployment

### Build Images

```bash
# Python
cd python-server
docker build -t cloud-storage-python:latest .

# Node.js
docker build -t cloud-storage-node:latest .
```

### Run with Docker Compose

```bash
cd python-server
docker-compose up -d
```

Services started:

- Python API (Port 5000)
- PostgreSQL (Port 5432)
- MongoDB (Port 27017)
- Redis (Port 6379)
- Celery Worker

## 🔧 Configuration

### Environment Variables

#### Python Server (.env)

```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket
```

#### Node.js Server (.env)

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
```

## 📊 Monitoring

### Health Checks

```bash
# Python service
curl http://localhost:5000/health

# Node.js service
curl http://localhost:3000/health
```

### Logs

```bash
# Docker logs
docker-compose logs -f python-api

# Application logs
tail -f python-server/logs/app.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Flask & Express.js communities
- All contributors and testers
- Open source libraries used in this project

## 📧 Contact

For questions and support, please open an issue or contact the development team.

---

**Built with ❤️ using Node.js & Python**
