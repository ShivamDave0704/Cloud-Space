# 🐍 Python Integration Scripts

This directory contains Python scripts that integrate with the Node.js cloud storage application.

## Purpose

These Python scripts handle:

- **Data Analytics** - Process and analyze file usage data
- **Machine Learning** - File classification, duplicate detection
- **Batch Processing** - Bulk operations on files
- **Database Management** - Data migrations and cleanup
- **Report Generation** - PDF reports, statistics
- **Image Processing** - Thumbnail generation, compression

## Setup

### Prerequisites

- Python 3.9+
- Node.js server running
- Access to same database

### Installation

```bash
# Install Python dependencies
pip install -r python-scripts/requirements.txt
```

### Configuration

Python scripts use the same database as Node.js:

- Reads from `.env` file in project root
- Shares PostgreSQL database
- Can access uploaded files

## Available Scripts

### 📊 Analytics Scripts

#### `analytics_processor.py`

Process file usage analytics and generate insights

```bash
python python-scripts/analytics_processor.py
```

#### `generate_report.py`

Generate PDF reports for users

```bash
python python-scripts/generate_report.py --user-id <id> --period month
```

### 🖼️ Image Processing

#### `image_processor.py`

Generate thumbnails and optimize images

```bash
python python-scripts/image_processor.py --input uploads/ --output thumbnails/
```

### 🔄 Background Jobs

#### `cleanup_old_files.py`

Clean up old temporary files

```bash
python python-scripts/cleanup_old_files.py --days 30
```

#### `database_backup.py`

Backup database to cloud storage

```bash
python python-scripts/database_backup.py
```

### 🤖 Machine Learning

#### `duplicate_detector.py`

Find duplicate files using content hashing

```bash
python python-scripts/duplicate_detector.py
```

#### `file_classifier.py`

Classify files by content type

```bash
python python-scripts/file_classifier.py
```

## Integration with Node.js

### Method 1: Call from Node.js

```javascript
// In your Node.js code
const { spawn } = require("child_process");

function processAnalytics(userId) {
  const python = spawn("python", [
    "python-scripts/analytics_processor.py",
    userId,
  ]);

  python.stdout.on("data", (data) => {
    console.log(`Analytics: ${data}`);
  });

  return new Promise((resolve, reject) => {
    python.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(`Exit code ${code}`));
    });
  });
}
```

### Method 2: Schedule with Node.js Cron

```javascript
// In your Node.js scheduler
const cron = require("node-cron");
const { exec } = require("child_process");

// Run analytics daily at 2 AM
cron.schedule("0 2 * * *", () => {
  exec(
    "python python-scripts/analytics_processor.py",
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
        return;
      }
      console.log(`Analytics completed: ${stdout}`);
    },
  );
});
```

### Method 3: API Endpoints

```javascript
// In your Express routes
app.post("/api/admin/generate-report", async (req, res) => {
  const { userId, period } = req.body;

  try {
    await execPython("generate_report.py", [userId, period]);
    res.json({ success: true, message: "Report generated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Database Access

Python scripts connect to the same PostgreSQL database:

```python
import os
import psycopg2
from dotenv import load_dotenv

# Load environment from project root
load_dotenv('../.env')

# Connect to database
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
```

## Running Scripts

### Manual Execution

```bash
python python-scripts/script_name.py --arg value
```

### From Node.js

```javascript
const { exec } = require("child_process");
exec("python python-scripts/script_name.py", callback);
```

### Scheduled (package.json)

```json
{
  "scripts": {
    "analytics": "python python-scripts/analytics_processor.py",
    "cleanup": "python python-scripts/cleanup_old_files.py"
  }
}
```

Then run: `npm run analytics`

## Best Practices

1. **Error Handling** - Always handle errors and log them
2. **Environment Variables** - Use `.env` for configuration
3. **Logging** - Log to files for debugging
4. **Exit Codes** - Return proper exit codes (0 = success)
5. **Documentation** - Comment your code
6. **Testing** - Write tests for scripts

## Troubleshooting

### Python not found

```bash
# Make sure Python is in PATH
python --version

# Or use full path
C:\Python311\python.exe python-scripts/script.py
```

### Module not found

```bash
pip install -r python-scripts/requirements.txt
```

### Database connection error

- Check DATABASE_URL in `.env`
- Ensure PostgreSQL is running
- Verify credentials

## Development

Add new scripts following this pattern:

```python
#!/usr/bin/env python3
"""
Script description here
"""

import argparse
import sys
from utils import load_config, get_db_connection

def main():
    parser = argparse.ArgumentParser(description='Script description')
    parser.add_argument('--input', required=True, help='Input parameter')
    args = parser.parse_args()

    try:
        # Your logic here
        print("Success!")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
```

## License

MIT - Same as main project
