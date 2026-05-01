"""
Image Processor - Generate thumbnails and optimize images
Works with files uploaded through Node.js application
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image
import hashlib
from dotenv import load_dotenv

# Load environment
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(project_root, '.env'))


class ImageProcessor:
    """Process images - generate thumbnails and optimize"""
    
    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    THUMBNAIL_SIZES = {
        'small': (150, 150),
        'medium': (300, 300),
        'large': (600, 600)
    }
    
    def __init__(self, quality=85):
        self.quality = quality
        self.processed_count = 0
        self.error_count = 0
    
    def is_image(self, filepath):
        """Check if file is an image"""
        return Path(filepath).suffix.lower() in self.SUPPORTED_FORMATS
    
    def generate_thumbnail(self, input_path, output_path, size='medium'):
        """Generate thumbnail for image"""
        try:
            if size not in self.THUMBNAIL_SIZES:
                size = 'medium'
            
            thumbnail_size = self.THUMBNAIL_SIZES[size]
            
            with Image.open(input_path) as img:
                # Convert RGBA to RGB if necessary
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                
                # Create thumbnail maintaining aspect ratio
                img.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
                
                # Save thumbnail
                img.save(output_path, 'JPEG', quality=self.quality, optimize=True)
                
            return True
        except Exception as e:
            print(f"✗ Error generating thumbnail for {input_path}: {e}")
            return False
    
    def optimize_image(self, input_path, output_path=None):
        """Optimize image file size"""
        try:
            if output_path is None:
                output_path = input_path
            
            with Image.open(input_path) as img:
                # Convert RGBA to RGB if saving as JPEG
                if img.mode == 'RGBA' and Path(output_path).suffix.lower() in {'.jpg', '.jpeg'}:
                    img = img.convert('RGB')
                
                # Save optimized
                img.save(output_path, quality=self.quality, optimize=True)
            
            return True
        except Exception as e:
            print(f"✗ Error optimizing {input_path}: {e}")
            return False
    
    def get_image_info(self, filepath):
        """Get image information"""
        try:
            with Image.open(filepath) as img:
                return {
                    'format': img.format,
                    'mode': img.mode,
                    'size': img.size,
                    'width': img.width,
                    'height': img.height
                }
        except Exception:
            return None
    
    def process_directory(self, input_dir, output_dir, create_thumbnails=True):
        """Process all images in directory"""
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        
        # Create output directory
        output_path.mkdir(parents=True, exist_ok=True)
        
        if create_thumbnails:
            thumb_path = output_path / 'thumbnails'
            thumb_path.mkdir(exist_ok=True)
        
        # Find all images
        image_files = [
            f for f in input_path.rglob('*')
            if f.is_file() and self.is_image(f)
        ]
        
        print(f"\n📁 Found {len(image_files)} images to process")
        
        for img_file in image_files:
            print(f"\n📷 Processing: {img_file.name}")
            
            # Get relative path to maintain directory structure
            rel_path = img_file.relative_to(input_path)
            out_file = output_path / rel_path
            out_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Get image info
            info = self.get_image_info(img_file)
            if info:
                print(f"   Size: {info['width']}x{info['height']} | Format: {info['format']}")
            
            # Optimize image
            if self.optimize_image(img_file, out_file):
                original_size = img_file.stat().st_size
                optimized_size = out_file.stat().st_size
                saving = ((original_size - optimized_size) / original_size * 100)
                print(f"   ✓ Optimized: {original_size:,} → {optimized_size:,} bytes ({saving:.1f}% reduction)")
                self.processed_count += 1
            else:
                self.error_count += 1
                continue
            
            # Generate thumbnails
            if create_thumbnails:
                for size_name in self.THUMBNAIL_SIZES:
                    thumb_file = thumb_path / size_name / rel_path
                    thumb_file.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Change extension to .jpg for thumbnails
                    thumb_file = thumb_file.with_suffix('.jpg')
                    
                    if self.generate_thumbnail(img_file, thumb_file, size_name):
                        thumb_size = thumb_file.stat().st_size
                        print(f"   ✓ Thumbnail ({size_name}): {thumb_size:,} bytes")
        
        print("\n" + "=" * 60)
        print(f"✓ Processing complete!")
        print(f"   Processed: {self.processed_count}")
        print(f"   Errors: {self.error_count}")
        print("=" * 60)


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(
        description='Process images - optimize and generate thumbnails'
    )
    parser.add_argument(
        '--input',
        required=True,
        help='Input directory containing images'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Output directory for processed images'
    )
    parser.add_argument(
        '--quality',
        type=int,
        default=85,
        help='JPEG quality (1-100, default: 85)'
    )
    parser.add_argument(
        '--no-thumbnails',
        action='store_true',
        help='Skip thumbnail generation'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Image Processor")
    print("=" * 60)
    print(f"Input:  {args.input}")
    print(f"Output: {args.output}")
    print(f"Quality: {args.quality}")
    print(f"Thumbnails: {'No' if args.no_thumbnails else 'Yes'}")
    
    # Validate input directory
    if not os.path.isdir(args.input):
        print(f"\n✗ Error: Input directory '{args.input}' not found")
        return 1
    
    try:
        processor = ImageProcessor(quality=args.quality)
        processor.process_directory(
            args.input,
            args.output,
            create_thumbnails=not args.no_thumbnails
        )
        return 0
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
