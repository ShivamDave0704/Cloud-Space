"""
Analytics Processor - Process file usage analytics from Node.js application
Integrates with existing cloud storage database
"""

import os
import sys
import argparse
import psycopg2
from datetime import datetime, timedelta
import json
from dotenv import load_dotenv

# Load environment variables from project root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(project_root, '.env'))


class AnalyticsProcessor:
    """Process analytics data from the database"""
    
    def __init__(self):
        self.conn = self.connect_database()
    
    def connect_database(self):
        """Connect to PostgreSQL database"""
        try:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                raise ValueError("DATABASE_URL not found in environment")
            
            conn = psycopg2.connect(database_url)
            print(f"✓ Connected to database")
            return conn
        except Exception as e:
            print(f"✗ Database connection failed: {e}", file=sys.stderr)
            sys.exit(1)
    
    def get_user_analytics(self, user_id, days=7):
        """Get user analytics for specified number of days"""
        cursor = self.conn.cursor()
        
        try:
            # Query file uploads
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_uploads,
                    SUM(file_size) as total_size,
                    AVG(file_size) as avg_size
                FROM files 
                WHERE user_id = %s 
                AND created_at >= NOW() - INTERVAL '%s days'
            """, (user_id, days))
            
            uploads_data = cursor.fetchone()
            
            # Query file types distribution
            cursor.execute("""
                SELECT 
                    file_type,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM files
                WHERE user_id = %s
                GROUP BY file_type
                ORDER BY count DESC
                LIMIT 10
            """, (user_id,))
            
            file_types = cursor.fetchall()
            
            analytics = {
                'user_id': user_id,
                'period_days': days,
                'total_uploads': uploads_data[0] or 0,
                'total_size_bytes': uploads_data[1] or 0,
                'average_file_size': uploads_data[2] or 0,
                'file_types': [
                    {
                        'type': ft[0],
                        'count': ft[1],
                        'total_size': ft[2]
                    }
                    for ft in file_types
                ],
                'processed_at': datetime.now().isoformat()
            }
            
            return analytics
            
        except Exception as e:
            print(f"✗ Error querying analytics: {e}", file=sys.stderr)
            return None
        finally:
            cursor.close()
    
    def get_system_analytics(self, days=30):
        """Get system-wide analytics"""
        cursor = self.conn.cursor()
        
        try:
            # Total users
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]
            
            # Total files
            cursor.execute("SELECT COUNT(*), SUM(file_size) FROM files")
            files_data = cursor.fetchone()
            
            # New users in period
            cursor.execute("""
                SELECT COUNT(*) FROM users 
                WHERE created_at >= NOW() - INTERVAL '%s days'
            """, (days,))
            new_users = cursor.fetchone()[0]
            
            # Storage by user (top 10)
            cursor.execute("""
                SELECT 
                    u.username,
                    COUNT(f.id) as file_count,
                    SUM(f.file_size) as total_storage
                FROM users u
                LEFT JOIN files f ON u.id = f.user_id
                GROUP BY u.id, u.username
                ORDER BY total_storage DESC NULLS LAST
                LIMIT 10
            """)
            
            top_users = cursor.fetchall()
            
            analytics = {
                'period_days': days,
                'total_users': total_users,
                'new_users': new_users,
                'total_files': files_data[0] or 0,
                'total_storage_bytes': files_data[1] or 0,
                'top_users': [
                    {
                        'username': user[0],
                        'file_count': user[1] or 0,
                        'storage_bytes': user[2] or 0
                    }
                    for user in top_users
                ],
                'processed_at': datetime.now().isoformat()
            }
            
            return analytics
            
        except Exception as e:
            print(f"✗ Error querying system analytics: {e}", file=sys.stderr)
            return None
        finally:
            cursor.close()
    
    def save_analytics_report(self, data, output_file):
        """Save analytics to JSON file"""
        try:
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"✓ Analytics saved to {output_file}")
            return True
        except Exception as e:
            print(f"✗ Error saving analytics: {e}", file=sys.stderr)
            return False
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("✓ Database connection closed")


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(
        description='Process analytics for cloud storage application'
    )
    parser.add_argument(
        '--user-id',
        help='Process analytics for specific user'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=7,
        help='Number of days to analyze (default: 7)'
    )
    parser.add_argument(
        '--output',
        default='analytics_report.json',
        help='Output file path'
    )
    parser.add_argument(
        '--system',
        action='store_true',
        help='Generate system-wide analytics'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Cloud Storage Analytics Processor")
    print("=" * 60)
    
    processor = AnalyticsProcessor()
    
    try:
        if args.user_id:
            print(f"\n📊 Processing user analytics (User: {args.user_id}, Days: {args.days})")
            analytics = processor.get_user_analytics(args.user_id, args.days)
        elif args.system:
            print(f"\n📊 Processing system analytics (Days: {args.days})")
            analytics = processor.get_system_analytics(args.days)
        else:
            print("\n⚠️  Please specify --user-id or --system")
            return 1
        
        if analytics:
            print("\n✓ Analytics processed successfully")
            
            # Display summary
            print("\n" + "=" * 60)
            print("SUMMARY")
            print("=" * 60)
            print(json.dumps(analytics, indent=2))
            
            # Save to file
            processor.save_analytics_report(analytics, args.output)
            return 0
        else:
            print("\n✗ Failed to process analytics")
            return 1
            
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return 1
    finally:
        processor.close()


if __name__ == '__main__':
    sys.exit(main())
