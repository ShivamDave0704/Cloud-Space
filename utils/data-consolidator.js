import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  logAutoConsolidationDisabled,
  logDataConsolidationDetails,
} from "./cool-logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORT_DIR = path.join(__dirname, "..", "support");
const PAYMENTS_DIR = path.join(SUPPORT_DIR, "payments");
const KUNDLI_FOLDER = path.join(SUPPORT_DIR, "user kundli");
const OUTPUT_FILE = path.join(SUPPORT_DIR, "USER-pay-kundli.JSON");

function ensureKundliFile() {
  if (!fs.existsSync(SUPPORT_DIR)) {
    fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_FILE)) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 4), "utf-8");
  }
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

function getLegacyFilePaths() {
  return {
    users: [
      path.join(KUNDLI_FOLDER, "users.json"),
      path.join(SUPPORT_DIR, "users.json"),
    ],
    tokens: [
      path.join(KUNDLI_FOLDER, "tokens.json"),
      path.join(SUPPORT_DIR, "tokens.json"),
    ],
    planActive: [
      path.join(KUNDLI_FOLDER, "plan-active.json"),
      path.join(SUPPORT_DIR, "plan-active.json"),
    ],
    purchases: [
      path.join(KUNDLI_FOLDER, "purchases.json"),
      path.join(PAYMENTS_DIR, "purchases.json"),
    ],
    proofs: [
      path.join(KUNDLI_FOLDER, "proofs.json"),
      path.join(PAYMENTS_DIR, "proofs.json"),
    ],
    paymentLog: [
      path.join(KUNDLI_FOLDER, "payment-log.json"),
      path.join(PAYMENTS_DIR, "payment-log.json"),
    ],
  };
}

function findUserKey(mapByUid, mapByEmail, uid, email) {
  if (uid && mapByUid.has(uid)) return uid;
  const normalized = normalizeEmail(email);
  if (normalized && mapByEmail.has(normalized))
    return mapByEmail.get(normalized);
  return null;
}

function ensureUser(mapByUid, mapByEmail, seed) {
  const uid =
    seed.uid ||
    `USR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const email = seed.email || null;
  if (!mapByUid.has(uid)) {
    mapByUid.set(uid, {
      uid,
      username: seed.username || "Unknown",
      email: email,
      phone: seed.phone || null,
      password: seed.password || null,
      role: seed.role || "user",
      uiAccess: seed.uiAccess || null,
      profilePic: seed.profilePic || "/images/default-avatar.png",
      created_at: seed.created_at || new Date().toISOString(),
      verified: seed.verified ?? false,
      blocked: seed.blocked ?? false,
      purchases: seed.purchases || [],
      proofs: seed.proofs || [],
      paymentLogs: seed.paymentLogs || [],
      tokens: seed.tokens || [],
      activePlans: seed.activePlans || [],
      permanentBan: seed.permanentBan || false,
      blockUntil: seed.blockUntil || null,
      blockedBy: seed.blockedBy || null,
      forceLogoutToken: seed.forceLogoutToken || null,
      forceLogoutAt: seed.forceLogoutAt || null,
    });
  }
  if (email) {
    const normalized = normalizeEmail(email);
    if (normalized) mapByEmail.set(normalized, uid);
  }
  return uid;
}

function dedupeByKey(list, keyGetter) {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const key = keyGetter(item);
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      result.push(item);
    }
  });
  return result;
}

export function migrateLegacyFilesToKundli() {
  ensureKundliFile();
  const legacy = getLegacyFilePaths();

  const kundli = readJsonSafe(OUTPUT_FILE) || [];
  const mapByUid = new Map(kundli.map((u) => [u.uid, u]));
  const mapByEmail = new Map(
    kundli.filter((u) => u.email).map((u) => [normalizeEmail(u.email), u.uid]),
  );

  // Users
  legacy.users.forEach((filePath) => {
    const users = readJsonSafe(filePath) || [];
    users.forEach((user) => {
      const uid = ensureUser(mapByUid, mapByEmail, user);
      const existing = mapByUid.get(uid);
      mapByUid.set(uid, {
        ...existing,
        ...user,
        purchases: existing.purchases || [],
        proofs: existing.proofs || [],
        paymentLogs: existing.paymentLogs || [],
        tokens: existing.tokens || [],
        activePlans: existing.activePlans || [],
      });
    });
  });

  // Purchases
  legacy.purchases.forEach((filePath) => {
    const purchases = readJsonSafe(filePath) || [];
    purchases.forEach((purchase) => {
      const uid =
        findUserKey(mapByUid, mapByEmail, purchase.uid, purchase.email) ||
        ensureUser(mapByUid, mapByEmail, purchase);
      const user = mapByUid.get(uid);
      user.purchases = user.purchases || [];
      user.purchases.push({
        purchaseId:
          purchase._id || purchase.purchaseId || purchase.transactionId,
        plan: purchase.plan,
        planDetails: purchase.planDetails,
        amount: purchase.amount,
        discount: purchase.discount,
        discountPercent: purchase.discountPercent,
        finalAmount: purchase.finalAmount,
        method: purchase.method,
        transactionId: purchase.transactionId,
        cardLast4: purchase.cardLast4,
        notes: purchase.notes,
        purchasedAt: purchase.purchasedAt,
        activatedAt: purchase.activatedAt,
        expiresAt: purchase.expiresAt,
        isActive: purchase.isActive,
        status: purchase.status,
        proofId: purchase.proofId,
        recordId: purchase.recordId,
        accessToken: purchase.accessToken,
        durationDays: purchase.durationDays,
        storageTB: purchase.storageTB,
      });
      user.purchases = dedupeByKey(
        user.purchases,
        (p) => p.purchaseId || p.transactionId,
      );
    });
  });

  // Proofs
  legacy.proofs.forEach((filePath) => {
    const proofs = readJsonSafe(filePath) || [];
    proofs.forEach((proof) => {
      const uid =
        findUserKey(mapByUid, mapByEmail, proof.uid, proof.email) ||
        ensureUser(mapByUid, mapByEmail, proof);
      const user = mapByUid.get(uid);
      user.proofs = user.proofs || [];
      user.proofs.push({
        proofId: proof._id || proof.proofId || proof.transactionId,
        plan: proof.plan,
        planDisplay: proof.planDisplay,
        method: proof.method,
        amount: proof.amount,
        originalAmount: proof.originalAmount,
        discountPercent: proof.discountPercent,
        discount: proof.discount,
        finalAmount: proof.finalAmount,
        discountSource: proof.discountSource,
        coupon: proof.coupon,
        coinsDiscount: proof.coinsDiscount,
        upi_txn_id: proof.upi_txn_id,
        transactionId: proof.transactionId,
        card: proof.card,
        notes: proof.notes,
        screenshot: proof.screenshot,
        requestedStorageTB: proof.requestedStorageTB,
        storageTB: proof.storageTB,
        durationDays: proof.durationDays,
        status: proof.status,
        highlighted: proof.highlighted,
        submittedAt: proof.submittedAt,
        createdAt: proof.createdAt,
        verifiedAt: proof.verifiedAt,
        verifiedBy: proof.verifiedBy,
        adminNotes: proof.adminNotes,
        extend: proof.extend,
        source: proof.source,
        actionLabel: proof.actionLabel,
        verified: proof.verified,
        plan2faPin: proof.plan2faPin,
        plan2faSetAt: proof.plan2faSetAt,
      });
      user.proofs = dedupeByKey(
        user.proofs,
        (p) => p.proofId || p.transactionId,
      );
    });
  });

  // Payment logs
  legacy.paymentLog.forEach((filePath) => {
    const logs = readJsonSafe(filePath) || [];
    logs.forEach((log) => {
      const uid =
        findUserKey(mapByUid, mapByEmail, log.uid, log.email) ||
        ensureUser(mapByUid, mapByEmail, log);
      const user = mapByUid.get(uid);
      user.paymentLogs = user.paymentLogs || [];
      user.paymentLogs.push({
        timestamp: log.timestamp,
        plan: log.plan,
        originalAmount: log.originalAmount,
        finalAmount: log.finalAmount,
        discountType: log.discountType,
        discountCode: log.discountCode,
        discountAmount: log.discountAmount,
        discountPercent: log.discountPercent,
        method: log.method,
        status: log.status,
        upiTxnId: log.upiTxnId,
        screenshot: log.screenshot,
      });
    });
  });

  // Tokens
  legacy.tokens.forEach((filePath) => {
    const tokenPayload = readJsonSafe(filePath) || { tokens: [] };
    const tokens = Array.isArray(tokenPayload.tokens)
      ? tokenPayload.tokens
      : [];
    tokens.forEach((token) => {
      const uid =
        findUserKey(mapByUid, mapByEmail, token.uid, token.email) ||
        ensureUser(mapByUid, mapByEmail, token);
      const user = mapByUid.get(uid);
      user.tokens = user.tokens || [];
      user.tokens.push({
        plan: token.plan,
        token: token.token,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        reminderSent: token.reminderSent,
        remindedAt: token.remindedAt,
        used: token.used,
        active: token.active,
        ipAddress: token.ipAddress,
      });
      user.tokens = dedupeByKey(user.tokens, (t) => t.token);
    });
  });

  // Plan active
  legacy.planActive.forEach((filePath) => {
    const planActive = readJsonSafe(filePath) || [];
    planActive.forEach((entry) => {
      const uid =
        findUserKey(
          mapByUid,
          mapByEmail,
          entry.uid || entry.self?.uid,
          entry.email || entry.self?.email,
        ) || ensureUser(mapByUid, mapByEmail, entry.self || entry);
      const user = mapByUid.get(uid);
      user.activePlans = entry.plans || user.activePlans || [];
    });
  });

  const merged = Array.from(mapByUid.values());
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 4), "utf-8");

  // Remove legacy files after migration
  Object.values(legacy)
    .flat()
    .forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

  return merged;
}

/**
 * Safely read and parse JSON file
 */
function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
  }
  return null;
}

/**
 * No-op: all data stays only in USER-pay-kundli.JSON
 */
export function syncBackToIndividualFiles() {
  return true;
}

/**
 * Consolidate all user payment data into one comprehensive structure
 * AND sync back to individual files for backwards compatibility
 */
export function consolidateUserData() {
  console.log("🔄 Starting data consolidation...");

  try {
    ensureKundliFile();
    const merged = migrateLegacyFilesToKundli();
    logDataConsolidationDetails(merged.length);
    return merged;
  } catch (error) {
    console.error("❌ Error during data consolidation:", error.message);
    throw error;
  }
}

/**
 * Watch for changes in source files and auto-consolidate
 */
export function setupAutoConsolidation() {
  logAutoConsolidationDisabled();
}
