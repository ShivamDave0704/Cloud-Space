import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERIFICATION_FILE = path.join(__dirname, "..", "support", "verification.json");
const LOG_FULL_TOKENS = process.env.VERIFICATION_LOG_FULL_TOKENS !== "false";

/**
 * Initialize verification store with default structure
 */
export function initVerificationStore() {
  try {
    if (!fs.existsSync(VERIFICATION_FILE)) {
      const defaultStore = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        stats: {
          totalAttempts: 0,
          successCount: 0,
          failureCount: 0,
          malformedCount: 0,
          expiredCount: 0
        },
        recentVerifications: [], // Last 100 attempts
        errorSummary: {}  // Group errors by type
      };
      fs.writeFileSync(VERIFICATION_FILE, JSON.stringify(defaultStore, null, 2));
      return defaultStore;
    }
    return readVerificationStore();
  } catch (err) {
    console.error("❌ Error initializing verification store:", err.message);
    return null;
  }
}

/**
 * Read verification store
 */
export function readVerificationStore() {
  try {
    if (!fs.existsSync(VERIFICATION_FILE)) {
      return initVerificationStore();
    }
    const raw = fs.readFileSync(VERIFICATION_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Error reading verification store:", err.message);
    return initVerificationStore();
  }
}

/**
 * Write verification store
 */
function writeVerificationStore(store) {
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(VERIFICATION_FILE, JSON.stringify(store, null, 2));
    return true;
  } catch (err) {
    console.error("❌ Error writing verification store:", err.message);
    return false;
  }
}

/**
 * Log a JWT verification attempt
 * @param {Object} attempt - Verification attempt details
 * @param {string} attempt.token - JWT token
 * @param {string} attempt.status - 'success', 'malformed', 'expired', 'invalid', 'missing'
 * @param {string} attempt.error - Error message (if any)
 * @param {string} attempt.source - Where this was called from (e.g., 'middleware', 'route', 'startup')
 * @param {string} attempt.uid - User ID (if available)
 */
export function logVerificationAttempt(attempt) {
  try {
    const store = readVerificationStore();
    
    // Build verification record
    const record = {
      timestamp: new Date().toISOString(),
      status: attempt.status || 'unknown',
      error: attempt.error || null,
      source: attempt.source || 'unknown',
      uid: attempt.uid || null,
      tokenPrefix: attempt.token ? attempt.token.substring(0, 20) + '...' : null,
      tokenFull: LOG_FULL_TOKENS ? (attempt.token || null) : null
    };

    // Update stats
    store.stats.totalAttempts++;
    if (attempt.status === 'success') store.stats.successCount++;
    else if (attempt.status === 'malformed') store.stats.malformedCount++;
    else if (attempt.status === 'expired') store.stats.expiredCount++;
    else store.stats.failureCount++;

    // Track error by type
    if (attempt.error) {
      const errorType = attempt.error.split(':')[0];
      store.errorSummary[errorType] = (store.errorSummary[errorType] || 0) + 1;
    }

    // Keep only last 100 verifications (rotating buffer)
    store.recentVerifications.push(record);
    if (store.recentVerifications.length > 100) {
      store.recentVerifications = store.recentVerifications.slice(-100);
    }

    writeVerificationStore(store);
    return true;
  } catch (err) {
    // Silently fail to avoid infinite loops
    return false;
  }
}

/**
 * Get verification statistics
 */
export function getVerificationStats() {
  const store = readVerificationStore();
  if (!store) return null;
  
  return {
    stats: store.stats,
    errorSummary: store.errorSummary,
    successRate: store.stats.totalAttempts > 0 
      ? Math.round((store.stats.successCount / store.stats.totalAttempts) * 100) + '%'
      : 'N/A'
  };
}

/**
 * Clear verification store (for testing/reset)
 */
export function clearVerificationStore() {
  try {
    const fresh = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      stats: {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        malformedCount: 0,
        expiredCount: 0
      },
      recentVerifications: [],
      errorSummary: {}
    };
    return writeVerificationStore(fresh);
  } catch (err) {
    console.error("❌ Error clearing verification store:", err.message);
    return false;
  }
}

/**
 * Get recent verification attempts (last N records)
 */
export function getRecentVerifications(limit = 50) {
  const store = readVerificationStore();
  if (!store) return [];
  return store.recentVerifications.slice(-limit);
}
