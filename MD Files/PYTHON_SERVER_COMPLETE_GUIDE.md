# 🐍 Python Server - Complete Step-by-Step Guide

**From Zero to Running Server - Everything You Need to Know**

---

## 📋 Table of Contents

1. [Prerequisites & System Requirements](#1-prerequisites--system-requirements)
2. [Initial Setup - First Time Installation](#2-initial-setup---first-time-installation)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Setup & Initialization](#4-database-setup--initialization)
5. [Running the Python Server](#5-running-the-python-server)
6. [Verification & Testing](#6-verification--testing)
7. [Understanding the Project Structure](#7-understanding-the-project-structure)
8. [Available API Endpoints](#8-available-api-endpoints)
9. [Development Workflow](#9-development-workflow)
10. [Troubleshooting Common Issues](#10-troubleshooting-common-issues)
11. [Advanced Topics](#11-advanced-topics)
12. [Deployment Guide](#12-deployment-guide)

---

## 1. Prerequisites & System Requirements

### ✅ Required Software

Before starting, ensure you have the following installed:

| Software | Minimum Version | Purpose | Installation Check |
|----------|----------------|---------|-------------------|
| **Python** | 3.9 or higher | Main runtime | `python --version` |
| **pip** | 21.0+ | Package manager | `pip --version` |
| **PostgreSQL** | 13+ | Primary database | `psql --version` |
| **Redis** | 6.0+ | Cache & sessions | `redis-cli --version` |
| **MongoDB** | 5.0+ | Document storage | `mongod --version` |
| **Git** | 2.30+ | Version control | `git --version` |

### 📦 Optional but Recommended

| Software | Purpose |
|----------|---------|
| **Docker Desktop** | Containerized deployment |
| **VS Code** | IDE with Python extension |
| **Postman/Insomnia** | API testing |
| **AWS CLI** | S3 operations (if using AWS) |

### 💻 System Requirements

```
OS: Windows 10/11, Linux, or macOS
RAM: Minimum 4GB (8GB recommended)
Disk: At least 2GB free space
Ports: 5000, 5432, 27017, 6379 must be available
```

### 📝 Installation Commands

#### Windows (PowerShell as Administrator):

```powershell
# Install Python (if not installed)
# Download from https://www.python.org/downloads/

# Install PostgreSQL
# Download from https://www.postgresql.org/download/windows/

# Install MongoDB
# Download from https://www.mongodb.com/try/download/community

# Install Redis (using Chocolatey)
choco install redis-64
```

#### Linux (Ubuntu/Debian):

```bash
# Update package list
sudo apt update

# Install Python
sudo apt install python3.11 python3-pip python3-venv

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install mongodb-org
```

#### macOS (using Homebrew):

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python@3.11

# Install PostgreSQL
brew install postgresql@15

# Install Redis
brew install redis

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0
```

---

## 2. Initial Setup - First Time Installation

### Step 1: Clone or Navigate to Project

```powershell
# If cloning from repository
git clone <repository-url>
cd cloud-storage-app

# If already have the project
cd d:\cloud-storage-app
```

### Step 2: Navigate to Python Server Directory

```powershell
cd python-server
```

### Step 3: Create Python Virtual Environment

**Why Virtual Environment?**
- Isolates project dependencies
- Prevents conflicts with other Python projects
- Makes deployment easier

```powershell
# Create virtual environment
python -m venv venv

# You should now see a 'venv' folder created
```

### Step 4: Activate Virtual Environment

**Windows (PowerShell):**
```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# If you get execution policy error, run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try activation again
.\venv\Scripts\Activate.ps1

# Your prompt should now show (venv) at the beginning
# Example: (venv) PS D:\cloud-storage-app\python-server>
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### Step 5: Upgrade pip (Package Manager)

```powershell
# Upgrade pip to latest version
python -m pip install --upgrade pip

# Verify pip version
pip --version
# Should show pip 24.0 or higher
```

### Step 6: Install Python Dependencies

```powershell
# Install all required packages from requirements.txt
pip install -r requirements.txt

# This will install 20+ packages including:
# - Flask (web framework)
# - PostgreSQL driver (psycopg2)
# - Redis client
# - MongoDB client (pymongo)
# - JWT authentication
# - bcrypt (password hashing)
# - boto3 (AWS SDK)
# - Celery (background tasks)
# And many more...

# Installation takes 2-5 minutes depending on your internet speed
```

**Expected Output:**
```
Collecting Flask==3.0.0
  Downloading Flask-3.0.0-py3-none-any.whl (99 kB)
...
Successfully installed Flask-3.0.0 Flask-CORS-4.0.0 ...
```

### Step 7: Install Development Tools (Optional but Recommended)

```powershell
# Install testing and linting tools
pip install pytest pytest-cov flake8 black pylint mypy

# These tools help with:
# - pytest: Running tests
# - pytest-cov: Code coverage
# - flake8: Code linting
# - black: Code formatting
# - pylint: Code quality
# - mypy: Type checking
```

### Step 8: Verify Installation

```powershell
# Check installed packages
pip list

# Should show all packages including:
# Flask, psycopg2-binary, pymongo, redis, celery, boto3, etc.
```

---

## 3. Environment Configuration

### Step 1: Create Environment File

```powershell
# Copy the example environment file
copy .env.example .env

# Or manually create .env file
# New-Item -Path ".env" -ItemType File
```

### Step 2: Edit Configuration

Open `.env` file in your text editor and configure:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PYTHON_HOST=0.0.0.0              # Listen on all interfaces
PYTHON_PORT=5000                  # Server port
PYTHON_DEBUG=True                 # Enable debug mode (development only)

# ============================================
# SECURITY KEYS (CHANGE THESE!)
# ============================================
SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-this-too

# ============================================
# DATABASE CONNECTIONS
# ============================================
# PostgreSQL - Main database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cloud_storage

# MongoDB - Document storage
MONGODB_URL=mongodb://localhost:27017

# Redis - Cache and sessions
REDIS_URL=redis://localhost:6379

# ============================================
# AWS S3 CONFIGURATION (Optional)
# ============================================
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# ============================================
# FILE UPLOAD SETTINGS
# ============================================
UPLOAD_FOLDER=./uploads           # Local upload directory
MAX_FILE_SIZE=16777216            # 16MB in bytes

# ============================================
# CORS SETTINGS
# ============================================
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=INFO                    # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FILE=logs/app.log

# ============================================
# CELERY (Background Tasks)
# ============================================
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# ============================================
# EXTERNAL SERVICES (Optional)
# ============================================
ANALYTICS_API_KEY=
NOTIFICATION_SERVICE_URL=http://localhost:4000
```

### Step 3: Generate Secure Secret Keys

```powershell
# Generate random secret key using Python
python -c "import secrets; print(secrets.token_hex(32))"

# Example output: 7f3d8a2b9c1e4f5a6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c

# Copy this output and use it for SECRET_KEY and JWT_SECRET_KEY
```

### Step 4: Verify Database Connection Strings

**PostgreSQL Format:**
```
postgresql://[username]:[password]@[host]:[port]/[database_name]
```

**Example:**
```
postgresql://postgres:myPassword123@localhost:5432/cloud_storage
```

**MongoDB Format:**
```
mongodb://[host]:[port]
```

**Redis Format:**
```
redis://[host]:[port]/[db_number]
```

---

## 4. Database Setup & Initialization

### Step 1: Start Database Services

**Option A: Using Services (Windows)**

```powershell
# Start PostgreSQL
net start postgresql-x64-15

# Start MongoDB
net start MongoDB

# Start Redis
redis-server
```

**Option B: Using Commands**

```powershell
# PostgreSQL (if not running as service)
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start

# MongoDB
mongod --dbpath "C:\data\db"

# Redis
redis-server
```

**Option C: Using Docker (Recommended)**

```powershell
# Start all services using Docker Compose
docker-compose up -d

# This starts:
# - PostgreSQL on port 5432
# - MongoDB on port 27017
# - Redis on port 6379
```

### Step 2: Verify Services are Running

```powershell
# Test PostgreSQL
psql -U postgres -h localhost -c "SELECT version();"

# Test MongoDB
mongosh --eval "db.version()"

# Test Redis
redis-cli ping
# Should return: PONG
```

### Step 3: Create PostgreSQL Database

```powershell
# Connect to PostgreSQL
psql -U postgres

# Inside PostgreSQL prompt:
CREATE DATABASE cloud_storage;

# Create user (optional but recommended)
CREATE USER cloud_user WITH PASSWORD 'secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cloud_storage TO cloud_user;

# Exit
\q
```

**Or using command line:**

```powershell
# Create database
createdb -U postgres cloud_storage

# Verify
psql -U postgres -l | findstr cloud_storage
```

### Step 4: Initialize Database Schema

```powershell
# Navigate to python-server directory (if not already there)
cd python-server

# Make sure virtual environment is activated
# You should see (venv) in your prompt

# Initialize database tables
python -c "from database.db_manager import init_database; init_database()"
```

**What This Does:**
- Creates all necessary tables (users, files, analytics, etc.)
- Sets up indexes for performance
- Creates relationships between tables

**Expected Output:**
```
INFO - PostgreSQL connection established
INFO - MongoDB connection established
INFO - Redis connection established
INFO - Database schema initialized successfully
```

### Step 5: Verify Database Tables

```powershell
# Connect to database
psql -U postgres -d cloud_storage

# List all tables
\dt

# Expected tables:
#  public | users      | table | postgres
#  public | files      | table | postgres
#  public | analytics  | table | postgres

# Check users table structure
\d users

# Exit
\q
```

---

## 5. Running the Python Server

### Method 1: Development Mode (Recommended for Development)

```powershell
# Make sure you're in python-server directory
cd python-server

# Activate virtual environment (if not already activated)
.\venv\Scripts\Activate.ps1

# Run the Flask application
python app.py
```

**Expected Output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.1.100:5000
Press CTRL+C to quit
 * Restarting with stat
 * Debugger is active!
```

### Method 2: Using Flask CLI

```powershell
# Set Flask app environment variable
$env:FLASK_APP = "app.py"
$env:FLASK_ENV = "development"

# Run Flask
flask run --host=0.0.0.0 --port=5000
```

### Method 3: Production Mode (Using Gunicorn)

**Note:** Gunicorn doesn't work on Windows. Use Waitress instead for Windows.

**Linux/macOS:**
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

**Windows (using Waitress):**
```powershell
# Install Waitress
pip install waitress

# Run server
waitress-serve --host=0.0.0.0 --port=5000 app:app
```

### Method 4: Using Docker

```powershell
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f python-api
```

### Method 5: Using Makefile Commands

```powershell
# Run development server
make run

# Or run with production server
make run-prod
```

### Server is Running - What Now?

Once the server starts successfully, you'll see:

```
INFO - Starting Cloud Storage Python Microservice...
INFO - PostgreSQL connection established
INFO - MongoDB connection established
INFO - Redis connection established
 * Running on http://0.0.0.0:5000
```

**The server is now ready to accept requests!**

---

## 6. Verification & Testing

### Step 1: Test Basic Connectivity

Open a new PowerShell window (keep server running in the first):

```powershell
# Test health endpoint
curl http://localhost:5000/health

# Or using PowerShell's Invoke-WebRequest
Invoke-WebRequest -Uri http://localhost:5000/health | Select-Object -Expand Content
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:30:45.123456",
  "service": "python-microservice",
  "version": "1.0.0"
}
```

### Step 2: Test API Status (Requires Authentication)

```powershell
# First, register a user
$body = @{
    email = "test@example.com"
    password = "TestPassword123!"
    username = "testuser"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:5000/api/auth/register `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "username": "testuser"
  }
}
```

### Step 3: Test File Upload

```powershell
# Create a test file
"Hello World" | Out-File -FilePath test.txt

# Get auth token from previous step and upload file
$token = "your-token-here"
$headers = @{
    "Authorization" = "Bearer $token"
}

# Upload file
curl -X POST http://localhost:5000/api/files/upload `
    -H "Authorization: Bearer $token" `
    -F "file=@test.txt"
```

### Step 4: Run Automated Tests

```powershell
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=. --cov-report=html

# Open coverage report
start htmlcov/index.html
```

**Expected Output:**
```
tests/test_auth.py::test_health_check PASSED                    [ 10%]
tests/test_auth.py::test_register_user PASSED                   [ 20%]
tests/test_auth.py::test_login_invalid_credentials PASSED       [ 30%]
tests/test_files.py::test_upload_without_auth PASSED           [ 40%]
...
===================== 10 passed in 2.45s ========================
```

### Step 5: Test Using Postman

1. **Import Postman Collection** (if available)
2. **Or manually create requests:**

**Health Check:**
- Method: GET
- URL: `http://localhost:5000/health`

**Register User:**
- Method: POST
- URL: `http://localhost:5000/api/auth/register`
- Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "newuser"
}
```

**Login:**
- Method: POST
- URL: `http://localhost:5000/api/auth/login`
- Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

---

## 7. Understanding the Project Structure

### Complete Directory Layout

```
python-server/
│
├── app.py                          # 🚀 Main application entry point
│   └── Creates Flask app, registers routes, sets up middleware
│
├── config.py                       # ⚙️ Configuration management
│   └── Environment variables, app settings, DB URLs
│
├── requirements.txt                # 📦 Python dependencies
│   └── All packages needed to run the application
│
├── tasks.py                        # 🔄 Background tasks (Celery)
│   └── Async jobs: file processing, cleanup, reports
│
├── .env                           # 🔐 Environment variables (DO NOT COMMIT)
├── .env.example                   # 📝 Example environment file
├── .gitignore                     # 🚫 Git ignore patterns
├── Dockerfile                     # 🐳 Docker container config
├── docker-compose.yml             # 🎼 Multi-container orchestration
├── Makefile                       # 🛠️ Development commands
├── pytest.ini                     # 🧪 Test configuration
├── setup.cfg                      # 📋 Project metadata
├── README.md                      # 📖 Documentation
│
├── routes/                        # 🛣️ API route handlers
│   ├── __init__.py
│   ├── auth_routes.py             # Authentication endpoints
│   │   ├── POST /api/auth/register
│   │   ├── POST /api/auth/login
│   │   ├── GET  /api/auth/me
│   │   ├── POST /api/auth/refresh
│   │   └── POST /api/auth/logout
│   │
│   ├── file_routes.py             # File management endpoints
│   │   ├── POST   /api/files/upload
│   │   ├── GET    /api/files/list
│   │   ├── GET    /api/files/<id>
│   │   ├── DELETE /api/files/<id>
│   │   └── POST   /api/files/<id>/share
│   │
│   └── analytics_routes.py        # Analytics endpoints
│       ├── GET  /api/analytics/dashboard
│       ├── GET  /api/analytics/usage
│       ├── GET  /api/analytics/file-types
│       ├── GET  /api/analytics/upload-history
│       ├── GET  /api/analytics/top-files
│       └── POST /api/analytics/track
│
├── database/                      # 💾 Database layer
│   ├── __init__.py
│   ├── models.py                  # Data models (User, File, Analytics)
│   │   ├── User model
│   │   ├── File model
│   │   ├── Analytics model
│   │   └── Session model
│   │
│   └── db_manager.py              # Database connection manager
│       ├── PostgreSQL connection
│       ├── MongoDB connection
│       ├── Redis connection
│       └── Database initialization
│
├── middleware/                    # 🛡️ Middleware components
│   ├── __init__.py
│   └── auth.py                    # Authentication middleware
│       ├── @require_auth decorator
│       ├── @optional_auth decorator
│       └── JWT token verification
│
├── services/                      # 🔧 Business logic services
│   ├── __init__.py
│   ├── storage_service.py         # Cloud storage operations
│   │   ├── Upload to S3
│   │   ├── Download from S3
│   │   ├── Delete from S3
│   │   └── Generate presigned URLs
│   │
│   └── analytics_service.py       # Analytics processing
│       ├── User activity tracking
│       ├── Usage statistics
│       ├── Upload history
│       └── Event tracking
│
├── utils/                         # 🔨 Utility functions
│   ├── __init__.py
│   ├── logger.py                  # Logging configuration
│   ├── validators.py              # Input validation
│   │   ├── Email validation
│   │   ├── Password strength
│   │   ├── File type checking
│   │   └── File size validation
│   │
│   ├── password.py                # Password operations
│   │   ├── hash_password()
│   │   └── verify_password()
│   │
│   └── file_handler.py            # File operations
│       ├── save_file()
│       ├── delete_file()
│       ├── get_file_path()
│       └── cleanup functions
│
├── tests/                         # 🧪 Test suite
│   ├── __init__.py
│   ├── test_auth.py               # Authentication tests
│   ├── test_files.py              # File operation tests
│   └── test_analytics.py          # Analytics tests
│
├── logs/                          # 📝 Application logs
│   └── app.log                    # Main log file
│
└── uploads/                       # 📁 Uploaded files storage
    └── [user_id]/                 # User-specific folders
        └── [files]
```

### Key Files Explained

#### 🚀 **app.py** - The Heart of the Application

```python
# What it does:
1. Creates Flask application instance
2. Configures CORS (Cross-Origin Resource Sharing)
3. Sets up rate limiting
4. Initializes database connections
5. Registers all API blueprints (routes)
6. Sets up error handlers
7. Configures security headers
8. Starts the web server

# Key sections:
- Flask app initialization
- Middleware setup
- Route registration
- Error handlers
- Server startup
```

#### ⚙️ **config.py** - Configuration Hub

```python
# What it does:
1. Loads environment variables from .env
2. Defines configuration classes (Dev, Prod, Test)
3. Sets database URLs
4. Configures AWS credentials
5. Sets up file upload limits
6. Defines security settings

# Configuration types:
- DevelopmentConfig: Debug mode, verbose logging
- ProductionConfig: Optimized, secure
- TestingConfig: Test database, mock services
```

#### 📦 **requirements.txt** - Dependencies

```
Flask==3.0.0              # Web framework
psycopg2-binary==2.9.9    # PostgreSQL driver
pymongo==4.6.1            # MongoDB driver
redis==5.0.1              # Redis client
celery==5.3.4             # Background tasks
boto3==1.34.20            # AWS SDK
PyJWT==2.8.0              # JWT tokens
bcrypt==4.1.2             # Password hashing
... and more
```

---

## 8. Available API Endpoints

### Authentication Endpoints

#### 1. Register New User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "john_doe"
}
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe"
  }
}
```

#### 2. User Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe",
    "created_at": "2026-02-13T10:30:00Z"
  }
}
```

#### 3. Get Current User

```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe",
    "created_at": "2026-02-13T10:30:00Z",
    "storage_used": 1024000,
    "storage_limit": 5368709120
  }
}
```

#### 4. Refresh Token

```http
POST /api/auth/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 5. Logout

```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### File Management Endpoints

#### 1. Upload File

```http
POST /api/files/upload
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

file: [binary file data]
```

**Response (201 Created):**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": "file-uuid-here",
    "filename": "document.pdf",
    "size": 1024000,
    "url": "https://s3.amazonaws.com/bucket/user-id/document.pdf",
    "uploaded_at": "2026-02-13T10:35:00Z"
  }
}
```

#### 2. List Files

```http
GET /api/files/list?page=1&per_page=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "files": [
    {
      "id": "file-uuid-1",
      "filename": "document.pdf",
      "size": 1024000,
      "mime_type": "application/pdf",
      "url": "https://...",
      "uploaded_at": "2026-02-13T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### 3. Get File Details

```http
GET /api/files/<file_id>
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 4. Delete File

```http
DELETE /api/files/<file_id>
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 5. Share File

```http
POST /api/files/<file_id>/share
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "expiry": 3600
}
```

### Analytics Endpoints

#### 1. Dashboard Statistics

```http
GET /api/analytics/dashboard?days=7
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "storage": {
    "used": 1024000,
    "limit": 5368709120,
    "percentage": 19.07
  },
  "files": {
    "total": 45,
    "recent": [...]
  },
  "activity": [...]
}
```

#### 2. Usage Statistics

```http
GET /api/analytics/usage?period=month
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 3. File Type Distribution

```http
GET /api/analytics/file-types
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 4. Upload History

```http
GET /api/analytics/upload-history?days=30
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### 5. Track Custom Event

```http
POST /api/analytics/track
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "event_type": "file_viewed",
  "data": {
    "file_id": "uuid",
    "duration": 120
  }
}
```

### System Endpoints

#### Health Check

```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:30:45.123456",
  "service": "python-microservice",
  "version": "1.0.0"
}
```

#### API Status (Authenticated)

```http
GET /api/status
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 9. Development Workflow

### Daily Development Session

```powershell
# 1. Navigate to project
cd d:\cloud-storage-app\python-server

# 2. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 3. Pull latest changes (if working in team)
git pull origin main

# 4. Install any new dependencies
pip install -r requirements.txt

# 5. Start required services
docker-compose up -d postgres redis mongodb
# Or: Start services manually

# 6. Run database migrations (if any)
alembic upgrade head

# 7. Start development server
python app.py

# 8. In another terminal, run tests while developing
pytest tests/ -v --watch
```

### Making Code Changes

#### Adding a New API Endpoint

1. **Create route in appropriate file:**

```python
# python-server/routes/file_routes.py

@bp.route('/rename', methods=['POST'])
@require_auth
def rename_file():
    """Rename a file"""
    user = request.current_user
    data = request.get_json()
    
    file_id = data.get('file_id')
    new_name = data.get('new_name')
    
    # Validation
    if not file_id or not new_name:
        return jsonify({'error': 'Parameters required'}), 400
    
    # Business logic
    file = File.find_by_id(file_id)
    if not file or file['user_id'] != user['id']:
        return jsonify({'error': 'File not found'}), 404
    
    # Update file
    File.update(file_id, {'filename': new_name})
    
    return jsonify({
        'message': 'File renamed successfully',
        'file': {'id': file_id, 'filename': new_name}
    }), 200
```

2. **Add tests:**

```python
# python-server/tests/test_files.py

def test_rename_file(client, auth_token):
    """Test file rename"""
    response = client.post('/api/files/rename',
        headers={'Authorization': f'Bearer {auth_token}'},
        json={
            'file_id': 'test-file-id',
            'new_name': 'new-filename.txt'
        }
    )
    assert response.status_code == 200
    assert response.json['message'] == 'File renamed successfully'
```

3. **Test the endpoint:**

```powershell
# Run tests
pytest tests/test_files.py::test_rename_file -v

# Or test manually
curl -X POST http://localhost:5000/api/files/rename `
    -H "Authorization: Bearer $token" `
    -H "Content-Type: application/json" `
    -d '{"file_id":"uuid","new_name":"new.txt"}'
```

### Code Quality Checks

```powershell
# Format code with Black
black . --line-length 120

# Check code style with Flake8
flake8 .

# Run type checking with MyPy
mypy .

# Check for security issues
bandit -r .

# Run all quality checks
make lint
```

### Running Background Tasks (Celery)

```powershell
# Terminal 1: Start Redis (if not running)
redis-server

# Terminal 2: Start Celery worker
cd python-server
.\venv\Scripts\Activate.ps1
celery -A tasks.celery_app worker --loglevel=info

# Terminal 3: Start Celery Beat (scheduled tasks)
celery -A tasks.celery_app beat --loglevel=info

# Terminal 4: Run main application
python app.py
```

### Working with Database

```powershell
# Connect to PostgreSQL
psql -U postgres -d cloud_storage

# Common SQL commands
\dt                 # List tables
\d users            # Describe users table
SELECT * FROM users LIMIT 5;  # Query data

# Connect to MongoDB
mongosh

# Common MongoDB commands
show dbs
use cloud_storage
db.logs.find().limit(5)

# Connect to Redis
redis-cli

# Common Redis commands
PING
KEYS *
GET key_name
```

### Git Workflow

```powershell
# Create feature branch
git checkout -b feature/new-endpoint

# Make changes
# ... edit files ...

# Check status
git status

# Add changes
git add .

# Commit with conventional commit message
git commit -m "feat(files): add file rename endpoint"

# Push to remote
git push origin feature/new-endpoint

# Create Pull Request on GitHub
```

---

## 10. Troubleshooting Common Issues

### Issue 1: Virtual Environment Not Activating

**Problem:**
```
.\venv\Scripts\Activate.ps1 : File cannot be loaded because running scripts is disabled
```

**Solution:**
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try activating again
.\venv\Scripts\Activate.ps1
```

### Issue 2: Port Already in Use

**Problem:**
```
OSError: [Errno 98] Address already in use
```

**Solution:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual number)
taskkill /PID 12345 /F

# Or use different port
$env:PYTHON_PORT = "5001"
python app.py
```

### Issue 3: Database Connection Failed

**Problem:**
```
psycopg2.OperationalError: could not connect to server
```

**Solution:**
```powershell
# Check if PostgreSQL is running
Get-Service -Name postgresql*

# Start PostgreSQL service
net start postgresql-x64-15

# Verify connection string in .env
# DATABASE_URL=postgresql://postgres:password@localhost:5432/cloud_storage

# Test connection manually
psql -U postgres -h localhost
```

### Issue 4: Module Not Found Error

**Problem:**
```
ModuleNotFoundError: No module named 'flask'
```

**Solution:**
```powershell
# Make sure virtual environment is activated
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt

# Verify installation
pip list | findstr Flask
```

### Issue 5: Redis Connection Error

**Problem:**
```
redis.exceptions.ConnectionError: Error connecting to Redis
```

**Solution:**
```powershell
# Start Redis server
redis-server

# Or using Windows Service
net start Redis

# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis URL in .env
# REDIS_URL=redis://localhost:6379
```

### Issue 6: File Upload Fails

**Problem:**
```
413 Request Entity Too Large
```

**Solution:**
```python
# Increase MAX_CONTENT_LENGTH in config.py
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB

# Or in .env
MAX_FILE_SIZE=52428800
```

### Issue 7: JWT Token Issues

**Problem:**
```
401 Unauthorized: Token has expired
```

**Solution:**
```python
# Increase token expiration in config.py
JWT_EXPIRATION = timedelta(days=7)  # Instead of hours=24

# Or refresh token before expiry
POST /api/auth/refresh
```

### Issue 8: AWS S3 Upload Fails

**Problem:**
```
botocore.exceptions.NoCredentialsError: Unable to locate credentials
```

**Solution:**
```powershell
# Set AWS credentials in .env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1

# Or use AWS CLI to configure
aws configure
```

### Issue 9: CORS Errors

**Problem:**
```
Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Solution:**
```python
# Add frontend URL to ALLOWED_ORIGINS in .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Restart server after changing .env
```

### Issue 10: Tests Failing

**Problem:**
```
ImportError: cannot import name 'app' from 'app'
```

**Solution:**
```powershell
# Make sure you're in correct directory
cd python-server

# Virtual environment activated
.\venv\Scripts\Activate.ps1

# Install test dependencies
pip install pytest pytest-cov

# Set PYTHONPATH
$env:PYTHONPATH = "."

# Run tests
pytest tests/ -v
```

---

## 11. Advanced Topics

### Setting Up Celery for Background Tasks

#### Why Celery?

Celery handles long-running tasks asynchronously:
- File processing (thumbnail generation, virus scan)
- Email sending
- Report generation
- Database cleanup
- Periodic tasks (daily backups)

#### Setup Steps:

1. **Ensure Redis is Running**

```powershell
redis-server
```

2. **Start Celery Worker**

```powershell
cd python-server
.\venv\Scripts\Activate.ps1
celery -A tasks.celery_app worker --loglevel=info --pool=solo
# Note: Use --pool=solo on Windows
```

3. **Start Celery Beat (Scheduler)**

```powershell
celery -A tasks.celery_app beat --loglevel=info
```

4. **Trigger a Task**

```python
# In your route
from tasks import process_file_upload

# Trigger async task
result = process_file_upload.delay(file_id, user_id)

# Check status
result.ready()  # Returns True when complete
result.get()    # Gets result (blocks until complete)
```

### AWS S3 Integration

#### Setup:

1. **Create S3 Bucket** on AWS Console
2. **Create IAM User** with S3 permissions
3. **Get Access Keys**
4. **Configure in .env:**

```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET=my-cloud-storage-bucket
AWS_REGION=us-east-1
```

5. **Use Storage Service:**

```python
from services.storage_service import StorageService

storage = StorageService()

# Upload file
url = storage.upload(file_path, user_id, filename)

# Generate shareable link (expires in 1 hour)
share_url = storage.generate_presigned_url(key, expiration=3600)

# Delete file
storage.delete(key)
```

### Database Migrations with Alembic

#### Setup Alembic:

```powershell
# Install Alembic
pip install alembic

# Initialize Alembic
alembic init alembic

# Edit alembic.ini with your DATABASE_URL
```

#### Create Migration:

```powershell
# Generate migration from model changes
alembic revision --autogenerate -m "Add user avatar column"

# Review migration in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Monitoring and Logging

#### Setup Structured Logging:

```python
# Use logger throughout your code
from utils.logger import setup_logger

logger = setup_logger(__name__)

logger.info("User logged in", extra={'user_id': user_id})
logger.error("File upload failed", extra={'error': str(e)})
```

#### View Logs:

```powershell
# Tail application logs
Get-Content logs\app.log -Wait -Tail 50

# Or on Linux/Mac
tail -f logs/app.log
```

#### Setup Log Rotation:

Already configured in `utils/logger.py`:
- Max size: 10MB per file
- Keep 5 backup files
- Automatic rotation

### Performance Optimization

#### 1. Database Indexing

```sql
-- Add indexes to frequently queried columns
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);
CREATE INDEX idx_analytics_timestamp ON analytics(timestamp);
```

#### 2. Redis Caching

```python
from database.db_manager import DatabaseManager

db = DatabaseManager()
redis_client = db.get_redis_client()

# Cache user data
redis_client.setex(f"user:{user_id}", 3600, json.dumps(user_data))

# Get from cache
cached = redis_client.get(f"user:{user_id}")
if cached:
    user_data = json.loads(cached)
```

#### 3. Query Optimization

```python
# Bad: N+1 queries
for file in files:
    user = User.find_by_id(file['user_id'])

# Good: Join or batch query
files_with_users = File.find_with_users(user_id)
```

### Security Best Practices

#### 1. Password Requirements

Already implemented in `utils/validators.py`:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

#### 2. Rate Limiting

Already configured in `app.py`:
- 200 requests per hour per IP
- 50 requests per minute per IP

#### 3. Input Sanitization

Always validate and sanitize user input:

```python
from utils.validators import validate_email, allowed_file

# Validate email
if not validate_email(email):
    return jsonify({'error': 'Invalid email'}), 400

# Check file type
if not allowed_file(filename):
    return jsonify({'error': 'File type not allowed'}), 400
```

#### 4. SQL Injection Prevention

Use parameterized queries (already handled by SQLAlchemy):

```python
# Bad: String interpolation
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# Good: Parameterized query
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
```

---

## 12. Deployment Guide

### Production Deployment Checklist

- [ ] Set `PYTHON_DEBUG=False` in production
- [ ] Use strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Configure production database
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up backup system
- [ ] Configure monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Use production WSGI server (Gunicorn)
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up auto-restart (systemd/supervisor)

### Option 1: Deploy with Docker

```powershell
# Build production image
docker build -t cloud-storage-python:latest -f Dockerfile .

# Push to registry
docker tag cloud-storage-python:latest username/cloud-storage-python:latest
docker push username/cloud-storage-python:latest

# On production server
docker pull username/cloud-storage-python:latest
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Deploy to Linux Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install requirements
sudo apt install python3.11 python3-pip postgresql redis-server nginx

# Clone repository
git clone <repository-url>
cd cloud-storage-app/python-server

# Setup virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env  # Edit with production values

# Setup database
sudo -u postgres createdb cloud_storage
python -c "from database.db_manager import init_database; init_database()"

# Install Gunicorn
pip install gunicorn

# Test run
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option 3: Deploy to Heroku

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create my-cloud-storage-api

# Add buildpack
heroku buildpacks:set heroku/python

# Add addons
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev

# Set config vars
heroku config:set SECRET_KEY=xxx
heroku config:set JWT_SECRET_KEY=xxx

# Deploy
git push heroku main

# Run database migrations
heroku run python -c "from database.db_manager import init_database; init_database()"

# Open app
heroku open
```

### Setting Up Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/cloud-storage

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cloud-storage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Setting Up Systemd Service

```ini
# /etc/systemd/system/cloud-storage-python.service

[Unit]
Description=Cloud Storage Python API
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/var/www/cloud-storage-app/python-server
Environment="PATH=/var/www/cloud-storage-app/python-server/venv/bin"
ExecStart=/var/www/cloud-storage-app/python-server/venv/bin/gunicorn \
    -w 4 \
    -b 127.0.0.1:5000 \
    --timeout 60 \
    --access-logfile /var/log/cloud-storage/access.log \
    --error-logfile /var/log/cloud-storage/error.log \
    app:app

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable cloud-storage-python
sudo systemctl start cloud-storage-python
sudo systemctl status cloud-storage-python
```

---

## 📝 Summary

You now have complete knowledge to:

✅ Install and set up the Python server  
✅ Configure all environment variables  
✅ Initialize and manage databases  
✅ Run the server in development and production  
✅ Test all API endpoints  
✅ Understand the project architecture  
✅ Develop new features  
✅ Troubleshoot common issues  
✅ Deploy to production  

### Quick Reference Commands

```powershell
# Activate environment
.\venv\Scripts\Activate.ps1

# Run server
python app.py

# Run tests
pytest tests/ -v

# Format code
black . --line-length 120

# Install dependencies
pip install -r requirements.txt

# Initialize database
python -c "from database.db_manager import init_database; init_database()"
```

### Next Steps

1. ✅ Complete initial setup
2. ✅ Run health check test
3. ✅ Create test user
4. ✅ Upload test file
5. ✅ Explore API endpoints
6. 🚀 Build your features!

### Need Help?

- 📖 Read the documentation in `python-server/README.md`
- 🐛 Check troubleshooting section above
- 💬 Ask questions in project discussions
- 📧 Contact the development team

---

**Happy Coding! 🚀**

*Last Updated: February 13, 2026*
