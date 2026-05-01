"""
Database manager for handling database connections and operations
"""
import psycopg2
from pymongo import MongoClient
import redis
from typing import Optional
import logging

from config import Config

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self):
        self.pg_connection = None
        self.mongo_client = None
        self.redis_client = None
        self._initialize_connections()
    
    def _initialize_connections(self):
        """Initialize all database connections"""
        try:
            # PostgreSQL connection
            self.pg_connection = psycopg2.connect(Config.DATABASE_URL)
            logger.info("PostgreSQL connection established")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {str(e)}")
        
        try:
            # MongoDB connection
            self.mongo_client = MongoClient(Config.MONGODB_URL)
            self.mongo_db = self.mongo_client.get_database('cloud_storage')
            logger.info("MongoDB connection established")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
        
        try:
            # Redis connection
            self.redis_client = redis.from_url(Config.REDIS_URL)
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
    
    def check_connection(self) -> bool:
        """Check if database connections are healthy"""
        try:
            if self.pg_connection:
                cursor = self.pg_connection.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
            if self.redis_client:
                self.redis_client.ping()
            if self.mongo_client:
                self.mongo_client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return False
    
    def get_pg_cursor(self):
        """Get PostgreSQL cursor"""
        if self.pg_connection:
            return self.pg_connection.cursor()
        raise Exception("PostgreSQL connection not available")
    
    def get_mongo_collection(self, collection_name: str):
        """Get MongoDB collection"""
        if self.mongo_db:
            return self.mongo_db[collection_name]
        raise Exception("MongoDB connection not available")
    
    def get_redis_client(self):
        """Get Redis client"""
        if self.redis_client:
            return self.redis_client
        raise Exception("Redis connection not available")
    
    def close_connections(self):
        """Close all database connections"""
        if self.pg_connection:
            self.pg_connection.close()
            logger.info("PostgreSQL connection closed")
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("MongoDB connection closed")
        if self.redis_client:
            self.redis_client.close()
            logger.info("Redis connection closed")


def init_database():
    """Initialize database schema"""
    db = DatabaseManager()
    
    # Create PostgreSQL tables
    create_tables_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        storage_used BIGINT DEFAULT 0,
        storage_limit BIGINT DEFAULT 5368709120,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
    );
    
    CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        mime_type VARCHAR(100),
        path TEXT NOT NULL,
        cloud_url TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
    );
    
    CREATE TABLE IF NOT EXISTS analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
    """
    
    try:
        cursor = db.get_pg_cursor()
        cursor.execute(create_tables_sql)
        db.pg_connection.commit()
        cursor.close()
        logger.info("Database schema initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database schema: {str(e)}")
    finally:
        db.close_connections()
