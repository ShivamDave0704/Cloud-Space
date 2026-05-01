"""
Cloud Storage Python Microservice
Main package initialization
"""

__version__ = '1.0.0'
__author__ = 'Cloud Storage Team'
__description__ = 'Python microservice for cloud storage operations'

from flask import Flask
from config import Config


def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    return app
