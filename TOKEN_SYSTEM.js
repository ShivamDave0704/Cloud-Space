// Token System for Platinum/Ultra Plans
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { logTokenGenerated } from "./utils/cool-logger.js";
import {
  getTokensList,
  updateTokensFromList,
} from "./utils/pay-kundli-manager.js";
import { logVerificationAttempt } from "./utils/verification-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = "your_jwt_secret"; // Ensure you use a strong secret and keep it safe

// Generate token in custom format: {UID}-{PLAN}PLAN-dd-mm-yyyy-{6DIGITS}
function generateToken(plan, uid = null) {
  // Generate 6 random digits
  let numbers = "";
  for (let i = 0; i < 6; i++) {
    numbers += Math.floor(Math.random() * 10);
  }

  // Get current date in dd-mm-yyyy format
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  const normalizedPlan = String(plan || "plan").toLowerCase();
  const planCodeMap = {
    silver: "SILV",
    gold: "GOLD",
    platinum: "PLAT",
    ultra: "ULTR",
    flash40: "FLSH",
  };
  const planCode =
    planCodeMap[normalizedPlan] ||
    normalizedPlan.slice(0, 4).toUpperCase() ||
    "PLAN";
  const safeUid = String(uid || "USR-UNKNOWN");
  return `${safeUid}-${planCode}PLAN-${dateStr}-${numbers}`;
}

// Create and save token for user - ONE TOKEN PER USER (not regeneratable)
// durationDays controls token expiry; defaults to plan-based (platinum=180 days, ultra=365 days)
export function createPlatinumToken(
  uid,
  plan,
  email = null,
  ipAddress = null,
  durationDays = null,
) {
  try {
    let tokenData = getTokensList();
    if (!tokenData || !Array.isArray(tokenData.tokens)) {
      tokenData = { tokens: [] };
    }

    // Decide expiry based on plan if not provided
    const defaultDurationByPlan = {
      silver: 30,
      gold: 90,
      platinum: 180,
      ultra: 365,
      flash40: 40,
    };
    const normalizedPlan = String(plan || "").toLowerCase();
    const effectiveDuration =
      durationDays !== null && durationDays !== undefined
        ? durationDays
        : defaultDurationByPlan[normalizedPlan] || 30;
    const desiredExpiresAt = new Date(
      Date.now() + effectiveDuration * 24 * 60 * 60 * 1000,
    ).toISOString();

    // ✅ CHECK IF TOKEN ALREADY EXISTS FOR THIS USER - DON'T REGENERATE!
    const existingToken = tokenData.tokens.find(
      (t) => t.uid === uid && t.plan === plan,
    );
    if (existingToken) {
      // Update expiry, reactivate, and reset reminder flags on renewal
      if (desiredExpiresAt) {
        existingToken.expiresAt = desiredExpiresAt;
      }
      existingToken.reminderSent = false;
      existingToken.remindedAt = null;
      existingToken.active = true;
      existingToken.used = false;
      existingToken.expiredAt = null;
      // existingToken.sessions = []; // Session system removed
      updateTokensFromList(tokenData);
      console.log(
        `♻️ Token refreshed for UID=${uid}, Plan=${plan}. Token: ${existingToken.token}`,
      );
      return existingToken.token;
    }

    // ✅ If UID changed but email matches, replace old token with new UID/token
    if (email) {
      const emailToken = tokenData.tokens.find(
        (t) =>
          t.plan === plan &&
          t.email &&
          t.email.toLowerCase() === String(email).toLowerCase(),
      );
      if (emailToken && emailToken.uid !== uid) {
        const newToken = generateToken(plan, uid);
        emailToken.uid = uid;
        emailToken.email = email;
        emailToken.token = newToken;
        emailToken.expiresAt = desiredExpiresAt;
        emailToken.reminderSent = false;
        emailToken.remindedAt = null;
        emailToken.active = true;
        emailToken.used = false;
        emailToken.expiredAt = null;
        updateTokensFromList(tokenData);
        console.log(
          `♻️ Token UID updated for email=${email}, Plan=${plan}. New UID=${uid}, Token=${newToken}`,
        );
        return newToken;
      }
    }

    const token = generateToken(plan, uid);
    const newToken = {
      email,
      uid,
      plan,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: desiredExpiresAt,
      reminderSent: false,
      remindedAt: null,
      used: false,
      active: true,
      ipAddress,
      // sessions: [] // Session system removed
    };

    tokenData.tokens.push(newToken);
    updateTokensFromList(tokenData);

    logTokenGenerated(uid, plan, email, token);
    return token;
  } catch (err) {
    console.error("❌ Error creating token:", err);
    return null;
  }
}

// Validate token
export function validateToken(token) {
  try {
    const tokenData = getTokensList();
    if (!tokenData.tokens || !Array.isArray(tokenData.tokens)) {
      logVerificationAttempt({
        token,
        status: "invalid",
        error: "No tokens in store",
        source: "validateToken",
      });
      return null;
    }

    const foundToken = tokenData.tokens.find((t) => t.token === token);

    if (!foundToken) {
      logVerificationAttempt({
        token,
        status: "invalid",
        error: "Token not found in store",
        source: "validateToken",
      });
      return null;
    }

    // Must be active
    if (foundToken.active === false) {
      logVerificationAttempt({
        token,
        status: "invalid",
        error: "Token is inactive",
        source: "validateToken",
        uid: foundToken.uid,
      });
      return null;
    }

    // Check if expired
    if (foundToken.expiresAt && new Date(foundToken.expiresAt) < new Date()) {
      logVerificationAttempt({
        token,
        status: "expired",
        error: "Token has expired",
        source: "validateToken",
        uid: foundToken.uid,
      });
      return null;
    }

    logVerificationAttempt({
      token,
      status: "success",
      source: "validateToken",
      uid: foundToken.uid,
    });

    return foundToken;
  } catch (err) {
    logVerificationAttempt({
      token,
      status: "error",
      error: err.message,
      source: "validateToken",
    });
    return null;
  }
}
// Get token by UID (for internal use only)
export function getTokenByUID(uid, plan = null) {
  try {
    const tokenData = getTokensList();
    if (!tokenData.tokens || !Array.isArray(tokenData.tokens)) return null;

    const normalizedUid = String(uid || "").trim();
    if (!normalizedUid) return null;

    const normalizedPlan = plan ? String(plan).toLowerCase().trim() : null;
    const matches = tokenData.tokens.filter((t) => {
      const uidMatch = String(t?.uid || "").trim() === normalizedUid;
      if (!uidMatch) return false;
      if (t?.active === false) return false;
      if (!normalizedPlan) return true;
      return (
        String(t?.plan || "")
          .toLowerCase()
          .trim() === normalizedPlan
      );
    });

    if (!matches.length) return null;

    // Prefer the newest active token for stable renew/access flows.
    return matches.sort(
      (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0),
    )[0];
  } catch (err) {
    console.error("❌ Error getting token:", err);
    return null;
  }
}

// Mark token as used in the current session (prevents reuse)
export function markTokenAsUsed(token, sessionId) {
  // Session system removed. No action taken.
  return true;
}

// Validate token hasn't been reused with different session
export function validateTokenSession(token, sessionId) {
  // Session system removed. Always return true.
  return true;
}

// Toggle token active/inactive status - EDITABLE FROM JSON FILE
export function setTokenStatus(uid, active) {
  try {
    const tokenData = getTokensList();
    const foundToken = tokenData.tokens.find((t) => t.uid === uid);

    if (foundToken) {
      foundToken.active = active;
      foundToken.statusUpdatedAt = new Date().toISOString();
      updateTokensFromList(tokenData);
      console.log(`✅ Token status updated for UID=${uid}: active=${active}`);
      return true;
    }

    console.warn(`⚠️ Token not found for UID=${uid}`);
    return false;
  } catch (err) {
    console.error("❌ Error setting token status:", err);
    return false;
  }
}

// Middleware to protect routes
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401); // Unauthorized

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Forbidden
    req.user = user;
    next();
  });

  const tokenEntry = validateToken(token);
  if (!tokenEntry) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
  req.user = {
    uid: tokenEntry.uid,
    email: tokenEntry.email,
    plan: tokenEntry.plan,
    token: tokenEntry.token,
  };
}
