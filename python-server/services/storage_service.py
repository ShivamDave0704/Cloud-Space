"""
Cloud storage service for managing file uploads to AWS S3
"""
import boto3
from typing import Optional
import logging

from config import Config

logger = logging.getLogger(__name__)


class StorageService:
    """Manages file storage in cloud (AWS S3)"""
    
    def __init__(self):
        self.s3_client = None
        if Config.AWS_ACCESS_KEY_ID and Config.AWS_SECRET_ACCESS_KEY:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
                region_name=Config.AWS_REGION
            )
    
    def upload(self, file_path: str, user_id: str, filename: str) -> Optional[str]:
        """Upload file to S3"""
        if not self.s3_client:
            logger.warning("S3 client not configured, skipping upload")
            return None
        
        try:
            key = f"{user_id}/{filename}"
            self.s3_client.upload_file(
                file_path,
                Config.AWS_S3_BUCKET,
                key,
                ExtraArgs={'ContentType': 'application/octet-stream'}
            )
            
            url = f"https://{Config.AWS_S3_BUCKET}.s3.{Config.AWS_REGION}.amazonaws.com/{key}"
            logger.info(f"File uploaded to S3: {url}")
            return url
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {str(e)}")
            return None
    
    def download(self, key: str, destination: str) -> bool:
        """Download file from S3"""
        if not self.s3_client:
            return False
        
        try:
            self.s3_client.download_file(
                Config.AWS_S3_BUCKET,
                key,
                destination
            )
            return True
        except Exception as e:
            logger.error(f"Failed to download file from S3: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete file from S3"""
        if not self.s3_client:
            return False
        
        try:
            self.s3_client.delete_object(
                Bucket=Config.AWS_S3_BUCKET,
                Key=key
            )
            logger.info(f"File deleted from S3: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {str(e)}")
            return False
    
    def generate_presigned_url(self, key: str, expiration: int = 3600) -> Optional[str]:
        """Generate presigned URL for temporary access"""
        if not self.s3_client:
            return None
        
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': Config.AWS_S3_BUCKET,
                    'Key': key
                },
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {str(e)}")
            return None
