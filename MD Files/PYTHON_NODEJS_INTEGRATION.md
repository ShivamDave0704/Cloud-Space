# 🔗 Integrating Python Scripts with Node.js

This guide shows how to integrate Python processing scripts into your Node.js cloud storage application.

## Why Python + Node.js?

- **Node.js**: Fast, event-driven, great for APIs and real-time features
- **Python**: Excellent for data processing, analytics, image manipulation, ML

## Integration Methods

### 1. Call Python from Node.js Routes

#### Install Child Process Module (Built-in)

```javascript
const { spawn, exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
```

#### Example: Analytics Endpoint

```javascript
// server/routes/analytics.js
const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");

router.get("/generate-report/:userId", async (req, res) => {
  const { userId } = req.params;
  const days = req.query.days || 7;

  try {
    // Call Python script
    const python = spawn("python", [
      "python-scripts/analytics_processor.py",
      "--user-id",
      userId,
      "--days",
      days,
      "--output",
      `reports/user_${userId}.json`,
    ]);

    let output = "";
    let errors = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      errors += data.toString();
    });

    python.on("close", (code) => {
      if (code === 0) {
        // Read the generated report
        const report = require(`../reports/user_${userId}.json`);
        res.json({ success: true, report });
      } else {
        res.status(500).json({
          error: "Analytics generation failed",
          details: errors,
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### Example: Image Processing on Upload

```javascript
// server/routes/files.js
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const filename = req.file.filename;

    // Save file info to database
    const file = await File.create({
      userId: req.user.id,
      filename: filename,
      path: filePath,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });

    // If it's an image, process it with Python
    if (req.file.mimetype.startsWith("image/")) {
      const python = spawn("python", [
        "python-scripts/image_processor.py",
        "--input",
        filePath,
        "--output",
        `thumbnails/${req.user.id}`,
        "--quality",
        "85",
      ]);

      python.on("close", (code) => {
        if (code === 0) {
          console.log(`✓ Thumbnails generated for ${filename}`);
        }
      });
    }

    res.json({
      success: true,
      file: {
        id: file.id,
        filename: file.filename,
        url: `/uploads/${req.user.id}/${filename}`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Background Jobs with node-cron

#### Install node-cron

```bash
npm install node-cron
```

#### Schedule Python Scripts

```javascript
// server/schedulers/index.js
const cron = require("node-cron");
const { exec } = require("child_process");

// Run analytics daily at 2 AM
cron.schedule("0 2 * * *", () => {
  console.log("🔄 Running daily analytics...");

  exec(
    "python python-scripts/analytics_processor.py --system --days 30",
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Analytics error: ${error}`);
        return;
      }
      console.log(`✓ Analytics complete: ${stdout}`);
    },
  );
});

// Cleanup old files weekly (Sundays at 3 AM)
cron.schedule("0 3 * * 0", () => {
  console.log("🗑️  Running weekly cleanup...");

  exec(
    "python python-scripts/cleanup_old_files.py --days 90",
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Cleanup error: ${error}`);
        return;
      }
      console.log(`✓ Cleanup complete: ${stdout}`);
    },
  );
});

// Export for use in main server
module.exports = { startSchedulers: () => console.log("Schedulers started") };
```

```javascript
// server/index.js
const schedulers = require("./schedulers");

// Start schedulers
schedulers.startSchedulers();
```

### 3. Queue-based Processing with Bull

#### Install Bull

```bash
npm install bull
```

#### Setup Queue

```javascript
// server/queues/imageQueue.js
const Bull = require("bull");
const { spawn } = require("child_process");

const imageQueue = new Bull("image-processing", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

// Process images
imageQueue.process(async (job) => {
  const { filePath, userId } = job.data;

  return new Promise((resolve, reject) => {
    const python = spawn("python", [
      "python-scripts/image_processor.py",
      "--input",
      filePath,
      "--output",
      `thumbnails/${userId}`,
    ]);

    python.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Processing failed with code ${code}`));
      }
    });
  });
});

// Export queue
module.exports = imageQueue;
```

```javascript
// server/routes/files.js
const imageQueue = require("../queues/imageQueue");

router.post("/upload", upload.single("file"), async (req, res) => {
  // ... save file ...

  // Add to processing queue
  if (req.file.mimetype.startsWith("image/")) {
    await imageQueue.add({
      filePath: req.file.path,
      userId: req.user.id,
    });
  }

  res.json({
    success: true,
    message: "File uploaded and queued for processing",
  });
});
```

### 4. Async/Await with Promises

```javascript
// server/services/pythonService.js
const { spawn } = require("child_process");

class PythonService {
  static async runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
      const python = spawn("python", [`python-scripts/${scriptName}`, ...args]);

      let output = "";
      let errors = "";

      python.stdout.on("data", (data) => {
        output += data.toString();
      });

      python.stderr.on("data", (data) => {
        errors += data.toString();
      });

      python.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(errors || `Process exited with code ${code}`));
        }
      });
    });
  }

  static async generateAnalytics(userId, days = 7) {
    const output = await this.runScript("analytics_processor.py", [
      "--user-id",
      userId,
      "--days",
      days,
      "--output",
      `temp/analytics_${userId}.json`,
    ]);

    // Read and return the JSON
    const fs = require("fs");
    const report = JSON.parse(
      fs.readFileSync(`temp/analytics_${userId}.json`, "utf8"),
    );
    return report;
  }

  static async processImage(inputPath, outputPath) {
    return await this.runScript("image_processor.py", [
      "--input",
      inputPath,
      "--output",
      outputPath,
    ]);
  }
}

module.exports = PythonService;
```

#### Use in Routes

```javascript
const PythonService = require("../services/pythonService");

router.get("/analytics/report/:userId", async (req, res) => {
  try {
    const report = await PythonService.generateAnalytics(req.params.userId, 30);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## NPM Scripts Integration

Add to `package.json`:

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js",
    "analytics": "python python-scripts/analytics_processor.py --system",
    "cleanup": "python python-scripts/cleanup_old_files.py --days 30",
    "process-images": "python python-scripts/image_processor.py --input uploads --output processed",
    "python:install": "pip install -r python-scripts/requirements.txt"
  }
}
```

Then run:

```bash
npm run analytics
npm run cleanup
npm run process-images
```

## Environment Variables

Both Node.js and Python use the same `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cloud_storage

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# File Storage
UPLOAD_DIR=uploads
THUMBNAIL_DIR=thumbnails

# Python
PYTHON_PATH=python
```

## Error Handling

```javascript
// Robust Python execution with error handling
async function executePythonScript(script, args) {
  try {
    const output = await PythonService.runScript(script, args);
    return { success: true, output };
  } catch (error) {
    console.error(`Python script error: ${error.message}`);

    // Log to database or file
    await logError({
      script,
      error: error.message,
      timestamp: new Date(),
    });

    return { success: false, error: error.message };
  }
}
```

## Testing

```javascript
// tests/pythonIntegration.test.js
const PythonService = require("../server/services/pythonService");

describe("Python Integration", () => {
  test("should generate analytics", async () => {
    const report = await PythonService.generateAnalytics("test-user-id", 7);
    expect(report).toHaveProperty("total_uploads");
    expect(report).toHaveProperty("total_size_bytes");
  });

  test("should handle errors", async () => {
    await expect(
      PythonService.generateAnalytics("invalid-id", 7),
    ).rejects.toThrow();
  });
});
```

## Best Practices

1. **Use Absolute Paths**: Always use full paths for scripts
2. **Error Handling**: Always catch and log errors
3. **Timeouts**: Set timeouts for long-running scripts
4. **Logging**: Log all Python script executions
5. **Testing**: Test integration thoroughly
6. **Environment**: Use same .env for both
7. **Dependencies**: Document Python requirements
8. **Monitoring**: Monitor script execution times

## Quick Start

1. Install Python dependencies:

```bash
pip install -r python-scripts/requirements.txt
```

2. Test Python script directly:

```bash
python python-scripts/analytics_processor.py --system
```

3. Integrate in Node.js:

```javascript
const result = await PythonService.generateAnalytics(userId);
```

4. Done! Python and Node.js working together! 🎉
