"""
Cleanup Script - Remove old temporary files and orphaned data
Integrates with Node.js application database
"""

import os
import sys
import argparse
import psycopg2
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load environment
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(project_root, '.env'))


class CleanupManager:
    """Manage cleanup operations"""
    
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.files_deleted = 0
        self.space_freed = 0
        self.db_records_deleted = 0
        self.conn = self.connect_database()
    
    def connect_database(self):
        """Connect to database"""
        try:
            database_url = os.getenv('DATABASE_URL')
            if database_url:
                conn = psycopg2.connect(database_url)
                print("✓ Connected to database")
                return conn
        except Exception as e:
            print(f"⚠️  Database connection failed: {e}")
        return None
    
    def cleanup_temp_files(self, temp_dir, days_old):
        """Remove temporary files older than specified days"""
        print(f"\n🗑️  Cleaning temporary files older than {days_old} days...")
        
        temp_path = Path(temp_dir)
        if not temp_path.exists():
            print(f"   ⚠️  Directory not found: {temp_dir}")
            return
        
        cutoff_time = datetime.now() - timedelta(days=days_old)
        
        for file_path in temp_path.rglob('*'):
            if not file_path.is_file():
                continue
            
            # Check file age
            file_time = datetime.fromtimestamp(file_path.stat().st_mtime)
            
            if file_time < cutoff_time:
                file_size = file_path.stat().st_size
                
                if self.dry_run:
                    print(f"   [DRY RUN] Would delete: {file_path.name} ({file_size:,} bytes)")
                else:
                    try:
                        file_path.unlink()
                        print(f"   ✓ Deleted: {file_path.name} ({file_size:,} bytes)")
                        self.files_deleted += 1
                        self.space_freed += file_size
                    except Exception as e:
                        print(f"   ✗ Error deleting {file_path.name}: {e}")
    
    def cleanup_orphaned_files(self, upload_dir):
        """Remove files not referenced in database"""
        if not self.conn:
            print("⚠️  Skipping orphaned files cleanup (no database connection)")
            return
        
        print(f"\n🔍 Checking for orphaned files...")
        
        upload_path = Path(upload_dir)
        if not upload_path.exists():
            print(f"   ⚠️  Directory not found: {upload_dir}")
            return
        
        cursor = self.conn.cursor()
        
        try:
            # Get all file paths from database
            cursor.execute("SELECT file_path FROM files WHERE file_path IS NOT NULL")
            db_files = {row[0] for row in cursor.fetchall()}
            
            # Check each file in upload directory
            for file_path in upload_path.rglob('*'):
                if not file_path.is_file():
                    continue
                
                # Check if file is in database
                rel_path = str(file_path.relative_to(project_root))
                
                if rel_path not in db_files:
                    file_size = file_path.stat().st_size
                    
                    if self.dry_run:
                        print(f"   [DRY RUN] Orphaned: {file_path.name} ({file_size:,} bytes)")
                    else:
                        try:
                            file_path.unlink()
                            print(f"   ✓ Removed orphaned: {file_path.name}")
                            self.files_deleted += 1
                            self.space_freed += file_size
                        except Exception as e:
                            print(f"   ✗ Error: {e}")
        
        except Exception as e:
            print(f"   ✗ Database error: {e}")
        finally:
            cursor.close()
    
    def cleanup_old_logs(self, log_dir, days_old, max_size_mb):
        """Remove old log files"""
        print(f"\n📋 Cleaning log files older than {days_old} days...")
        
        log_path = Path(log_dir)
        if not log_path.exists():
            print(f"   ⚠️  Directory not found: {log_dir}")
            return
        
        cutoff_time = datetime.now() - timedelta(days=days_old)
        max_size = max_size_mb * 1024 * 1024
        
        for log_file in log_path.glob('*.log*'):
            if not log_file.is_file():
                continue
            
            file_time = datetime.fromtimestamp(log_file.stat().st_mtime)
            file_size = log_file.stat().st_size
            
            # Delete if old or too large
            should_delete = file_time < cutoff_time or file_size > max_size
            
            if should_delete:
                if self.dry_run:
                    print(f"   [DRY RUN] Would delete: {log_file.name}")
                else:
                    try:
                        log_file.unlink()
                        print(f"   ✓ Deleted: {log_file.name}")
                        self.files_deleted += 1
                        self.space_freed += file_size
                    except Exception as e:
                        print(f"   ✗ Error: {e}")
    
    def cleanup_database_records(self, days_old):
        """Remove old database records"""
        if not self.conn:
            print("⚠️  Skipping database cleanup (no connection)")
            return
        
        print(f"\n🗄️  Cleaning database records older than {days_old} days...")
        
        cursor = self.conn.cursor()
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        try:
            # Delete old sessions
            if self.dry_run:
                cursor.execute("""
                    SELECT COUNT(*) FROM sessions 
                    WHERE last_activity < %s
                """, (cutoff_date,))
                count = cursor.fetchone()[0]
                print(f"   [DRY RUN] Would delete {count} old sessions")
            else:
                cursor.execute("""
                    DELETE FROM sessions 
                    WHERE last_activity < %s
                """, (cutoff_date,))
                count = cursor.rowcount
                print(f"   ✓ Deleted {count} old sessions")
                self.db_records_deleted += count
            
            # Delete old analytics events
            if self.dry_run:
                cursor.execute("""
                    SELECT COUNT(*) FROM analytics_events 
                    WHERE created_at < %s
                """, (cutoff_date,))
                count = cursor.fetchone()[0]
                print(f"   [DRY RUN] Would delete {count} old analytics events")
            else:
                cursor.execute("""
                    DELETE FROM analytics_events 
                    WHERE created_at < %s
                """, (cutoff_date,))
                count = cursor.rowcount
                print(f"   ✓ Deleted {count} old analytics events")
                self.db_records_deleted += count
            
            if not self.dry_run:
                self.conn.commit()
        
        except Exception as e:
            print(f"   ✗ Database error: {e}")
            if self.conn:
                self.conn.rollback()
        finally:
            cursor.close()
    
    def print_summary(self):
        """Print cleanup summary"""
        print("\n" + "=" * 60)
        print("CLEANUP SUMMARY")
        print("=" * 60)
        print(f"Files deleted: {self.files_deleted}")
        print(f"Space freed: {self.space_freed / (1024*1024):.2f} MB")
        print(f"Database records deleted: {self.db_records_deleted}")
        if self.dry_run:
            print("\n⚠️  DRY RUN - No files were actually deleted")
        print("=" * 60)
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(
        description='Cleanup old files and database records'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Consider files older than this many days (default: 30)'
    )
    parser.add_argument(
        '--temp-dir',
        default='temp',
        help='Temporary files directory (default: temp)'
    )
    parser.add_argument(
        '--upload-dir',
        default='uploads',
        help='Upload directory to check for orphaned files (default: uploads)'
    )
    parser.add_argument(
        '--log-dir',
        default='logs',
        help='Log files directory (default: logs)'
    )
    parser.add_argument(
        '--max-log-size',
        type=int,
        default=100,
        help='Maximum log file size in MB (default: 100)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    parser.add_argument(
        '--skip-orphaned',
        action='store_true',
        help='Skip checking for orphaned files'
    )
    parser.add_argument(
        '--skip-database',
        action='store_true',
        help='Skip database cleanup'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Cleanup Manager")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Days threshold: {args.days}")
    
    manager = CleanupManager(dry_run=args.dry_run)
    
    try:
        # Cleanup temp files
        manager.cleanup_temp_files(args.temp_dir, args.days)
        
        # Cleanup orphaned files
        if not args.skip_orphaned:
            manager.cleanup_orphaned_files(args.upload_dir)
        
        # Cleanup logs
        manager.cleanup_old_logs(args.log_dir, args.days, args.max_log_size)
        
        # Cleanup database
        if not args.skip_database:
            manager.cleanup_database_records(args.days)
        
        # Print summary
        manager.print_summary()
        
        return 0
    
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return 1
    finally:
        manager.close()


if __name__ == '__main__':
    sys.exit(main())
