import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fs from "fs";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { validateToken } from "./TOKEN_SYSTEM.js";
import {
  ensureCoinsLedgerFile,
  syncCoinsLedgerFromWallets,
} from "./utils/coins-ledger.js";
import {
  getPlanActiveList,
  getProofsList,
  getPurchasesList,
  getTokensList,
  getUsersList,
  readKundli,
} from "./utils/pay-kundli-manager.js";
import {
  initVerificationStore,
  logVerificationAttempt,
} from "./utils/verification-store.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import jwt from "jsonwebtoken";
// ================== CONFIG ==================
const PORT = process.env.PORT || 5000;
const PRICE_PER_TB = Number(process.env.PRICE_PER_TB || 350);
const PRICE_128GB = Number(process.env.PRICE_128GB || 999);
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || "admin@cloudspace.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "your_admin_password_here";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@cloudspace.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "your_admin_password_here";
const DISCOUNT_PERCENT = Number(process.env.DISCOUNT_PERCENT || 40);
const VALID_COUPON = process.env.COUPON_CODE || "GET40";

// ================== PATHS & FILES ==================
const uploadsDir = path.join(__dirname, "uploads");
const publicDir = path.join(__dirname, "public");
const supportDir = path.join(__dirname, "support");
const logsDir = path.join(supportDir, "logs");
const planActiveFile = path.join(supportDir, "plan-active.json");
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const planPriceFile = path.join(supportDir, "plan-price.json");

const paymentSupportDir = path.join(__dirname, "support", "payments");
const paymentProofsDir = path.join(paymentSupportDir, "proofs");
const proofsFile = path.join(paymentSupportDir, "proofs.json");
const purchasesFile = path.join(paymentSupportDir, "purchases.json");

const usersFile = path.join(supportDir, "users.json");
const filesMetaFile = path.join(supportDir, "files.json");
const loginOutFile = path.join(supportDir, "login-out.json");

// Coins file
const coinsDir = path.join(supportDir, "coins");
const cloudCoinsFile = path.join(coinsDir, "cloud-coins.json");

const mailLog = path.join(logsDir, "mail.log");
const resetRequestsLog = path.join(logsDir, "reset_requests.log");
const passwordChangesLog = path.join(logsDir, "password_changes.log");
const uploadsLog = path.join(logsDir, "uploads.log");
const loginAttemptsLog = path.join(logsDir, "login_attempts.log");
const accountFlagsLog = path.join(logsDir, "account_flags.log");
const flagsLog = path.join(logsDir, "flags.log");
const passwordChangesJsonFile = path.join(logsDir, "password_changes.json");

// User Kundli folder paths
const userKundliDir = path.join(supportDir, "user kundli");

// Helper function to get file path (prefers user kundli folder)
function getFilePath(filename) {
  const kundliPath = path.join(userKundliDir, filename);
  if (fs.existsSync(kundliPath)) {
    return kundliPath;
  }
  // Fallback to original paths
  switch (filename) {
    case "users.json":
      return usersFile;
    case "plan-active.json":
      return planActiveFile;
    case "purchases.json":
      return purchasesFile;
    case "proofs.json":
      return proofsFile;
    case "tokens.json":
      return path.join(supportDir, "tokens.json");
    default:
      return path.join(supportDir, filename);
  }
}

// ================== ENSURE DIRECTORIES EXIST ==================
// Create necessary directories
[
  uploadsDir,
  publicDir,
  supportDir,
  logsDir,
  paymentSupportDir,
  paymentProofsDir,
  path.join(supportDir, "friends"),
  path.join(supportDir, "coins"),
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ================== ENSURE LOG FILES EXIST ==================
// Create all log files if they don't exist
const logFiles = [
  mailLog,
  resetRequestsLog,
  passwordChangesLog,
  uploadsLog,
  loginAttemptsLog,
  accountFlagsLog,
  flagsLog,
];

logFiles.forEach((logFile) => {
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, "");
  }
});

// Create password changes JSON file if it doesn't exist
if (!fs.existsSync(passwordChangesJsonFile)) {
  fs.writeFileSync(passwordChangesJsonFile, JSON.stringify([], null, 2));
}

// Create login-out.json on server start (reset all to offline)
try {
  const users = getUsersList();
  const loginOut = Array.isArray(users)
    ? users.map((u) => ({ uid: u.uid, login: false }))
    : [];
  fs.writeFileSync(loginOutFile, JSON.stringify(loginOut, null, 2));
} catch (err) {
  console.error("Failed to initialize login-out.json:", err.message);
}

// Create and sync coins ledger on server start.
try {
  ensureCoinsLedgerFile(supportDir);
  let wallets = [];
  if (fs.existsSync(cloudCoinsFile)) {
    const rawCoins = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
    const parsed = JSON.parse(rawCoins);
    wallets = Array.isArray(parsed) ? parsed : [];
  }
  syncCoinsLedgerFromWallets(supportDir, wallets);
} catch (err) {
  console.error("Failed to initialize coins.json ledger:", err.message);
}

// ✅ Initialize verification store for JWT verification tracking
initVerificationStore();

// ================== APP INIT ==================
const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ extended: true, limit: "1gb" }));

// CSP headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; " +
      "font-src 'self' https: data:; " +
      "style-src 'self' https: 'unsafe-inline'; " +
      "script-src 'self' https: 'unsafe-inline' 'unsafe-eval'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https: data: ws: wss:;",
  );
  next();
});

// Sessions
app.use(
  session({
    secret: "my_super_secret",
    resave: false,
    saveUninitialized: true,
  }),
);

function safeName(name) {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role, uid: user.uid },
    JWT_SECRET,
    {
      expiresIn: "2h",
    },
  );
}

function getLiveUserByTokenIdentity(identity) {
  try {
    const users = getUsersList();
    const tokenUid = String(identity?.uid || "")
      .trim()
      .toUpperCase();
    const tokenEmail = normalizeEmail(identity?.email || "");

    if (!Array.isArray(users) || (!tokenUid && !tokenEmail)) return null;

    return (
      users.find((u) => {
        const userUid = String(u?.uid || "")
          .trim()
          .toUpperCase();
        const userEmail = normalizeEmail(u?.email || "");
        return (tokenUid && userUid === tokenUid) ||
          (tokenEmail && userEmail === tokenEmail)
          ? true
          : false;
      }) || null
    );
  } catch (err) {
    console.warn("Could not resolve live user role from store:", err.message);
    return null;
  }
}

function isAdmin(req, res, next) {
  const liveUser = getLiveUserByTokenIdentity(req.user);
  const effectiveRole = String(liveUser?.role || req.user?.role || "")
    .trim()
    .toLowerCase();

  if (effectiveRole !== "admin" && effectiveRole !== "superadmin") {
    return res.status(403).json({ error: "Admins only" });
  }

  if (liveUser) {
    req.user = {
      ...req.user,
      email: liveUser.email,
      uid: liveUser.uid,
      role: effectiveRole,
    };
  }
  next();
}

function verifyToken(req, res, next) {
  let token = null;
  const auth = req.headers["authorization"];
  if (auth && auth.split(" ").length > 1) token = auth.split(" ")[1];
  if (!token && req.query && req.query.token) token = req.query.token;
  if (!token && req.headers && req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("token=")) {
        token = c.split("=")[1];
        break;
      }
    }
  }

  if (!token) {
    logVerificationAttempt({
      status: "missing",
      error: "No token provided",
      source: "verifyToken",
    });
    return res.status(401).json({ error: "No token" });
  }

  // ✅ Verify JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const liveUser = getLiveUserByTokenIdentity(decoded);
    req.user = {
      ...decoded,
      email: liveUser?.email || decoded.email,
      uid: liveUser?.uid || decoded.uid,
      role: liveUser?.role || decoded.role,
    };
    logVerificationAttempt({
      token,
      status: "success",
      source: "verifyToken",
      uid: req.user.uid,
    });
    return next();
  } catch (err) {
    // Log verification failure to store instead of console
    logVerificationAttempt({
      token,
      status: err.message.toLowerCase().includes("malformed")
        ? "malformed"
        : "invalid",
      error: err.message,
      source: "verifyToken",
    });
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}
function generateUID() {
  return "USR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}
function generateStrongPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function resolveUserContext(req) {
  let email = normalizeEmail(
    req.body?.email ||
      req.body?.uploadedBy ||
      req.headers["x-email"] ||
      req.headers["x-user"] ||
      (req.query && req.query.email),
  );
  let uid =
    req.body?.uid ||
    req.body?.userId ||
    req.body?.id ||
    req.headers["x-uid"] ||
    req.headers["x-user"] ||
    (req.query && (req.query.uid || req.query.userId));
  let token = null;
  const auth = req.headers["authorization"];
  if (auth && auth.split(" ").length > 1) token = auth.split(" ")[1];
  if (!token && req.query && req.query.token) token = req.query.token;
  if (!token && req.body && req.body.token) token = req.body.token;
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith("token=")) {
        token = c.split("=")[1];
        break;
      }
    }
  }
  if (token) {
    // First try reference token (TOK- prefix)
    try {
      const ref = validateToken(token);
      if (ref) {
        if (!email && ref.email) email = normalizeEmail(ref.email);
        if (!uid && ref.uid) uid = ref.uid;
      }
    } catch (err) {
      /* ignore reference token errors */
    }
    // Then try JWT for backward compatibility
    if (!email || !uid) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!email && decoded.email) email = normalizeEmail(decoded.email);
        if (!uid && decoded.uid) uid = decoded.uid;
      } catch (err) {
        /* ignore */
      }
    }
  }
  // Fallback: if we only have uid, look up email from USER-pay-kundli.JSON
  if (!email && uid) {
    try {
      const users = getUsersList();
      const found = users.find(
        (u) => u.uid === uid || u.id === uid || u.userId === uid,
      );
      if (found?.email) email = normalizeEmail(found.email);
    } catch (err) {
      console.warn(
        "⚠️ Could not resolve email from USER-pay-kundli.JSON",
        err.message,
      );
    }
  }
  return { email, uid };
}
function resolveUploadedBy(req) {
  const ctx = resolveUserContext(req);
  // Email-only policy for storage; guest if missing
  if (ctx.email) return ctx.email;

  const headerEmail = normalizeEmail(req.headers["x-email"] || "");
  if (headerEmail && headerEmail.includes("@")) return headerEmail;

  return "guest";
}

// Create uploads/<email-or-uid>/(files|profile|chunks)
function ensureUserDirs(email, uid) {
  const safeEmail = email ? safeName(email) : "";
  // Email-only storage; guest fallback
  const pathSegment = safeEmail || "guest";

  const baseDir = path.join(uploadsDir, pathSegment);
  const filesDir = path.join(baseDir, "files");
  const profileDir = path.join(baseDir, "profile");
  const chunksDir = path.join(baseDir, "chunks");

  [baseDir, filesDir, profileDir, chunksDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const defaultProfileSrc = path.join(
    publicDir,
    "images",
    "default-profile.png",
  );
  const defaultProfileDest = path.join(profileDir, "profile.png");
  if (fs.existsSync(defaultProfileSrc) && !fs.existsSync(defaultProfileDest)) {
    fs.copyFileSync(defaultProfileSrc, defaultProfileDest);
    console.log(`📷 Default profile.png added for ${pathSegment}`);
  }

  return {
    base: baseDir,
    files: filesDir,
    profile: profileDir,
    chunks: chunksDir,
    pathSegment,
  };
}

function appendLog(filePath, msg) {
  const logs = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath))
    : {};
  const timestamp = new Date().toLocaleString();
  if (!logs.flagLogs) logs.flagLogs = "";
  logs.flagLogs += `[${timestamp}] ${msg}\n`;
  fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
}

// ================== MAILER ==================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use TLS instead of SSL for better compatibility
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: {
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

// Verify transporter on startup
const emailColors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  bright: "\x1b[1m",
};
console.log(
  `\n${emailColors.magenta}${emailColors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${emailColors.reset}`,
);
console.log(
  `${emailColors.blue}${emailColors.bright}📧 EMAIL SERVICE${emailColors.reset}\n`,
);
transporter.verify((error, success) => {
  if (error) {
    console.warn(
      `${emailColors.red}${emailColors.bright}❌ Configuration Issue: ${emailColors.yellow}${error.message}${emailColors.reset}`,
    );
    console.log(
      `${emailColors.cyan}💡 Tip: ${emailColors.white}Use Gmail App Password (not regular password)${emailColors.reset}`,
    );
    console.log(
      `${emailColors.cyan}🔗 Setup: ${emailColors.yellow}https://myaccount.google.com/apppasswords${emailColors.reset}`,
    );
  } else {
    console.log(
      `${emailColors.bright}${emailColors.green}✅ Status: ${emailColors.cyan}Email service ready${emailColors.reset}`,
    );
    console.log(
      `${emailColors.bright}${emailColors.magenta}📬 Provider: ${emailColors.yellow}${process.env.EMAIL_USER}${emailColors.reset}`,
    );
  }
});

async function sendStyledMail(to, subject, bodyHtml) {
  return transporter.sendMail({
    from: `"🌌 Cloud Space" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
        <body style="margin:0;padding:0;background:#0d1117;
                     font-family:'Segoe UI',Arial,sans-serif;color:#e6edf3;">
            <div style="max-width:640px;margin:25px auto;padding:30px;
                        border-radius:16px;background:linear-gradient(145deg,#141e30,#243b55);
                        box-shadow:0 0 25px rgba(0,255,200,0.3),0 0 50px rgba(0,153,255,0.25);">

                <h1 style="text-align:center;color:#00e0ff;margin-bottom:15px;
                           text-shadow:0 0 12px #00ffcc,0 0 24px #00e0ff;">
                    🌌 Cloud Space
                </h1>

                <div style="font-size:15px;line-height:1.6;color:#f0f0f0;">
                    ${bodyHtml}
                </div>

                <hr style="border:none;border-top:1px solid #333;margin:25px 0;" />

                <p style="font-size:12px;color:#888;text-align:center;">
                    🚀 Sent securely by <b>Cloud Space</b>
                </p>
            </div>
        </body>
        `,
  });
}

// ================== MAGIC LINK STORE ==================
const magicLinks = {};

// Shared exports
const config = {
  PORT,
  // JWT system removed
  PRICE_PER_TB,
  PRICE_128GB,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DISCOUNT_PERCENT,
  VALID_COUPON,
};

const paths = {
  __dirname,
  uploadsDir,
  publicDir,
  supportDir,
  logsDir,
  planActiveFile,
  planPriceFile,
  paymentSupportDir,
  paymentProofsDir,
  proofsFile,
  purchasesFile,
  usersFile,
  filesMetaFile,
  loginOutFile,
  mailLog,
  resetRequestsLog,
  passwordChangesLog,
  uploadsLog,
  loginAttemptsLog,
  accountFlagsLog,
  flagsLog,
  passwordChangesJsonFile,
  getFilePath,
};

const helpers = {
  safeName,
  normalizeEmail,
  generateUID,
  generateStrongPassword,
  signToken,
  verifyToken,
  isAdmin,
  resolveUserContext,
  resolveUploadedBy,
  ensureUserDirs,
  appendLog,
};

const mail = { transporter, sendStyledMail };

// ================== USER DATA AGGREGATION ==================
const allUsersDataFile = path.join(supportDir, "all-users-data.json");
// USER-pay-kundli.JSON is the single source of truth
const kundliFile = path.join(supportDir, "USER-pay-kundli.JSON");

function aggregateAllUsersData() {
  try {
    const kundli = readKundli();
    const kundliByUid = new Map(
      (kundli || []).map((entry) => [entry.uid, entry]),
    );
    const kundliByEmail = new Map(
      (kundli || []).map((entry) => [normalizeEmail(entry.email || ""), entry]),
    );
    const users = getUsersList();
    const files = JSON.parse(fs.readFileSync(filesMetaFile, "utf8") || "[]");
    const planActive = getPlanActiveList();
    const planPrice = JSON.parse(
      fs.readFileSync(planPriceFile, "utf8") || "{}",
    );
    const proofs = getProofsList();
    const purchases = getPurchasesList();

    // Coins file
    let coins = [];
    try {
      if (fs.existsSync(cloudCoinsFile)) {
        coins = JSON.parse(fs.readFileSync(cloudCoinsFile, "utf8") || "[]");
      }
    } catch (e) {
      console.warn("Could not read cloud-coins.json:", e.message);
    }

    // Login/Signup files
    const loginSignupDir = path.join(supportDir, "login-signup");
    let loginData = [];
    let signupData = [];
    try {
      const loginFile = path.join(loginSignupDir, "login.json");
      if (fs.existsSync(loginFile)) {
        loginData = JSON.parse(fs.readFileSync(loginFile, "utf8") || "[]");
      }
    } catch (e) {
      console.warn("Could not read login.json:", e.message);
    }
    try {
      const signupFile = path.join(loginSignupDir, "signup.json");
      if (fs.existsSync(signupFile)) {
        signupData = JSON.parse(fs.readFileSync(signupFile, "utf8") || "[]");
      }
    } catch (e) {
      console.warn("Could not read signup.json:", e.message);
    }

    // Feedbacks file
    let feedbacks = [];
    const feedbacksFile = path.join(supportDir, "support.json");
    try {
      if (fs.existsSync(feedbacksFile)) {
        feedbacks = JSON.parse(fs.readFileSync(feedbacksFile, "utf8") || "[]");
      }
    } catch (e) {
      console.warn("Could not read feedbacks.json:", e.message);
    }

    // Tokens file
    let tokens = [];
    try {
      const tokensData = getTokensList();
      tokens = tokensData.tokens || [];
    } catch (e) {
      console.warn(
        "Could not read tokens from USER-pay-kundli.JSON:",
        e.message,
      );
    }

    // Aggregate data for each user
    const aggregatedData = users.map((user) => {
      const userEmail = user.email;
      const normalizedEmail = normalizeEmail(userEmail);

      // Include ALL user fields including full source entry from USER-pay-kundli.JSON
      const rawKundliUser =
        kundliByUid.get(user.uid) || kundliByEmail.get(normalizedEmail) || null;
      const fullUser = rawKundliUser
        ? { ...rawKundliUser, ...user }
        : { ...user };

      // Find user's files
      const userFiles = files.filter(
        (f) =>
          normalizeEmail(f.uploadedBy || "") === normalizedEmail ||
          normalizeEmail(f.ownerEmail || "") === normalizedEmail,
      );

      // Calculate storage
      const totalStorage = userFiles.reduce(
        (sum, f) => sum + (f.bytes || 0),
        0,
      );

      // Find user's plan
      const userPlan = planActive.find(
        (p) =>
          normalizeEmail(p.email || "") === normalizedEmail ||
          (p.self && normalizeEmail(p.self.email || "") === normalizedEmail),
      );

      // Find user's payments
      const userProofs = proofs.filter(
        (p) => normalizeEmail(p.email || "") === normalizedEmail,
      );
      const userPurchasesRaw = purchases.filter(
        (p) => normalizeEmail(p.email || "") === normalizedEmail,
      );
      // Ensure recordId present for toggles
      const userPurchases = userPurchasesRaw.map((p) => ({
        ...p,
        recordId: p.recordId || p._id,
      }));

      // Find user's login/signup history
      const userLogins = loginData.filter(
        (l) => normalizeEmail(l.email || "") === normalizedEmail,
      );
      const userSignups = signupData.filter(
        (s) => normalizeEmail(s.email || "") === normalizedEmail,
      );

      // Find user's feedbacks
      const userFeedbacks = feedbacks.filter(
        (f) => normalizeEmail(f.email || "") === normalizedEmail,
      );

      // Find user's tokens (match by email or UID to handle null email tokens)
      const userTokens = tokens.filter((t) => {
        const tokenEmail = normalizeEmail(t.email || "");
        const tokenUid = t.uid || "";
        return tokenEmail === normalizedEmail || tokenUid === user.uid;
      });

      // Find user's coins
      const userCoins = coins.find(
        (c) =>
          c.userUID === user.uid ||
          normalizeEmail(c.email || "") === normalizedEmail,
      );

      return {
        user: fullUser, // Include ALL fields including password
        kundliRaw: rawKundliUser,
        storage: {
          totalBytes: totalStorage,
          totalFiles: userFiles.length,
          files: userFiles.map((f) => ({
            filename: f.filename,
            originalname: f.originalname,
            bytes: f.bytes,
            format: f.format,
            created_at: f.created_at,
            secure_url: f.secure_url,
          })),
        },
        plan: userPlan
          ? {
              currentPlan:
                userPlan.plans && userPlan.plans.length > 0
                  ? userPlan.plans[userPlan.plans.length - 1].plan
                  : "free",
              planHistory: userPlan.plans || [],
              summary: userPlan.summary || {},
              fullPlanData: userPlan, // Include complete plan data
            }
          : {
              currentPlan: "free",
              planHistory: [],
              summary: {},
              fullPlanData: null,
            },
        payments: {
          proofs: userProofs, // Include complete proof data
          purchases: userPurchases, // Include complete purchase data
          totalSpent: userPurchases.reduce(
            (sum, p) => sum + (p.amount || 0),
            0,
          ),
        },
        activity: {
          loginCount: userLogins.length,
          lastLogin:
            userLogins.length > 0
              ? userLogins[userLogins.length - 1].timestamp
              : null,
          signupDate:
            userSignups.length > 0
              ? userSignups[0].timestamp
              : user.createdAt || null,
          totalLogins: userLogins.length,
          totalSignups: userSignups.length,
          loginHistory: userLogins, // Include full login history
          signupHistory: userSignups, // Include full signup history
        },
        feedbacks: userFeedbacks, // Include complete feedback data
        tokens: userTokens, // Include complete token data
        coins: userCoins
          ? {
              balance: userCoins.balance || 0,
              transactions: userCoins.transactions || [],
              createdAt: userCoins.createdAt,
              fullCoinsData: userCoins, // Include complete coins data
            }
          : {
              balance: 0,
              transactions: [],
              createdAt: null,
              fullCoinsData: null,
            },
        stats: {
          totalFiles: userFiles.length,
          totalStorage: totalStorage,
          totalPayments: userProofs.length + userPurchases.length,
          totalLogins: userLogins.length,
          totalFeedbacks: userFeedbacks.length,
          accountAge: user.createdAt
            ? Math.floor(
                (Date.now() - new Date(user.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0,
        },
      };
    });

    // Write aggregated data with metadata wrapper
    const outputData = {
      generatedAt: new Date().toISOString(),
      totalUsers: users.length,
      planPricing: planPrice,
      users: aggregatedData,
    };

    fs.writeFileSync(allUsersDataFile, JSON.stringify(outputData, null, 2));
    const aggColors = {
      green: "\x1b[32m",
      white: "\x1b[37m",
      cyan: "\x1b[36m",
      yellow: "\x1b[33m",
      magenta: "\x1b[35m",
      blue: "\x1b[34m",
      reset: "\x1b[0m",
      bright: "\x1b[1m",
    };

    // Synced log disabled to reduce console spam from file watcher triggers
    // Only show header on first aggregation (also disabled)
    // if (!global.aggregationHeaderShown) {
    //   console.log(`\n${aggColors.magenta}${aggColors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${aggColors.reset}`);
    //   console.log(`${aggColors.blue}${aggColors.bright}📊 DATA AGGREGATION${aggColors.reset}\n`);
    //   global.aggregationHeaderShown = true;
    // }

    return outputData;
  } catch (error) {
    console.error("❌ Error aggregating users data:", error);
    return null;
  }
}

// Start a lightweight watcher to re-aggregate whenever any source JSON changes
function startAggregationWatcher() {
  const watchedFiles = [
    filesMetaFile,
    planPriceFile,
    kundliFile,
    path.join(supportDir, "login-signup", "login.json"),
    path.join(supportDir, "login-signup", "signup.json"),
    path.join(supportDir, "support.json"),
  ];

  const watchers = [];
  const debounceMap = new Map();

  const defaults = {
    [filesMetaFile]: "[]",
    [planPriceFile]: "{}",
    [kundliFile]: "[]",
    [path.join(supportDir, "login-signup", "login.json")]: "[]",
    [path.join(supportDir, "login-signup", "signup.json")]: "[]",
    [path.join(supportDir, "support.json")]: "[]",
  };

  const trigger = (file) => {
    if (debounceMap.has(file)) {
      clearTimeout(debounceMap.get(file));
    }
    debounceMap.set(
      file,
      setTimeout(() => {
        aggregateAllUsersData();
        debounceMap.delete(file);
      }, 300),
    );
  };

  watchedFiles.forEach((filePath) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) return;
      if (!fs.existsSync(filePath)) {
        const def = defaults[filePath] ?? "[]";
        fs.writeFileSync(filePath, def);
      }
      const watcher = fs.watch(filePath, { persistent: false }, () =>
        trigger(filePath),
      );
      watchers.push(watcher);
    } catch (err) {
      console.warn(`Watcher failed for ${filePath}:`, err.message);
    }
  });

  return () => watchers.forEach((w) => w.close());
}

export {
  aggregateAllUsersData,
  app,
  config,
  helpers,
  magicLinks,
  mail,
  paths,
  startAggregationWatcher,
};
