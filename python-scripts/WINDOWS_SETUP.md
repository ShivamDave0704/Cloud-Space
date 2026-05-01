# 🐍 Python Scripts - Quick Setup Guide (Windows)

## Quick Install (Windows)

### Step 1: Install Minimal Dependencies

```powershell
# Install only the essential package
pip install python-dotenv
```

That's it! You can now run the simple scripts.

### Step 2: Test Without Database

```powershell
# Run the simple file manager (no database needed)
python python-scripts/simple_file_manager.py --directory uploads
```

## Optional Dependencies

Install these only if you need specific features:

### For Image Processing

```powershell
pip install Pillow
```

Then you can use:

```powershell
python python-scripts/image_processor.py --input uploads --output thumbnails
```

### For Database Features (PostgreSQL)

**Option 1: Using pre-built wheel (Recommended for Windows)**

```powershell
# Try to install pre-built binary only
pip install psycopg2-binary --only-binary :all:
```

**Option 2: Alternative database package**

```powershell
# If psycopg2 fails, you can use the scripts without database
# Or modify scripts to use SQLite (built into Python)
```

**Option 3: Install PostgreSQL first**

If you really need psycopg2:

1. Download PostgreSQL: https://www.postgresql.org/download/windows/
2. Install it
3. Add PostgreSQL bin to PATH: `C:\Program Files\PostgreSQL\15\bin`
4. Then: `pip install psycopg2-binary`

## Available Scripts by Dependency

### ✅ No Dependencies Required

**simple_file_manager.py** - File analysis without database

```powershell
python python-scripts/simple_file_manager.py --directory uploads
```

### 📦 Requires: python-dotenv only

Most scripts only need:

```powershell
pip install python-dotenv
```

### 🖼️ Requires: Pillow

**image_processor.py** - Image thumbnails and optimization

```powershell
pip install Pillow
python python-scripts/image_processor.py --input uploads --output thumbnails
```

### 🗄️ Requires: psycopg2-binary

**analytics_processor.py** - Database analytics
**cleanup_old_files.py** - Database cleanup

Only install if you have PostgreSQL:

```powershell
pip install psycopg2-binary --only-binary :all:
```

## Troubleshooting

### Error: pg_config not found

**Solution:** Skip database scripts for now, or:

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. Add to PATH: `C:\Program Files\PostgreSQL\15\bin`
3. Restart PowerShell
4. Try again: `pip install psycopg2-binary`

### Alternative: Use SQLite (Built-in)

Python comes with SQLite, no installation needed:

```python
import sqlite3
conn = sqlite3.connect('database.db')
```

### Module Not Found

```powershell
# Make sure you're installing for the right Python
python -m pip install package-name

# Or specify Python path
C:\Users\YourName\AppData\Local\Programs\Python\Python313\python.exe -m pip install package-name
```

### Permission Denied

```powershell
# Install for user only
pip install --user package-name
```

## Quick Commands

```powershell
# 1. Install minimal requirements
pip install python-dotenv

# 2. Test simple script (no database)
python python-scripts/simple_file_manager.py

# 3. Install image processing (optional)
pip install Pillow

# 4. Process images
python python-scripts/image_processor.py --input uploads --output processed
```

## Integration with Node.js

Even with minimal Python setup, you can:

```javascript
// In your Node.js code
const { spawn } = require("child_process");

// Use simple file manager
const python = spawn("python", [
  "python-scripts/simple_file_manager.py",
  "--directory",
  "uploads",
]);

python.on("close", (code) => {
  console.log("File analysis complete!");
});
```

## Summary

| Feature            | Requires        | Command                  |
| ------------------ | --------------- | ------------------------ |
| File Analysis      | python-dotenv   | `simple_file_manager.py` |
| Image Processing   | Pillow          | `image_processor.py`     |
| Database Analytics | psycopg2-binary | `analytics_processor.py` |
| Database Cleanup   | psycopg2-binary | `cleanup_old_files.py`   |

**Start simple, add features as needed!** 🚀
