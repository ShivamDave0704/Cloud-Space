import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KUNDLI_FILE = path.join(
  __dirname,
  "..",
  "support",
  "USER-pay-kundli.JSON",
);

function ensureKundliFile() {
  try {
    const dir = path.dirname(KUNDLI_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(KUNDLI_FILE)) {
      fs.writeFileSync(KUNDLI_FILE, JSON.stringify([], null, 4), "utf-8");
    }
  } catch (error) {
    console.error("Error ensuring USER-pay-kundli.JSON:", error.message);
  }
}

/**
 * Read the entire USER-pay-kundli.JSON file
 */
export function readKundli() {
  try {
    ensureKundliFile();
    if (fs.existsSync(KUNDLI_FILE)) {
      const data = fs.readFileSync(KUNDLI_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading USER-pay-kundli.JSON:", error.message);
  }
  return [];
}

/**
 * Write the entire USER-pay-kundli.JSON file and sync to individual files
 */
export function writeKundli(data) {
  try {
    ensureKundliFile();
    const formattedJson = JSON.stringify(data, null, 4);
    fs.writeFileSync(KUNDLI_FILE, formattedJson, "utf-8");
    return true;
  } catch (error) {
    console.error("Error writing USER-pay-kundli.JSON:", error.message);
    return false;
  }
}

function toUserList(kundli) {
  return (kundli || []).map((user) => ({
    uid: user.uid,
    username: user.username,
    email: user.email,
    phone: user.phone,
    password: user.password,
    role: user.role,
    uiAccess: user.uiAccess || null,
    profilePic: user.profilePic,
    created_at: user.created_at,
    verified: user.verified,
    blocked: user.blocked,
    permanentBan: user.permanentBan || false,
    blockUntil: user.blockUntil || null,
    blockedBy: user.blockedBy || null,
    forceLogoutToken: user.forceLogoutToken || null,
    forceLogoutAt: user.forceLogoutAt || null,
    referral:
      user.referral && typeof user.referral === "object"
        ? { ...user.referral }
        : {
            successfulReferredUsers: [],
            awardedMilestones: 0,
          },
    activePlans: user.activePlans || [],
    purchases: user.purchases || [],
    planActive: user.planActive || null,
    storageQuotaTB: user.storageQuotaTB || null,
  }));
}

function mergeUserEntry(existing, updates) {
  return {
    ...existing,
    ...updates,
    referral:
      updates?.referral && typeof updates.referral === "object"
        ? { ...updates.referral }
        : existing?.referral && typeof existing.referral === "object"
          ? { ...existing.referral }
          : {
              successfulReferredUsers: [],
              awardedMilestones: 0,
            },
    purchases: existing?.purchases || [],
    proofs: existing?.proofs || [],
    paymentLogs: existing?.paymentLogs || [],
    tokens: existing?.tokens || [],
    activePlans: existing?.activePlans || [],
  };
}

export function getUsersList() {
  return toUserList(readKundli());
}

export function updateUsersFromList(usersList) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  usersList.forEach((user) => {
    const existing = byUid.get(user.uid) || {};
    byUid.set(user.uid, mergeUserEntry(existing, user));
  });
  return writeKundli(Array.from(byUid.values()));
}

export function getPurchasesList() {
  const kundli = readKundli();
  const purchases = [];
  kundli.forEach((user) => {
    (user.purchases || []).forEach((purchase) => {
      purchases.push({
        _id: purchase.purchaseId,
        uid: user.uid,
        email: user.email,
        username: user.username,
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
      });
    });
  });
  return purchases;
}

export function updatePurchasesFromList(purchasesList) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  purchasesList.forEach((purchase) => {
    const existing = byUid.get(purchase.uid) || {
      uid: purchase.uid,
      email: purchase.email,
      username: purchase.username,
    };
    const user = mergeUserEntry(existing, existing);
    user.purchases = user.purchases || [];
    const idx = user.purchases.findIndex((p) => p.purchaseId === purchase._id);
    const mapped = {
      purchaseId: purchase._id,
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
    };
    if (idx >= 0) {
      user.purchases[idx] = { ...user.purchases[idx], ...mapped };
    } else {
      user.purchases.push(mapped);
    }
    byUid.set(purchase.uid, user);
  });
  return writeKundli(Array.from(byUid.values()));
}

export function getProofsList() {
  const kundli = readKundli();
  const proofs = [];
  kundli.forEach((user) => {
    (user.proofs || []).forEach((proof) => {
      proofs.push({
        _id: proof.proofId,
        uid: user.uid,
        email: user.email,
        userEmail: user.email,
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
    });
  });
  return proofs;
}

export function updateProofsFromList(proofsList) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  proofsList.forEach((proof) => {
    const existing = byUid.get(proof.uid) || {
      uid: proof.uid,
      email: proof.email,
      username: proof.username,
    };
    const user = mergeUserEntry(existing, existing);
    user.proofs = user.proofs || [];
    const idx = user.proofs.findIndex((p) => p.proofId === proof._id);
    const mapped = {
      proofId: proof._id,
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
    };
    if (idx >= 0) {
      user.proofs[idx] = { ...user.proofs[idx], ...mapped };
    } else {
      user.proofs.push(mapped);
    }
    byUid.set(proof.uid, user);
  });
  return writeKundli(Array.from(byUid.values()));
}

export function getTokensList() {
  const kundli = readKundli();
  const tokens = [];
  kundli.forEach((user) => {
    (user.tokens || []).forEach((token) => {
      tokens.push({
        email: user.email,
        uid: user.uid,
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
    });
  });
  return { tokens };
}

export function updateTokensFromList(tokensPayload) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  const tokenList = tokensPayload?.tokens || [];
  tokenList.forEach((token) => {
    const existing = byUid.get(token.uid) || {
      uid: token.uid,
      email: token.email,
    };
    const user = mergeUserEntry(existing, existing);
    user.tokens = user.tokens || [];
    const idx = user.tokens.findIndex(
      (t) => t.plan === token.plan && t.token === token.token,
    );
    const mapped = {
      plan: token.plan,
      token: token.token,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      reminderSent: token.reminderSent,
      remindedAt: token.remindedAt,
      used: token.used,
      active: token.active,
      ipAddress: token.ipAddress,
    };
    if (idx >= 0) {
      user.tokens[idx] = { ...user.tokens[idx], ...mapped };
    } else {
      user.tokens.push(mapped);
    }
    byUid.set(token.uid, user);
  });
  return writeKundli(Array.from(byUid.values()));
}

export function getPlanActiveList() {
  const kundli = readKundli();
  return kundli
    .filter((user) => (user.activePlans || []).length > 0)
    .map((user) => ({
      email: user.email,
      uid: user.uid,
      plans: user.activePlans || [],
    }));
}

export function updatePlanActiveFromList(planActiveList) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  planActiveList.forEach((entry) => {
    const existing = byUid.get(entry.uid) || {
      uid: entry.uid,
      email: entry.email,
    };
    const user = mergeUserEntry(existing, existing);
    user.activePlans = entry.plans || [];
    byUid.set(entry.uid, user);
  });
  return writeKundli(Array.from(byUid.values()));
}

export function getPaymentLogsList() {
  const kundli = readKundli();
  const logs = [];
  kundli.forEach((user) => {
    (user.paymentLogs || []).forEach((log) => {
      logs.push({
        timestamp: log.timestamp,
        uid: user.uid,
        email: user.email,
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
  return logs;
}

export function updatePaymentLogsFromList(paymentLogsList) {
  const kundli = readKundli();
  const byUid = new Map(kundli.map((u) => [u.uid, u]));
  paymentLogsList.forEach((log) => {
    const existing = byUid.get(log.uid) || { uid: log.uid, email: log.email };
    const user = mergeUserEntry(existing, existing);
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
    byUid.set(log.uid, user);
  });
  return writeKundli(Array.from(byUid.values()));
}

/**
 * Get user by UID
 */
export function getUserByUID(uid) {
  const kundli = readKundli();
  return kundli.find((u) => u.uid === uid) || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email) {
  const kundli = readKundli();
  return kundli.find((u) => u.email === email) || null;
}

/**
 * Get all users
 */
export function getAllUsers() {
  return readKundli();
}

/**
 * Add or update user
 */
export function saveUser(userData) {
  const kundli = readKundli();
  const index = kundli.findIndex((u) => u.uid === userData.uid);

  if (index >= 0) {
    // Update existing user - merge data
    kundli[index] = { ...kundli[index], ...userData };
  } else {
    // Add new user with default structure
    kundli.push({
      uid: userData.uid,
      username: userData.username || "Unknown",
      email: userData.email,
      phone: userData.phone || null,
      password: userData.password,
      role: userData.role || "user",
      uiAccess: userData.uiAccess || null,
      profilePic: userData.profilePic || "/images/default-avatar.png",
      created_at: userData.created_at || new Date().toISOString(),
      verified: userData.verified || false,
      blocked: userData.blocked || false,
      referral:
        userData.referral && typeof userData.referral === "object"
          ? { ...userData.referral }
          : {
              successfulReferredUsers: [],
              awardedMilestones: 0,
            },
      purchases: userData.purchases || [],
      proofs: userData.proofs || [],
      paymentLogs: userData.paymentLogs || [],
      tokens: userData.tokens || [],
      activePlans: userData.activePlans || [],
    });
  }

  return writeKundli(kundli);
}

/**
 * Update user profile fields
 */
export function updateUserProfile(uid, updates) {
  const kundli = readKundli();
  const index = kundli.findIndex((u) => u.uid === uid);

  if (index >= 0) {
    // Update only provided fields
    Object.keys(updates).forEach((key) => {
      if (
        key !== "purchases" &&
        key !== "proofs" &&
        key !== "paymentLogs" &&
        key !== "tokens" &&
        key !== "activePlans"
      ) {
        kundli[index][key] = updates[key];
      }
    });
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Add purchase to user
 */
export function addPurchase(uid, purchase) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    user.purchases.push(purchase);
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Add proof to user
 */
export function addProof(uid, proof) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    user.proofs.push(proof);
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Update proof status
 */
export function updateProof(uid, proofId, updates) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    const proofIndex = user.proofs.findIndex((p) => p.proofId === proofId);
    if (proofIndex >= 0) {
      user.proofs[proofIndex] = { ...user.proofs[proofIndex], ...updates };
      return writeKundli(kundli);
    }
  }
  return false;
}

/**
 * Add payment log to user
 */
export function addPaymentLog(uid, log) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    user.paymentLogs.push(log);
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Add token to user
 */
export function addToken(uid, token) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    user.tokens.push(token);
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Get token for user by plan
 */
export function getToken(uid, plan) {
  const user = getUserByUID(uid);
  if (user && user.tokens) {
    return user.tokens.find((t) => t.plan === plan && t.active) || null;
  }
  return null;
}

/**
 * Update token
 */
export function updateToken(uid, plan, updates) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    const tokenIndex = user.tokens.findIndex((t) => t.plan === plan);
    if (tokenIndex >= 0) {
      user.tokens[tokenIndex] = { ...user.tokens[tokenIndex], ...updates };
      return writeKundli(kundli);
    }
  }
  return false;
}

/**
 * Add active plan to user
 */
export function addActivePlan(uid, plan) {
  const kundli = readKundli();
  const user = kundli.find((u) => u.uid === uid);

  if (user) {
    user.activePlans.push(plan);
    return writeKundli(kundli);
  }
  return false;
}

/**
 * Get active plans for user
 */
export function getActivePlans(uid) {
  const user = getUserByUID(uid);
  return user ? user.activePlans : [];
}

/**
 * Get all proofs (for admin)
 */
export function getAllProofs() {
  const kundli = readKundli();
  const allProofs = [];

  kundli.forEach((user) => {
    if (user.proofs && user.proofs.length > 0) {
      user.proofs.forEach((proof) => {
        allProofs.push({
          ...proof,
          uid: user.uid,
          email: user.email,
          username: user.username,
        });
      });
    }
  });

  return allProofs;
}

/**
 * Get all purchases (for admin)
 */
export function getAllPurchases() {
  const kundli = readKundli();
  const allPurchases = [];

  kundli.forEach((user) => {
    if (user.purchases && user.purchases.length > 0) {
      user.purchases.forEach((purchase) => {
        allPurchases.push({
          ...purchase,
          uid: user.uid,
          email: user.email,
          username: user.username,
        });
      });
    }
  });

  return allPurchases;
}

/**
 * Get all tokens (for admin)
 */
export function getAllTokens() {
  const kundli = readKundli();
  const allTokens = [];

  kundli.forEach((user) => {
    if (user.tokens && user.tokens.length > 0) {
      user.tokens.forEach((token) => {
        allTokens.push({
          ...token,
          uid: user.uid,
          email: user.email,
          username: user.username,
        });
      });
    }
  });

  return allTokens;
}

/**
 * Delete user
 */
export function deleteUser(uid) {
  const kundli = readKundli();
  const filtered = kundli.filter((u) => u.uid !== uid);

  if (filtered.length < kundli.length) {
    return writeKundli(filtered);
  }
  return false;
}

/**
 * Search users
 */
export function searchUsers(query) {
  const kundli = readKundli();
  const lowerQuery = query.toLowerCase();

  return kundli.filter(
    (u) =>
      u.uid.toLowerCase().includes(lowerQuery) ||
      u.username.toLowerCase().includes(lowerQuery) ||
      u.email.toLowerCase().includes(lowerQuery) ||
      (u.phone && u.phone.includes(query)),
  );
}

/**
 * Get user statistics
 */
export function getUserStats(uid) {
  const user = getUserByUID(uid);

  if (!user) return null;

  return {
    totalPurchases: user.purchases?.length || 0,
    totalSpent:
      user.purchases?.reduce((sum, p) => sum + (p.finalAmount || 0), 0) || 0,
    activeProofs:
      user.proofs?.filter((p) => p.status === "approved").length || 0,
    pendingProofs:
      user.proofs?.filter((p) => p.status === "pending").length || 0,
    activeTokens: user.tokens?.filter((t) => t.active).length || 0,
    activePlans: user.activePlans?.length || 0,
  };
}

export default {
  readKundli,
  writeKundli,
  getUserByUID,
  getUserByEmail,
  getAllUsers,
  saveUser,
  updateUserProfile,
  addPurchase,
  addProof,
  updateProof,
  addPaymentLog,
  addToken,
  getToken,
  updateToken,
  addActivePlan,
  getActivePlans,
  getAllProofs,
  getAllPurchases,
  getAllTokens,
  deleteUser,
  searchUsers,
  getUserStats,
};
