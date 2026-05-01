"""
File handling utilities
"""
import os
import shutil
from typing import Dict
from werkzeug.datastructures import FileStorage
from config import Config


def save_file(file: FileStorage, user_id: str, filename: str) -> Dict[str, str]:
    """Save uploaded file to local storage"""
    # Create user directory
    user_dir = os.path.join(Config.UPLOAD_FOLDER, user_id)
    os.makedirs(user_dir, exist_ok=True)
    
    # Save file
    file_path = os.path.join(user_dir, filename)
    file.save(file_path)
    
    return {
        'path': file_path,
        'directory': user_dir,
        'filename': filename
    }


def delete_file(file_path: str) -> bool:
    """Delete file from local storage"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False


def get_file_path(user_id: str, filename: str) -> str:
    """Get full path for a file"""
    return os.path.join(Config.UPLOAD_FOLDER, user_id, filename)


def calculate_directory_size(directory: str) -> int:
    """Calculate total size of directory"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(directory):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            total_size += os.path.getsize(file_path)
    return total_size


def cleanup_empty_directories(base_dir: str) -> None:
    """Remove empty directories"""
    for dirpath, dirnames, filenames in os.walk(base_dir, topdown=False):
        if not dirnames and not filenames and dirpath != base_dir:
            try:
                os.rmdir(dirpath)
            except OSError:
                pass
