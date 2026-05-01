import fs from "fs";
import multer from "multer";
import path from "path";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import {
  logChunkMergeDone,
  logChunkMergeStart,
  logChunkUpload,
} from "./utils/cool-logger.js";
import * as Kundli from "./utils/pay-kundli-manager.js";

// Attach upload and file routes
export function registerUploadRoutes(core) {
  const { app, paths, helpers, config } = core;
  const { uploadsDir, filesMetaFile, usersFile, getFilePath } = paths;
  const {
    safeName,
    normalizeEmail,
    resolveUserContext,
    resolveUploadedBy,
    ensureUserDirs,
  } = helpers;
  const verifyToken =
    helpers && helpers.verifyToken ? helpers.verifyToken : null;

  // Add cloudCoinsFile path for coin rewards
  const cloudCoinsFile = path.join(
    path.dirname(usersFile),
    "coins",
    "cloud-coins.json",
  );

  // Helper: read plan-active snapshot for storage limits
  function readPlanActiveFile() {
    try {
      return Kundli.getPlanActiveList();
    } catch (err) {
      console.error(
        "⚠️ Failed to read plan-active from USER-pay-kundli.JSON",
        err,
      );
      return [];
    }
  }

  function getActivePlanSnapshot(uid) {
    const planActive = readPlanActiveFile();
    const entry = planActive.find(
      (u) => u?.uid === uid || u?.self?.uid === uid,
    );
    if (!entry)
      return {
        plan: "free",
        storageTB: 0.5,
        planExpiry: null,
        purchasedAt: null,
      };

    const isPlanCurrentlyActive = (plan) => {
      if (!plan || typeof plan !== "object") return false;

      const status = plan.status || {};
      const tx = plan.transaction || {};
      const now = Date.now();

      const expiresAt =
        tx.expiresAt || status.expiresAt || plan.expiresAt || null;
      const expiryTs = expiresAt ? new Date(expiresAt).getTime() : null;
      const isExpired =
        typeof expiryTs === "number" &&
        Number.isFinite(expiryTs) &&
        expiryTs <= now;

      const statusText = String(
        status.status || plan.status || tx.status || "",
      ).toLowerCase();

      const explicitInactive =
        status.planActive === false ||
        status.isActive === false ||
        plan.isActive === false ||
        tx.isActive === false ||
        status.isBlocked === true ||
        plan.isBlocked === true ||
        tx.isBlocked === true ||
        ["inactive", "blocked", "expired", "deactivated", "deleted"].includes(
          statusText,
        ) ||
        isExpired;

      if (explicitInactive) return false;

      const explicitActive =
        status.planActive === true ||
        status.isActive === true ||
        plan.isActive === true ||
        tx.isActive === true ||
        ["active", "completed"].includes(statusText);

      if (explicitActive) return true;

      return (
        typeof expiryTs === "number" &&
        Number.isFinite(expiryTs) &&
        expiryTs > now
      );
    };

    const getPlanTs = (plan) => {
      const candidates = [
        plan?.transaction?.activatedAt,
        plan?.activatedAt,
        plan?.transaction?.purchasedAt,
        plan?.purchasedAt,
        plan?.createdAt,
      ];
      for (const value of candidates) {
        const ts = new Date(value || 0).getTime();
        if (Number.isFinite(ts) && ts > 0) return ts;
      }
      return 0;
    };

    const candidates = (entry.plans || [])
      .filter((p) => isPlanCurrentlyActive(p))
      .sort((a, b) => getPlanTs(b) - getPlanTs(a));

    const chosen = candidates[0] || null;
    if (!chosen)
      return {
        plan: "free",
        storageTB: 0.5,
        planExpiry: null,
        purchasedAt: null,
      };

    const expiresAt = chosen.transaction?.expiresAt || chosen.expiresAt;
    const planExpiry = expiresAt ? new Date(expiresAt).getTime() : null;
    const storageTB =
      chosen.planDetails?.storageTB ??
      chosen.storageTB ??
      chosen.storage ??
      0.5;
    const purchasedAt =
      chosen.transaction?.purchasedAt || chosen.purchasedAt
        ? new Date(
            chosen.transaction?.purchasedAt || chosen.purchasedAt,
          ).getTime()
        : null;
    return {
      plan: chosen.plan || chosen.planDetails?.key || "free",
      storageTB,
      planExpiry,
      purchasedAt,
    };
  }

  function getDirectUserPlanSnapshot(user) {
    if (!user || typeof user !== "object") {
      return {
        plan: "free",
        storageTB: 0.5,
        planExpiry: null,
        purchasedAt: null,
      };
    }

    const purchases = Array.isArray(user.purchases) ? user.purchases : [];

    const isCurrentlyActive = (row) => {
      if (!row || typeof row !== "object") return false;

      const status = row.status || {};
      const tx = row.transaction || {};
      const now = Date.now();

      const expiresAt =
        tx.expiresAt || status.expiresAt || row.expiresAt || null;
      const expiryTs = expiresAt ? new Date(expiresAt).getTime() : null;
      const isExpired =
        typeof expiryTs === "number" &&
        Number.isFinite(expiryTs) &&
        expiryTs <= now;

      const statusText = String(
        status.status || row.status || tx.status || "",
      ).toLowerCase();

      const explicitInactive =
        status.planActive === false ||
        status.isActive === false ||
        row.isActive === false ||
        tx.isActive === false ||
        status.isBlocked === true ||
        row.isBlocked === true ||
        tx.isBlocked === true ||
        ["inactive", "blocked", "expired", "deactivated", "deleted"].includes(
          statusText,
        ) ||
        isExpired;

      if (explicitInactive) return false;

      const explicitActive =
        status.planActive === true ||
        status.isActive === true ||
        row.isActive === true ||
        tx.isActive === true ||
        ["active", "completed"].includes(statusText);

      if (explicitActive) return true;

      return (
        typeof expiryTs === "number" &&
        Number.isFinite(expiryTs) &&
        expiryTs > now
      );
    };

    const getTs = (row) => {
      const candidates = [
        row?.transaction?.activatedAt,
        row?.transaction?.purchasedAt,
        row?.activatedAt,
        row?.purchasedAt,
        row?.createdAt,
      ];
      for (const value of candidates) {
        const ts = new Date(value || 0).getTime();
        if (Number.isFinite(ts) && ts > 0) return ts;
      }
      return 0;
    };

    const candidates = [...purchases]
      .filter((row) => isCurrentlyActive(row))
      .sort((a, b) => getTs(b) - getTs(a));

    const chosen = candidates[0] || null;
    if (!chosen) {
      return {
        plan: "free",
        storageTB: 0.5,
        planExpiry: null,
        purchasedAt: null,
      };
    }

    const storageTB =
      chosen?.planDetails?.storageTB ??
      chosen?.storageTB ??
      chosen?.storage ??
      0.5;
    const expiresAt = chosen?.expiresAt || null;
    const purchasedAt = chosen?.purchasedAt || chosen?.activatedAt || null;

    return {
      plan: chosen?.plan || chosen?.planDetails?.key || "free",
      storageTB,
      planExpiry: expiresAt ? new Date(expiresAt).getTime() : null,
      purchasedAt: purchasedAt ? new Date(purchasedAt).getTime() : null,
    };
  }

  // Resolve email for uploads even before body parsing (multer destination)
  function resolveUploadEmail(req) {
    const ctx = resolveUserContext(req);
    if (ctx.email && ctx.email.includes("@")) return ctx.email;

    // If header x-user is an email, use it; if UID, map via users.json
    const xUser = req.headers["x-user"];
    if (xUser) {
      const maybeEmail = normalizeEmail(xUser);
      if (maybeEmail.includes("@")) return maybeEmail;
      // treat as UID
      try {
        const users = Kundli.getUsersList();
        const found = users.find(
          (u) => u.uid === xUser || normalizeEmail(u.email) === maybeEmail,
        );
        if (found?.email) return normalizeEmail(found.email);
      } catch (err) {
        console.warn(
          "⚠️ x-user lookup failed in resolveUploadEmail",
          err.message,
        );
      }
    }

    // Try UID lookup in users.json using any UID hints
    const uid =
      ctx.uid || ctx.id || req.query?.uid || req.headers["x-uid"] || xUser;
    if (uid) {
      try {
        const users = Kundli.getUsersList();
        const found = users.find((u) => u.uid === uid);
        if (found?.email) return normalizeEmail(found.email);
      } catch (err) {
        console.warn("⚠️ UID lookup failed in resolveUploadEmail", err.message);
      }
    }

    // Try reference token from query/header/cookie
    const token =
      req.query?.token ||
      req.headers["x-access-token"] ||
      req.headers["authorization"]?.split(" ")[1];
    if (token) {
      try {
        const ref = validateToken(token);
        if (ref?.email) return normalizeEmail(ref.email);
      } catch (err) {
        /* ignore */
      }
    }

    // Try Referer query params (ultra pages send token+uid)
    if (req.headers?.referer) {
      try {
        const url = new URL(req.headers.referer);
        const uidRef = url.searchParams.get("uid");
        const tokenRef = url.searchParams.get("token");
        if (uidRef && fs.existsSync(usersFile)) {
          const users = JSON.parse(fs.readFileSync(usersFile, "utf8") || "[]");
          const found = users.find((u) => u.uid === uidRef);
          if (found?.email) return normalizeEmail(found.email);
        }
        if (tokenRef) {
          const ref = validateToken(tokenRef);
          if (ref?.email) return normalizeEmail(ref.email);
        }
      } catch (err) {
        /* ignore */
      }
    }

    return null;
  }

  // Storage for normal file uploads
  const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const email = resolveUploadEmail(req);
      if (!email) {
        return cb(new Error("Email required for upload destination"), null);
      }
      const userFolder = ensureUserDirs(email, null);
      cb(null, userFolder.files);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });
  const uploadFiles = multer({ storage: fileStorage });

  // Storage for chunk uploads
  const chunkStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const email = resolveUploadEmail(req);
      if (!email) {
        return cb(new Error("Email required for chunk upload"), null);
      }
      const uploadedBy = safeName(email);
      const fileId =
        req.query.fileId || req.headers["x-file-id"] || req.body.fileId;
      if (!fileId) {
        console.error("❌ fileId missing in request!");
        return cb(new Error("Missing fileId"), null);
      }

      const tempDir = path.join(uploadsDir, uploadedBy, "chunks", fileId);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const chunkIndexRaw =
        req.query.chunkIndex ??
        req.headers["x-chunk-index"] ??
        req.body.chunkIndex;
      const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
      logChunkUpload(
        uploadedBy,
        fileId,
        Number.isFinite(chunkIndex) ? chunkIndex : null,
      );
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      let chunkIndex = 0;

      if (req.query.chunkIndex !== undefined) {
        chunkIndex = parseInt(req.query.chunkIndex, 10);
      } else if (req.headers["x-chunk-index"] !== undefined) {
        chunkIndex = parseInt(req.headers["x-chunk-index"], 10);
      } else if (req.body.chunkIndex !== undefined) {
        chunkIndex = parseInt(req.body.chunkIndex, 10);
      }

      if (isNaN(chunkIndex)) chunkIndex = 0;
      cb(null, `${chunkIndex}.part`);
    },
  });

  const uploadChunk = multer({ storage: chunkStorage });

  // ============ Routes ============
  app.post("/upload", uploadFiles.array("files"), (req, res) => {
    try {
      if (!req.files?.length)
        return res.status(400).json({ error: "No files uploaded" });

      const email = resolveUploadEmail(req) || resolveUserContext(req).email;
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Email required for upload" });
      }

      const ctx = resolveUserContext(req);
      const host = req.headers.host || `localhost:${config.PORT}`;
      const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http")
        .toString()
        .split(",")[0]
        .trim();
      const baseUrl = `${proto}://${host}`;

      try {
        var filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));
      } catch (err) {
        filesMeta = [];
      }

      const fileUrls = req.files.map((file) => {
        const dirs = ensureUserDirs(email, null);
        const uploadedBy = email;
        const ext =
          path.extname(file.originalname).substring(1).toLowerCase() ||
          "unknown";

        const fileData = {
          filename: file.filename,
          originalname: file.originalname,
          bytes: file.size,
          fileType: ext,
          created_at: new Date().toISOString(),
          secure_url: `${baseUrl}/uploads/${dirs.pathSegment}/files/${file.filename}`,
          format: ext,
          uploadedBy,
          ownerEmail: email || null,
          ownerUid: ctx.uid || null,
        };
        filesMeta.push(fileData);
        return fileData;
      });

      // Send response immediately, then log asynchronously
      const uploadColors = {
        cyan: "\x1b[36m",
        yellow: "\x1b[33m",
        white: "\x1b[37m",
        reset: "\x1b[0m",
        bright: "\x1b[1m",
      };
      console.log(
        `${uploadColors.bright}${uploadColors.cyan}📤 Upload Started: ${uploadColors.yellow}${email} ${uploadColors.white}| Files: ${uploadColors.yellow}${req.files.length}${uploadColors.reset}`,
      );
      res.json({ message: "✅ Files uploaded successfully", files: fileUrls });

      // Async file metadata and logging (non-blocking)
      setImmediate(() => {
        try {
          fs.writeFileSync(
            filesMetaFile,
            JSON.stringify(filesMeta, null, 2),
            "utf8",
          );
          // Removed: console.log(`✅ Updated files.json with ${req.files.length} file(s)`);
        } catch (err) {
          console.error(`❌ Failed to write filesMetaFile:`, err.message);
        }

        // Award coins for every 200 files uploaded (100 coins per 200 files)
        try {
          let cloudCoins = [];
          if (fs.existsSync(cloudCoinsFile)) {
            const coinData = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
            cloudCoins = coinData.trim() ? JSON.parse(coinData) : [];
          }

          let uid = ctx.uid || ctx.id || null;
          let username = ctx.username || null;

          if ((!uid || !username) && fs.existsSync(usersFile)) {
            try {
              const users = JSON.parse(
                fs.readFileSync(usersFile, "utf8") || "[]",
              );
              const found = users.find(
                (u) => normalizeEmail(u.email) === normalizeEmail(email),
              );
              if (found) {
                uid = uid || found.uid;
                username = username || found.username;
              }
            } catch (lookupErr) {
              // Removed: console.warn("⚠️ User lookup failed for coins award:", lookupErr.message);
            }
          }

          let userCoins = cloudCoins.find((c) => c.userUID === uid);
          if (!userCoins && email) {
            userCoins = cloudCoins.find(
              (c) => normalizeEmail(c.email) === normalizeEmail(email),
            );
          }

          if (!userCoins) {
            userCoins = {
              userUID: uid || email || "Unknown",
              email: email,
              username: username || "Unknown",
              balance: 0,
              createdAt: new Date().toISOString(),
              transactions: [],
            };
            cloudCoins.push(userCoins);
          } else {
            if (uid && userCoins.userUID !== uid) userCoins.userUID = uid;
            if (email && userCoins.email !== email) userCoins.email = email;
            if (username && userCoins.username !== username)
              userCoins.username = username;
          }

          // Check total file count to determine coin award (100 coins per 200 files)
          const userFiles = filesMeta.filter((f) => f.ownerEmail === email);
          const totalUserFiles = userFiles.length;
          const milestoneSize = 200; // award every 200 files
          const coinsPerMilestone = 100; // 100 coins per milestone
          const previousMilestones = Math.floor(
            (totalUserFiles - req.files.length) / milestoneSize,
          );
          const currentMilestones = Math.floor(totalUserFiles / milestoneSize);
          const coinsEarned =
            (currentMilestones - previousMilestones) * coinsPerMilestone;

          if (coinsEarned > 0) {
            userCoins.balance += coinsEarned;
            userCoins.transactions.push({
              id:
                "UPLOAD-" +
                Math.random().toString(36).substring(2, 12).toUpperCase(),
              type: "file_upload_bonus",
              amount: coinsEarned,
              reason: `Uploaded ${req.files.length} files (${totalUserFiles} total files)`,
              timestamp: new Date().toISOString(),
            });

            // Ensure directory exists
            const coinDir = path.dirname(cloudCoinsFile);
            if (!fs.existsSync(coinDir)) {
              fs.mkdirSync(coinDir, { recursive: true });
            }

            fs.writeFileSync(
              cloudCoinsFile,
              JSON.stringify(cloudCoins, null, 2),
              "utf8",
            );
            syncCoinsLedgerFromWallets(path.dirname(usersFile), cloudCoins);
            const coinColors = {
              green: "\x1b[32m",
              yellow: "\x1b[33m",
              cyan: "\x1b[36m",
              magenta: "\x1b[35m",
              white: "\x1b[37m",
              reset: "\x1b[0m",
              bright: "\x1b[1m",
            };
            // Log coin award only once (IMPORTANT NOTICE)
            console.log(
              `${coinColors.bright}${coinColors.green}✅ Upload Complete: ${coinColors.cyan}${email} ${coinColors.white}| Files: ${coinColors.yellow}${req.files.length} ${coinColors.white}| 💰 Awarded: ${coinColors.yellow}+${coinsEarned} coins ${coinColors.white}(Total: ${coinColors.yellow}${totalUserFiles}${coinColors.white})${coinColors.reset}`,
            );
          }
        } catch (coinErr) {
          const coinColors = {
            red: "\x1b[31m",
            yellow: "\x1b[33m",
            reset: "\x1b[0m",
            bright: "\x1b[1m",
          };
          console.error(
            `${coinColors.bright}${coinColors.red}⚠️ Failed to award coins for upload: ${coinColors.yellow}${coinErr.message}${coinColors.reset}`,
          );
        }

        // Log to uploads.log
        try {
          const { uploadsLog } = paths;
          const timestamp = new Date().toISOString();
          const fileTypes = req.files
            .map((f) => {
              const ext =
                path.extname(f.originalname).substring(1).toLowerCase() ||
                "unknown";
              return `${f.originalname} (${ext})`;
            })
            .join(", ");
          const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
          const logMessage = `[${timestamp}] User: ${email} | Files: ${req.files.length} | Types: ${fileTypes} | Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`;
          fs.appendFileSync(uploadsLog, logMessage, "utf8");
        } catch (logErr) {
          console.warn("⚠️ Failed to write uploads.log:", logErr.message);
        }
      });
    } catch (err) {
      console.error(`❌ /upload error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/upload-chunk", uploadChunk.single("chunk"), (req, res) => {
    const chunkIndex =
      req.query.chunkIndex ||
      req.body.chunkIndex ||
      req.headers["x-chunk-index"];
    res.json({ message: `✅ Chunk ${chunkIndex} stored` });
  });

  app.post("/merge-chunks", (req, res) => {
    const { fileId, fileName } = req.body;
    const uploadedBy = req.body.uploadedBy || resolveUploadedBy(req);
    const ctx = resolveUserContext(req);
    const email = normalizeEmail(
      ctx.email || uploadedBy || req.headers["x-email"] || "",
    );

    if (!fileId || !fileName || !email || !email.includes("@")) {
      return res.status(400).json({
        error:
          "❌ Missing fileId, fileName or uploadedBy (valid email required)",
      });
    }

    const storageKey = safeName(email);
    const chunkDir = path.join(uploadsDir, storageKey, "chunks", fileId);
    const finalDir = path.join(uploadsDir, storageKey, "files");
    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

    let chunkFiles = fs
      .readdirSync(chunkDir)
      .filter((f) => f.endsWith(".part"));
    if (chunkFiles.length === 0) {
      return res.status(400).json({ error: "❌ No chunks found for file" });
    }

    chunkFiles.sort((a, b) => parseInt(a) - parseInt(b));
    logChunkMergeStart(fileId, chunkFiles.length, chunkFiles);

    const finalPath = path.join(finalDir, fileName);
    const writeStream = fs.createWriteStream(finalPath);

    let idx = 0;
    function appendNext() {
      if (idx >= chunkFiles.length) {
        writeStream.end();
        fs.rmSync(chunkDir, { recursive: true, force: true });

        let filesMeta = JSON.parse(fs.readFileSync(filesMetaFile));
        const host = req.headers.host || `localhost:${config.PORT}`;
        const proto = (
          req.headers["x-forwarded-proto"] ||
          req.protocol ||
          "http"
        )
          .toString()
          .split(",")[0]
          .trim();
        const baseUrl = `${proto}://${host}`;
        const ext =
          path.extname(fileName).substring(1).toLowerCase() || "unknown";
        const fileSizeBytes = fs.statSync(finalPath).size;
        const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

        const fileData = {
          filename: path.basename(finalPath),
          originalname: fileName,
          bytes: fileSizeBytes,
          fileType: ext,
          created_at: new Date().toISOString(),
          secure_url: `${baseUrl}/uploads/${storageKey}/files/${path.basename(finalPath)}`,
          format: ext,
          uploadedBy: email,
        };
        filesMeta.push(fileData);

        // Send response immediately
        res.json({ message: "✅ File merged successfully", file: fileData });

        // Write metadata and logs asynchronously (non-blocking)
        setImmediate(() => {
          try {
            fs.writeFileSync(filesMetaFile, JSON.stringify(filesMeta, null, 2));
            logChunkMergeDone(fileName, ext, fileSizeMB, email);
          } catch (err) {
            console.error(
              `❌ Failed to write filesMetaFile after merge:`,
              err.message,
            );
          }

          // Log to uploads.log
          try {
            const { uploadsLog } = paths;
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] Merged: ${fileName} (${ext}) - ${fileSizeMB} MB for ${email}\n`;
            fs.appendFileSync(uploadsLog, logMessage, "utf8");
          } catch (logErr) {
            console.warn("⚠️ Failed to write uploads.log:", logErr.message);
          }
        });

        return;
      }

      const chunkPath = path.join(chunkDir, chunkFiles[idx]);
      const readStream = fs.createReadStream(chunkPath);

      readStream.pipe(writeStream, { end: false });
      readStream.on("end", () => {
        fs.unlinkSync(chunkPath);
        idx++;
        appendNext();
      });
      readStream.on("error", (err) => {
        console.error("❌ Merge error at:", chunkPath, err);
        res
          .status(500)
          .json({ error: "Failed during merge", details: err.message });
      });
    }

    appendNext();
  });

  app.get("/files", (req, res) => {
    try {
      let filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));
      res.json(filesMeta);
    } catch (err) {
      console.error("❌ Error reading files:", err);
      res.status(500).json({ error: "Failed to fetch all files" });
    }
  });

  // Get current user's uploaded files
  app.get(
    "/files/my-files",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userEmail = req.user?.email;
        const userUID = req.user?.uid;

        if (!userEmail && !userUID) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        let filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));

        // Filter files uploaded by this user (match by email or UID)
        const myFiles = filesMeta.filter(
          (f) =>
            f.uploadedBy === userEmail || (userUID && f.uploadedBy === userUID),
        );

        res.json(myFiles);
      } catch (err) {
        console.error("❌ Error reading my files:", err);
        res.status(500).json({ error: "Failed to fetch your files" });
      }
    },
  );

  app.get("/files/:email", (req, res) => {
    try {
      let ownerParam = req.params.email;

      // Check if ownerParam is a UID (like USR-XXXXXXX) instead of email
      if (ownerParam.startsWith("USR-") || !ownerParam.includes("@")) {
        // Resolve UID to email using Kundli manager
        const user = Kundli.getUserByUID(ownerParam);
        if (user) {
          ownerParam = user.email;
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      }

      const normalizedEmail = normalizeEmail(ownerParam);
      const safeKey = safeName(normalizedEmail || ownerParam);

      try {
        var filesMeta = JSON.parse(
          fs.readFileSync(filesMetaFile, "utf8") || "[]",
        );
      } catch (fileErr) {
        filesMeta = [];
      }
      const userFiles = filesMeta.filter(
        (f) => safeName(normalizeEmail(f.uploadedBy || "")) === safeKey,
      );

      res.json(userFiles);
    } catch (err) {
      console.error("❌ Error reading user files:", err);
      res.status(500).json({ error: "Failed to fetch user files" });
    }
  });

  app.get("/storage/:email", (req, res) => {
    try {
      let ownerParam = req.params.email;

      // Check if ownerParam is a UID (like USR-XXXXXXX) instead of email
      if (ownerParam.startsWith("USR-") || !ownerParam.includes("@")) {
        // Resolve UID to email using Kundli manager
        const user = Kundli.getUserByUID(ownerParam);
        if (user) {
          ownerParam = user.email;
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      }

      const normalizedEmail = normalizeEmail(ownerParam);
      const safeKey = safeName(normalizedEmail || ownerParam);

      // Use Kundli manager to get user data
      const user = Kundli.getUserByEmail(normalizedEmail);

      const snapshotFromPurchases = getDirectUserPlanSnapshot(user);
      const uiAccessPlan = String(user?.uiAccess || "").toLowerCase();

      let snapshot = snapshotFromPurchases;
      if (
        snapshot.plan === "free" &&
        ["platinum", "ultra"].includes(uiAccessPlan)
      ) {
        snapshot = {
          plan: uiAccessPlan,
          storageTB: uiAccessPlan === "ultra" ? 200 : 100,
          planExpiry: null,
          purchasedAt: null,
        };
      }
      const now = Date.now();
      const DEFAULT_FREE_TB = 0.5;
      const quotaTB = Number(user?.storageQuotaTB);
      const hasStoredQuota = Number.isFinite(quotaTB) && quotaTB > 0;
      const isDefaultResetQuota =
        hasStoredQuota && Math.abs(quotaTB - DEFAULT_FREE_TB) < 1e-9;
      const hasCustomQuota = hasStoredQuota && !isDefaultResetQuota;
      const snapshotStorageTB = Number(snapshot?.storageTB);
      let maxTB = hasCustomQuota
        ? quotaTB
        : Number.isFinite(snapshotStorageTB) && snapshotStorageTB > 0
          ? snapshotStorageTB
          : DEFAULT_FREE_TB;
      if (!hasCustomQuota && snapshot.planExpiry && snapshot.planExpiry < now) {
        maxTB = DEFAULT_FREE_TB;
      }
      if (!Number.isFinite(maxTB) || maxTB <= 0) {
        maxTB = DEFAULT_FREE_TB;
      }
      const maxBytes = maxTB * 1024 * 1024 * 1024 * 1024;

      let filesMeta = [];
      try {
        filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8") || "[]");
      } catch (fileErr) {
        console.error("⚠️ Failed to read files metadata:", fileErr.message);
      }
      const userFiles = filesMeta.filter(
        (f) => safeName(normalizeEmail(f.uploadedBy || "")) === safeKey,
      );
      const usedBytes = userFiles.reduce((sum, f) => sum + (f.bytes || 0), 0);
      const usedGB = usedBytes / 1024 ** 3;
      const percent = ((usedBytes / maxBytes) * 100).toFixed(2);

      res.json({
        email: user?.email || normalizedEmail,
        usedBytes,
        usedGB,
        maxGB: maxTB * 1024,
        usedFormatted: `${usedGB.toFixed(2)} GB`,
        percent: percent > 100 ? 100 : percent,
      });
    } catch (err) {
      console.error("❌ Error fetching storage info:", err);
      res.status(500).json({ error: "Failed to fetch storage info" });
    }
  });

  app.get("/download/:uploadedBy/:filename", (req, res) => {
    const { uploadedBy, filename } = req.params;
    const safeEmail = safeName(normalizeEmail(uploadedBy));
    const filePath = path.join(uploadsDir, safeEmail, "files", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "❌ File not found" });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("❌ Download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
      }
    });
  });

  // Backward-compatible file URL route for legacy links
  app.get("/files/:owner/:filename", (req, res) => {
    try {
      let ownerParam = req.params.owner;
      const requestedFile = decodeURIComponent(req.params.filename || "");
      const safeFileName = path.basename(requestedFile);

      if (!safeFileName) {
        return res.status(400).json({ error: "Filename is required" });
      }

      // Resolve UID to email when owner is a UID
      if (ownerParam.startsWith("USR-") || !ownerParam.includes("@")) {
        const userByUid = Kundli.getUserByUID(ownerParam);
        if (userByUid?.email) {
          ownerParam = userByUid.email;
        }
      }

      const ownerEmail = normalizeEmail(ownerParam || "");
      if (!ownerEmail) {
        return res.status(404).json({ error: "User not found" });
      }

      const ownerKey = safeName(ownerEmail);
      let filePath = path.join(uploadsDir, ownerKey, "files", safeFileName);

      // Fallback: some legacy links may carry stale owner email/uid.
      // If the file isn't in the expected owner folder, search all user folders by filename.
      if (!fs.existsSync(filePath)) {
        try {
          const userDirs = fs
            .readdirSync(uploadsDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);

          for (const dirName of userDirs) {
            const candidate = path.join(
              uploadsDir,
              dirName,
              "files",
              safeFileName,
            );
            if (fs.existsSync(candidate)) {
              filePath = candidate;
              break;
            }
          }
        } catch (_scanErr) {
          // ignore scan errors and fall through to 404
        }
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "❌ File not found" });
      }

      return res.sendFile(filePath);
    } catch (err) {
      console.error("❌ Legacy file route error:", err);
      return res
        .status(500)
        .json({ error: "Failed to load file", details: err.message });
    }
  });

  app.delete(
    "/files/:owner/:filename",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        let ownerParam = req.params.owner;
        const fileName = decodeURIComponent(req.params.filename || "");

        if (!fileName) {
          return res.status(400).json({ error: "Filename is required" });
        }

        // Resolve UID -> email when needed
        if (ownerParam.startsWith("USR-") || !ownerParam.includes("@")) {
          const userByUid = Kundli.getUserByUID(ownerParam);
          if (userByUid?.email) {
            ownerParam = userByUid.email;
          }
        }

        const normalizedOwnerEmail = normalizeEmail(ownerParam || "");
        if (!normalizedOwnerEmail) {
          return res.status(400).json({ error: "Invalid owner" });
        }

        // Ownership check
        const reqEmail = normalizeEmail(req.user?.email || "");
        const reqUid = req.user?.uid || "";
        const ownerUser = Kundli.getUserByEmail(normalizedOwnerEmail);
        const ownerUid = ownerUser?.uid || "";
        if (
          verifyToken &&
          reqEmail &&
          reqEmail !== normalizedOwnerEmail &&
          reqUid !== ownerUid
        ) {
          return res
            .status(403)
            .json({ error: "Not allowed to delete this file" });
        }

        const ownerKey = safeName(normalizedOwnerEmail);
        const physicalPath = path.join(uploadsDir, ownerKey, "files", fileName);

        // Remove physical file if exists
        if (fs.existsSync(physicalPath)) {
          fs.unlinkSync(physicalPath);
        }

        // Remove metadata record
        let filesMeta = [];
        try {
          filesMeta = JSON.parse(
            fs.readFileSync(filesMetaFile, "utf8") || "[]",
          );
        } catch (_err) {
          filesMeta = [];
        }

        const before = filesMeta.length;
        const filtered = filesMeta.filter((f) => {
          const sameOwner =
            safeName(normalizeEmail(f.uploadedBy || "")) === ownerKey;
          const sameFile =
            (f.filename || "") === fileName ||
            (f.originalname || "") === fileName;
          return !(sameOwner && sameFile);
        });

        fs.writeFileSync(filesMetaFile, JSON.stringify(filtered, null, 2));

        if (before === filtered.length && !fs.existsSync(physicalPath)) {
          return res.status(404).json({ error: "File not found" });
        }

        return res.json({ success: true, message: "File deleted" });
      } catch (err) {
        console.error("❌ File delete error:", err);
        return res
          .status(500)
          .json({ error: "Failed to delete file", details: err.message });
      }
    },
  );

  app.delete(
    "/files/:owner",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        let ownerParam = req.params.owner;

        if (ownerParam.startsWith("USR-") || !ownerParam.includes("@")) {
          const userByUid = Kundli.getUserByUID(ownerParam);
          if (userByUid?.email) {
            ownerParam = userByUid.email;
          }
        }

        const normalizedOwnerEmail = normalizeEmail(ownerParam || "");
        if (!normalizedOwnerEmail) {
          return res.status(400).json({ error: "Invalid owner" });
        }

        const reqEmail = normalizeEmail(req.user?.email || "");
        const reqUid = req.user?.uid || "";
        const ownerUser = Kundli.getUserByEmail(normalizedOwnerEmail);
        const ownerUid = ownerUser?.uid || "";
        if (
          verifyToken &&
          reqEmail &&
          reqEmail !== normalizedOwnerEmail &&
          reqUid !== ownerUid
        ) {
          return res
            .status(403)
            .json({ error: "Not allowed to delete these files" });
        }

        const ownerKey = safeName(normalizedOwnerEmail);
        const filesDir = path.join(uploadsDir, ownerKey, "files");

        let filesMeta = [];
        try {
          filesMeta = JSON.parse(
            fs.readFileSync(filesMetaFile, "utf8") || "[]",
          );
        } catch (_err) {
          filesMeta = [];
        }

        const ownerFiles = filesMeta.filter(
          (f) => safeName(normalizeEmail(f.uploadedBy || "")) === ownerKey,
        );

        let deletedPhysical = 0;
        if (fs.existsSync(filesDir)) {
          try {
            const diskFiles = fs.readdirSync(filesDir);
            diskFiles.forEach((name) => {
              const candidate = path.join(filesDir, name);
              if (fs.existsSync(candidate)) {
                fs.unlinkSync(candidate);
                deletedPhysical += 1;
              }
            });
          } catch (_e) {
            // continue with metadata cleanup
          }
        }

        const filtered = filesMeta.filter(
          (f) => safeName(normalizeEmail(f.uploadedBy || "")) !== ownerKey,
        );
        fs.writeFileSync(filesMetaFile, JSON.stringify(filtered, null, 2));

        return res.json({
          success: true,
          message: "All files deleted",
          metadataDeleted: ownerFiles.length,
          physicalDeleted: deletedPhysical,
        });
      } catch (err) {
        console.error("❌ Bulk file delete error:", err);
        return res
          .status(500)
          .json({ error: "Failed to delete all files", details: err.message });
      }
    },
  );
}

export default registerUploadRoutes;
