"""
Database Utilities - Common database functions for Python scripts
"""

import os
import psycopg2
from dotenv import load_dotenv


def get_database_connection():
    """Get database connection using environment variables"""
    # Load from project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(project_root, '.env'))
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    
    return psycopg2.connect(database_url)


def execute_query(query, params=None, fetch=True):
    """Execute a database query"""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(query, params)
        
        if fetch:
            results = cursor.fetchall()
            return results
        else:
            conn.commit()
            return cursor.rowcount
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def get_user_by_id(user_id):
    """Get user information"""
    query = "SELECT * FROM users WHERE id = %s"
    results = execute_query(query, (user_id,))
    return results[0] if results else None


def get_user_files(user_id, limit=None):
    """Get all files for a user"""
    query = "SELECT * FROM files WHERE user_id = %s ORDER BY created_at DESC"
    if limit:
        query += f" LIMIT {limit}"
    
    return execute_query(query, (user_id,))


def get_storage_usage(user_id):
    """Get total storage usage for a user"""
    query = "SELECT SUM(file_size) FROM files WHERE user_id = %s"
    results = execute_query(query, (user_id,))
    return results[0][0] if results and results[0][0] else 0
