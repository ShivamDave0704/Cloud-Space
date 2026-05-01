# Contributing to Cloud Storage Application

First off, thank you for considering contributing to the Cloud Storage Application! It's people like you that make this project such a great tool.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project team.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (>= 16.0.0)
- **Python** (>= 3.9)
- **PostgreSQL** (>= 13)
- **MongoDB** (>= 5.0)
- **Redis** (>= 6.0)
- **Git**
- **Docker** (optional but recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your forked repository:

   ```bash
   git clone https://github.com/your-username/cloud-storage-app.git
   cd cloud-storage-app
   ```

3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/original-owner/cloud-storage-app.git
   ```

## 💻 Development Setup

### Python Server Setup

```bash
cd python-server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest flake8 black pylint mypy

# Copy environment file
copy .env.example .env

# Initialize database
python -c "from database.db_manager import init_database; init_database()"

# Run tests to verify setup
pytest tests/ -v
```

### Node.js Server Setup

```bash
# Install dependencies
npm install

# Copy environment file
copy .env.example .env

# Run database migrations
npm run migrate

# Run tests
npm test
```

### Docker Setup (Alternative)

```bash
cd python-server
docker-compose up -d
```

## 🛠️ How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected behavior**
- **Actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, Node/Python version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Current behavior vs. proposed behavior**
- **Why this enhancement would be useful**
- **Possible implementation approach**

### Your First Code Contribution

Unsure where to begin? You can start by looking through issues labeled:

- `good-first-issue` - Issues suitable for newcomers
- `help-wanted` - Issues that need assistance
- `documentation` - Documentation improvements

## 📝 Coding Standards

### Python Code Style

We follow **PEP 8** with some modifications:

```python
# Good
def calculate_storage_usage(user_id: str) -> int:
    """
    Calculate total storage usage for a user.

    Args:
        user_id: The unique identifier for the user

    Returns:
        Total storage used in bytes
    """
    # Implementation
    pass


# Use type hints
def process_file(file_path: str, user_id: str) -> Dict[str, Any]:
    pass


# Docstrings for all public functions
def public_function():
    """Brief description of what this function does."""
    pass
```

**Tools:**

- **Black** for formatting (line length: 120)
- **Flake8** for linting
- **Pylint** for additional checks
- **MyPy** for type checking

```bash
# Format code
black . --line-length 120

# Lint code
flake8 .

# Type check
mypy .
```

### JavaScript/TypeScript Code Style

We use **Prettier** and **ESLint**:

```javascript
// Good
async function uploadFile(fileData, userId) {
  try {
    const result = await storageService.upload(fileData);
    return result;
  } catch (error) {
    logger.error("Upload failed:", error);
    throw error;
  }
}

// Use async/await instead of callbacks
// Use const/let instead of var
// Use descriptive variable names
```

**Tools:**

- **Prettier** for formatting
- **ESLint** for linting

```bash
# Format code
npm run format

# Lint code
npm run lint
```

### General Guidelines

- **Clear naming**: Use descriptive names for variables, functions, and classes
- **Comments**: Comment complex logic, not obvious code
- **DRY principle**: Don't repeat yourself
- **Single responsibility**: Functions should do one thing well
- **Error handling**: Always handle errors appropriately
- **Security**: Never commit secrets, API keys, or passwords

## 📨 Commit Guidelines

We follow the **Conventional Commits** specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
# Feature
git commit -m "feat(auth): add JWT token refresh endpoint"

# Bug fix
git commit -m "fix(upload): resolve file size validation issue"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Multiple paragraphs
git commit -m "feat(analytics): add user activity tracking

Implemented comprehensive activity tracking including:
- File uploads/downloads
- User sessions
- API usage metrics

Closes #123"
```

### Commit Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when relevant
- Keep commits atomic (one logical change per commit)

## 🔄 Pull Request Process

### Before Submitting

1. **Update your fork:**

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit following our commit guidelines

4. **Run tests:**

   ```bash
   # Python
   cd python-server
   pytest tests/ -v

   # Node.js
   npm test
   ```

5. **Format your code:**

   ```bash
   # Python
   black . --line-length 120
   flake8 .

   # JavaScript
   npm run format
   npm run lint
   ```

6. **Update documentation** if needed

### Submitting the PR

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub

3. **Fill out the PR template:**
   - Clear description of changes
   - Link to related issues
   - Screenshots (if UI changes)
   - Checklist verification

4. **Wait for review:**
   - Address reviewer comments
   - Make requested changes
   - Keep the PR updated with main branch

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] No new warnings
- [ ] Commits follow commit guidelines

## 🧪 Testing Guidelines

### Python Tests

```python
# test_example.py
import pytest
from app import create_app


@pytest.fixture
def client():
    """Create test client."""
    app = create_app('testing')
    with app.test_client() as client:
        yield client


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'


def test_user_registration(client):
    """Test user registration."""
    response = client.post('/api/auth/register', json={
        'email': 'test@example.com',
        'password': 'Test123!@#'
    })
    assert response.status_code == 201
```

### JavaScript Tests

```javascript
// example.test.js
const request = require("supertest");
const app = require("./app");

describe("Auth Endpoints", () => {
  test("POST /api/auth/login - success", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
  });
});
```

### Test Coverage

- Aim for **80%+ code coverage**
- Write tests for critical functionality
- Include edge cases and error scenarios
- Mock external dependencies

```bash
# Python coverage
pytest tests/ --cov=. --cov-report=html

# JavaScript coverage
npm run test:coverage
```

## 🏗️ Project Architecture

### Adding New Features

1. **Backend (Python):**
   - Add route in `python-server/routes/`
   - Add service logic in `python-server/services/`
   - Add models in `python-server/database/models.py`
   - Add tests in `python-server/tests/`

2. **Backend (Node.js):**
   - Add route in `server/routes/`
   - Add controller in `server/controllers/`
   - Add model in `server/models/`
   - Add tests in `server/tests/`

### Database Changes

1. **Create migration:**

   ```bash
   # Python (Alembic)
   alembic revision -m "add new table"

   # Node.js (Sequelize)
   npm run migration:create -- --name add-new-table
   ```

2. **Update models**

3. **Run migration:**

   ```bash
   # Python
   alembic upgrade head

   # Node.js
   npm run migrate
   ```

## 📚 Additional Resources

- [Python Server Documentation](python-server/README.md)
- [API Documentation](API_ENDPOINT_VERIFICATION.md)
- [Project Architecture](ADMIN_COINS_ARCHITECTURE.md)
- [Developer Quick Start](DEVELOPER_QUICK_START.md)

## ❓ Questions?

- Open an issue with the `question` label
- Join our community chat (if available)
- Email the maintainers

## 🎉 Recognition

Contributors will be recognized in our README.md and release notes!

---

Thank you for contributing! 🙌
