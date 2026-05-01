"""
Simple File Manager - No database dependencies
Manages files without needing PostgreSQL connection
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta
import json


class SimpleFileManager:
    """Manage files without database"""
    
    def __init__(self):
        self.stats = {
            'total_files': 0,
            'total_size': 0,
            'by_extension': {},
            'by_user': {}
        }
    
    def analyze_directory(self, directory):
        """Analyze files in directory"""
        print(f"\n📁 Analyzing directory: {directory}")
        
        dir_path = Path(directory)
        if not dir_path.exists():
            print(f"✗ Directory not found: {directory}")
            return None
        
        for file_path in dir_path.rglob('*'):
            if not file_path.is_file():
                continue
            
            # Get file info
            size = file_path.stat().st_size
            ext = file_path.suffix.lower() or 'no_extension'
            
            # Try to determine user from path structure
            parts = file_path.parts
            user = 'unknown'
            if 'uploads' in parts:
                idx = parts.index('uploads')
                if idx + 1 < len(parts):
                    user = parts[idx + 1]
            
            # Update stats
            self.stats['total_files'] += 1
            self.stats['total_size'] += size
            
            # By extension
            if ext not in self.stats['by_extension']:
                self.stats['by_extension'][ext] = {'count': 0, 'size': 0}
            self.stats['by_extension'][ext]['count'] += 1
            self.stats['by_extension'][ext]['size'] += size
            
            # By user
            if user not in self.stats['by_user']:
                self.stats['by_user'][user] = {'count': 0, 'size': 0}
            self.stats['by_user'][user]['count'] += 1
            self.stats['by_user'][user]['size'] += size
        
        return self.stats
    
    def print_stats(self):
        """Print statistics"""
        print("\n" + "=" * 60)
        print("FILE ANALYSIS RESULTS")
        print("=" * 60)
        
        print(f"\nTotal Files: {self.stats['total_files']:,}")
        print(f"Total Size: {self.format_bytes(self.stats['total_size'])}")
        
        print("\n📊 By File Type:")
        sorted_ext = sorted(
            self.stats['by_extension'].items(),
            key=lambda x: x[1]['size'],
            reverse=True
        )
        for ext, data in sorted_ext[:10]:
            print(f"  {ext:15s} {data['count']:6,} files  {self.format_bytes(data['size']):>12}")
        
        print("\n👤 By User:")
        sorted_users = sorted(
            self.stats['by_user'].items(),
            key=lambda x: x[1]['size'],
            reverse=True
        )
        for user, data in sorted_users[:10]:
            print(f"  {user:15s} {data['count']:6,} files  {self.format_bytes(data['size']):>12}")
    
    def save_report(self, output_file):
        """Save report to JSON"""
        report = {
            **self.stats,
            'generated_at': datetime.now().isoformat()
        }
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n✓ Report saved to: {output_file}")
    
    @staticmethod
    def format_bytes(bytes_size):
        """Format bytes to human readable"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.2f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.2f} PB"


def main():
    parser = argparse.ArgumentParser(
        description='Simple file manager - No database required'
    )
    parser.add_argument(
        '--directory',
        default='uploads',
        help='Directory to analyze (default: uploads)'
    )
    parser.add_argument(
        '--output',
        default='file_report.json',
        help='Output JSON file'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Simple File Manager (No Database)")
    print("=" * 60)
    
    manager = SimpleFileManager()
    
    stats = manager.analyze_directory(args.directory)
    
    if stats:
        manager.print_stats()
        manager.save_report(args.output)
        return 0
    else:
        print("\n✗ Analysis failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())
