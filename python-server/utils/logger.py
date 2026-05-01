"""
Logging utilities
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from config import Config


def setup_logger(name: str = __name__) -> logging.Logger:
    """Setup and configure logger"""
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, Config.LOG_LEVEL))
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler
    if Config.LOG_FILE:
        os.makedirs(os.path.dirname(Config.LOG_FILE), exist_ok=True)
        file_handler = RotatingFileHandler(
            Config.LOG_FILE,
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger
