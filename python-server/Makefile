.PHONY: help install run test clean lint format docker-build docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  install       - Install dependencies"
	@echo "  run          - Run the Flask application"
	@echo "  test         - Run tests"
	@echo "  lint         - Run linting"
	@echo "  format       - Format code"
	@echo "  clean        - Remove temporary files"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-up    - Start Docker containers"
	@echo "  docker-down  - Stop Docker containers"

install:
	pip install -r requirements.txt
	pip install pytest flake8 black

run:
	python app.py

run-prod:
	gunicorn -w 4 -b 0.0.0.0:5000 app:app

test:
	pytest tests/ -v

lint:
	flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
	flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

format:
	black . --line-length 120

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov
	rm -rf dist
	rm -rf build
	rm -rf *.egg-info

docker-build:
	docker build -t cloud-storage-python:latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

init-db:
	python -c "from database.db_manager import init_database; init_database()"

celery-worker:
	celery -A tasks.celery_app worker --loglevel=info

celery-beat:
	celery -A tasks.celery_app beat --loglevel=info

dev: install
	export FLASK_ENV=development && python app.py
