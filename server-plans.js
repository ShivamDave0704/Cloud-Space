import fs from "fs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  createPlatinumToken,
  getTokenByUID,
  validateToken,
} from "./TOKEN_SYSTEM.js";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import {
  logPaymentMethodsLoaded,
  logPlanConfigurationLoaded,
  logUiAccessDecision,
} from "./utils/cool-logger.js";
import {
  getPlanActiveList,
  getProofsList,
  getPurchasesList,
  getTokensList,
  getUsersList,
  updatePlanActiveFromList,
  updateProofsFromList,
  updatePurchasesFromList,
  updateTokensFromList,
  updateUsersFromList,
} from "./utils/pay-kundli-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI Color codes for console styling
const colors = {
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  reset: "\x1b[0m",
  bright: "\x1b[1m",
};

// Attach plan, payment, and purchase routes
export function registerPlanRoutes(core) {
  const { app, paths, helpers, mail, config } = core;
  const {
    planPriceFile,
    planActiveFile,
    purchasesFile,
    proofsFile,
    paymentProofsDir,
    paymentSupportDir,
    usersFile,
    uploadsDir,
    publicDir,
    __dirname: baseDir,
    supportDir,
  } = paths;

  // Single-source storage handled by USER-pay-kundli.JSON

  const { verifyToken, isAdmin, safeName, normalizeEmail } = helpers;
  const { sendStyledMail } = mail;
  const {
    PRICE_PER_TB,
    DISCOUNT_PERCENT,
    VALID_COUPON,
    SUPER_ADMIN_EMAIL,
    ADMIN_EMAIL,
    JWT_SECRET,
    PORT,
  } = config;
  const MAIL_BASE_URL = `http://localhost:${PORT || process.env.PORT || 5000}`;

  const UPI_ID = process.env.UPI_ID || "9316378005-2.wallet@phonepe";
  const UPI_NAME =
    process.env.UPI_NAME || process.env.UPI_PAYEE_NAME || "CloudSpace Payment";
  const REFERRAL_COUPON_CODE = "REFERRED";
  const REFERRAL_DISCOUNT_PERCENT = 35;
  const REFERRAL_SUCCESS_TARGET = 10;
  const REFERRAL_REWARD_COINS = 10000;
  const COINS_PER_RUPEE = 5;
  let PLANS = {};
  let PLANS_CONFIG = null; // Will store full plan-price.json

  const REMINDER_LEAD_DAYS = 3;
  const REMINDER_LEAD_MS = 2 * 60 * 1000; // 2 minutes for short-duration test plans
  const tokensFile = path.join(baseDir, "support", "USER-pay-kundli.JSON");
  const backupFile = path.join(
    baseDir,
    "support",
    "backup-Plan,payment,user.json",
  );
  let remindersScheduled = false;

  const readStore = (name, fallback) => {
    switch (name) {
      case "users.json":
        return getUsersList();
      case "plan-active.json":
        return getPlanActiveList();
      case "purchases.json":
        return getPurchasesList();
      case "proofs.json":
        return getProofsList();
      case "tokens.json":
        return getTokensList();
      default:
        return fallback;
    }
  };

  const writeStore = (name, data) => {
    switch (name) {
      case "users.json":
        return updateUsersFromList(data);
      case "plan-active.json":
        return updatePlanActiveFromList(data);
      case "purchases.json":
        return updatePurchasesFromList(data);
      case "proofs.json":
        return updateProofsFromList(data);
      case "tokens.json":
        return updateTokensFromList(data);
      default:
        return false;
    }
  };

  function ensureReferralState(user) {
    if (!user || typeof user !== "object") return user;
    if (!user.referral || typeof user.referral !== "object") {
      user.referral = {};
    }
    if (!Array.isArray(user.referral.successfulReferredUsers)) {
      user.referral.successfulReferredUsers = [];
    }
    if (!Number.isFinite(user.referral.awardedMilestones)) {
      user.referral.awardedMilestones = 0;
    }
    return user;
  }

  function getCoinsFilePath() {
    const coinsDir = path.join(supportDir, "coins");
    if (!fs.existsSync(coinsDir)) fs.mkdirSync(coinsDir, { recursive: true });
    return path.join(coinsDir, "cloud-coins.json");
  }

  function loadCoinsSafe() {
    try {
      const coinsFile = getCoinsFilePath();
      if (!fs.existsSync(coinsFile)) return [];
      const raw = fs.readFileSync(coinsFile, "utf8").trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("⚠️ Failed to read cloud coins:", err.message);
      return [];
    }
  }

  function saveCoinsSafe(coins) {
    const coinsFile = getCoinsFilePath();
    fs.writeFileSync(coinsFile, JSON.stringify(coins, null, 2));
    syncCoinsLedgerFromWallets(supportDir, coins);
  }

  function creditUserCoins(uid, amount, reason, meta = {}) {
    const value = Number(amount) || 0;
    if (!uid || value <= 0) return false;

    const users = readStore("users.json", []);
    const user = users.find((u) => String(u.uid) === String(uid));

    const coins = loadCoinsSafe();
    let wallet = coins.find((c) => String(c.userUID) === String(uid));
    if (!wallet) {
      wallet = {
        userUID: uid,
        email: user?.email || null,
        username: user?.username || user?.name || user?.email || "Unknown",
        balance: 0,
        createdAt: new Date().toISOString(),
        transactions: [],
      };
      coins.push(wallet);
    }

    if (!Array.isArray(wallet.transactions)) wallet.transactions = [];
    wallet.balance = Number(wallet.balance) || 0;
    wallet.balance += value;
    wallet.transactions.push({
      id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type: "referral_milestone_reward",
      amount: value,
      reason,
      meta,
      timestamp: new Date().toISOString(),
    });

    saveCoinsSafe(coins);
    return true;
  }

  function debitUserCoins(uid, amount, reason, meta = {}) {
    const value = Math.floor(Number(amount) || 0);
    if (!uid || value <= 0) {
      return { success: false, code: "invalid_amount", balance: 0 };
    }

    const users = readStore("users.json", []);
    const user = users.find((u) => String(u.uid) === String(uid));
    const normalizedUserEmail = normalizeEmail(user?.email || "");

    const coins = loadCoinsSafe();
    const wallet = coins.find((c) => {
      if (String(c.userUID || "") === String(uid)) return true;
      if (!normalizedUserEmail) return false;
      return normalizeEmail(c.email || "") === normalizedUserEmail;
    });
    if (!wallet) {
      return { success: false, code: "wallet_not_found", balance: 0 };
    }

    if (!Array.isArray(wallet.transactions)) wallet.transactions = [];
    wallet.balance = Math.floor(Number(wallet.balance) || 0);

    if (wallet.balance < value) {
      return {
        success: false,
        code: "insufficient_balance",
        balance: wallet.balance,
      };
    }

    wallet.balance -= value;
    const txId = `SPEND-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    wallet.transactions.push({
      id: txId,
      type: "plan_discount_spend",
      amount: -value,
      reason,
      meta,
      timestamp,
    });

    saveCoinsSafe(coins);
    return {
      success: true,
      code: "ok",
      spent: value,
      balanceAfter: wallet.balance,
      transactionId: txId,
      timestamp,
    };
  }

  function hasCompletedPaidPurchase(uid) {
    const purchases = readStore("purchases.json", []);
    return purchases.some((p) => {
      if (String(p?.uid || "") !== String(uid || "")) return false;
      const isCompleted = p?.status === "completed" || p?.isActive === true;
      const paid = Number(p?.finalAmount ?? p?.amount ?? 0) > 0;
      return isCompleted && paid;
    });
  }

  function attachReferrerToUserIfEligible(targetUid, referrerUidRaw) {
    const referrerUid = String(referrerUidRaw || "")
      .trim()
      .toUpperCase();
    if (!targetUid || !referrerUid) return false;

    const users = readStore("users.json", []);
    const targetIdx = users.findIndex(
      (u) => String(u.uid) === String(targetUid),
    );
    if (targetIdx === -1) return false;

    const referrer = users.find((u) => String(u.uid) === referrerUid);
    if (!referrer) return false;
    if (String(targetUid) === String(referrerUid)) return false;

    const target = ensureReferralState(users[targetIdx]);
    if (target.referral.referredByUID) return false;
    if (hasCompletedPaidPurchase(targetUid)) return false;

    target.referral.referredByUID = referrerUid;
    target.referral.referredBySetAt = new Date().toISOString();
    writeStore("users.json", users);
    return true;
  }

  function isReferralDiscountEligible(uid) {
    if (!uid) return false;
    const users = readStore("users.json", []);
    const user = users.find((u) => String(u.uid) === String(uid));
    if (!user) return false;
    ensureReferralState(user);

    if (!user.referral.referredByUID) return false;
    if (user.referral.firstPurchaseDiscountUsed === true) return false;
    if (hasCompletedPaidPurchase(uid)) return false;
    return true;
  }

  function finalizeReferralFirstPurchaseDiscount(uid, meta = {}) {
    if (!uid) return false;
    const users = readStore("users.json", []);
    const idx = users.findIndex((u) => String(u.uid) === String(uid));
    if (idx === -1) return false;
    const user = ensureReferralState(users[idx]);
    if (user.referral.firstPurchaseDiscountUsed === true) return false;
    user.referral.firstPurchaseDiscountUsed = true;
    user.referral.firstPurchaseDiscountUsedAt = new Date().toISOString();
    if (meta && typeof meta === "object") {
      user.referral.firstPurchaseDiscountUsedMeta = {
        plan: meta.plan || null,
        transactionId: meta.transactionId || null,
        source: meta.source || null,
      };
    }
    writeStore("users.json", users);
    return true;
  }

  function registerSuccessfulReferralPurchase(referredUid, purchaseMeta = {}) {
    if (!referredUid) return;

    const users = readStore("users.json", []);
    const referredIdx = users.findIndex(
      (u) => String(u.uid) === String(referredUid),
    );
    if (referredIdx === -1) return;

    const referredUser = ensureReferralState(users[referredIdx]);
    const referrerUid = String(referredUser.referral.referredByUID || "");
    if (!referrerUid) return;

    if (referredUser.referral.successfulPurchaseCounted === true) return;
    finalizeReferralFirstPurchaseDiscount(referredUid, purchaseMeta);
    referredUser.referral.successfulPurchaseCounted = true;
    referredUser.referral.successfulPurchaseAt = new Date().toISOString();
    referredUser.referral.successfulPurchaseMeta = {
      plan: purchaseMeta.plan || null,
      transactionId: purchaseMeta.transactionId || null,
      source: purchaseMeta.source || null,
    };

    const referrerIdx = users.findIndex(
      (u) => String(u.uid) === String(referrerUid),
    );
    if (referrerIdx !== -1) {
      const referrer = ensureReferralState(users[referrerIdx]);
      const list = referrer.referral.successfulReferredUsers;
      if (!list.includes(String(referredUid))) {
        list.push(String(referredUid));
      }
      referrer.referral.successfulReferralsCount = list.length;

      const reachedMilestones = Math.floor(
        list.length / REFERRAL_SUCCESS_TARGET,
      );
      const awardedMilestones =
        Number(referrer.referral.awardedMilestones) || 0;
      if (reachedMilestones > awardedMilestones) {
        const newlyReached = reachedMilestones - awardedMilestones;
        const coinsToAward = newlyReached * REFERRAL_REWARD_COINS;
        creditUserCoins(
          referrer.uid,
          coinsToAward,
          `Referral milestone reward (${list.length} successful referrals)`,
          {
            milestoneTarget: REFERRAL_SUCCESS_TARGET,
            successfulReferrals: list.length,
            referredUid,
          },
        );
        referrer.referral.awardedMilestones = reachedMilestones;
        referrer.referral.lastMilestoneAwardAt = new Date().toISOString();
        referrer.referral.lastMilestoneAwardCoins = coinsToAward;
      }
    }

    writeStore("users.json", users);
  }

  function readJsonSafe(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      const raw = fs.readFileSync(filePath, "utf8");
      if (!raw || !raw.trim()) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("⚠️ Failed to read JSON:", filePath, err.message);
      return fallback;
    }
  }

  function findLatestApprovedProof(uid, plan) {
    const proofs = readStore("proofs.json", []);
    const matches = proofs.filter(
      (p) =>
        String(p.uid) === String(uid) &&
        String(p.plan).toLowerCase() === String(plan).toLowerCase() &&
        (p.status === "approved" || p.verified === true),
    );
    if (!matches.length) return null;
    return matches.sort(
      (a, b) =>
        new Date(b.verifiedAt || b.createdAt || 0) -
        new Date(a.verifiedAt || a.createdAt || 0),
    )[0];
  }

  function findActivePlan(uid, plan) {
    const planActive = readStore("plan-active.json", []);
    const entry = planActive.find((p) => String(p.uid) === String(uid));
    if (!entry || !Array.isArray(entry.plans)) return null;
    const now = Date.now();
    return entry.plans.find(
      (pl) =>
        String(pl.plan).toLowerCase() === String(plan).toLowerCase() &&
        (pl.isActive || pl?.status?.isActive || pl?.status?.planActive) &&
        (!(pl.expiresAt || pl?.transaction?.expiresAt) ||
          new Date(pl.expiresAt || pl?.transaction?.expiresAt).getTime() > now),
    );
  }

  function isAdminAssignedPlan(planRecord) {
    if (!planRecord || typeof planRecord !== "object") return false;
    const paymentMethod = String(
      planRecord?.transaction?.paymentMethod || "",
    ).toLowerCase();
    const source = String(
      planRecord?.source || planRecord?.transaction?.source || "",
    ).toLowerCase();
    const label = String(
      planRecord?.actionLabel || planRecord?.transaction?.actionLabel || "",
    ).toLowerCase();
    return (
      paymentMethod === "admin-manual" ||
      source === "admin-set-plan" ||
      label.includes("admin set plan")
    );
  }

  function upsertActivePlan2FA(uid, plan, pin) {
    const planActive = readStore("plan-active.json", []);
    const idx = planActive.findIndex((p) => String(p.uid) === String(uid));
    if (idx === -1 || !Array.isArray(planActive[idx].plans)) return false;

    const pIdx = planActive[idx].plans.findIndex(
      (pl) => String(pl.plan).toLowerCase() === String(plan).toLowerCase(),
    );
    if (pIdx === -1) return false;

    planActive[idx].plans[pIdx].plan2faPin = pin;
    planActive[idx].plans[pIdx].plan2faSetAt = new Date().toISOString();
    return writeStore("plan-active.json", planActive);
  }

  function getUserEmailByUID(uid) {
    const users = readStore("users.json", []);
    const user = users.find((u) => String(u.uid) === String(uid));
    return user ? user.email : null;
  }

  function getActiveToken(uid, plan) {
    const tokenData = readStore("tokens.json", { tokens: [] });
    const tokens = Array.isArray(tokenData.tokens) ? tokenData.tokens : [];
    return tokens
      .filter(
        (t) =>
          String(t.uid) === String(uid) &&
          String(t.plan).toLowerCase() === String(plan).toLowerCase() &&
          t.active &&
          !t.used,
      )
      .sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      )[0];
  }

  const DEFAULT_PLAN_PAYLOAD = {
    plans: {
      silver: {
        key: "silver",
        name: "Silver",
        amount: 5 * PRICE_PER_TB,
        storageTB: 5,
        durationDays: 30,
        note: "Monthly (30 days)",
      },
      gold: {
        key: "gold",
        name: "Gold",
        amount: 20 * PRICE_PER_TB,
        storageTB: 20,
        durationDays: 90,
        note: "Quarterly (90 days)",
      },
      platinum: {
        key: "platinum",
        name: "Platinum",
        amount: 100 * PRICE_PER_TB,
        storageTB: 100,
        durationDays: 180,
        note: "Half-yearly (180 days)",
      },
      ultra: {
        key: "ultra",
        name: "Ultra",
        amount: 200 * PRICE_PER_TB,
        storageTB: 200,
        durationDays: 365,
        note: "Yearly (1 year)",
      },
    },
    paymentMethods: {
      qr: { enabled: true, name: "UPI QR" },
      upiId: { enabled: true, name: "UPI ID" },
      card: { enabled: true, name: "Card" },
      netbanking: { enabled: true, name: "NetBanking" },
    },
    upiId: process.env.UPI_ID || "your_upi_id_here",
    lastUpdated: new Date().toISOString(),
    pricePerTB: PRICE_PER_TB,
  };

  // Start reminder scheduler once
  scheduleTokenExpiryReminders();

  function rebuildPlansWithRate(sourcePlans, rate) {
    const plans = {};
    Object.entries(sourcePlans || {}).forEach(([key, plan]) => {
      const storageTB = Number(plan.storageTB) || 0;
      const amount = Math.max(0, Math.round(storageTB * rate));
      plans[key] = { ...plan, key: plan.key || key, amount };
    });
    return plans;
  }

  function calcDurationDays(planDetails) {
    if (!planDetails) return 30;
    if (planDetails.durationMinutes) return planDetails.durationMinutes / 1440;
    if (planDetails.durationDays) return planDetails.durationDays;
    return 30;
  }

  function loadBackup() {
    try {
      if (!fs.existsSync(backupFile)) {
        return {
          version: "1.0",
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          expiredPlans: [],
          archivedPayments: [],
          archivedUsers: [],
          metadata: {
            totalBackupedPlans: 0,
            totalBackupedPayments: 0,
            totalBackupedUsers: 0,
            totalBackupSize: 0,
          },
        };
      }
      return JSON.parse(fs.readFileSync(backupFile, "utf8"));
    } catch (err) {
      console.error("❌ Error loading backup:", err);
      return {
        version: "1.0",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        expiredPlans: [],
        archivedPayments: [],
        archivedUsers: [],
        metadata: {
          totalBackupedPlans: 0,
          totalBackupedPayments: 0,
          totalBackupedUsers: 0,
          totalBackupSize: 0,
        },
      };
    }
  }

  function saveBackup(backup) {
    try {
      backup.lastUpdated = new Date().toISOString();
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      console.log("✅ Backup saved:", {
        plans: backup.metadata.totalBackupedPlans,
        payments: backup.metadata.totalBackupedPayments,
        users: backup.metadata.totalBackupedUsers,
      });
    } catch (err) {
      console.error("❌ Error saving backup:", err);
    }
  }

  function moveExpiredPlanToBackup(plan, users) {
    try {
      const backup = loadBackup();

      // Archive the expired plan
      const archivedPlan = { ...plan, archivedAt: new Date().toISOString() };
      if (archivedPlan.status) {
        archivedPlan.status.isActive = false;
      }
      backup.expiredPlans.push(archivedPlan);

      // Archive related user (if not already archived)
      const user = users.find((u) => u.uid === plan.uid);
      if (user && !backup.archivedUsers.find((au) => au.uid === user.uid)) {
        backup.archivedUsers.push({
          ...user,
          archivedAt: new Date().toISOString(),
        });
      }

      // Update metadata
      backup.metadata.totalBackupedPlans = backup.expiredPlans.length;
      backup.metadata.totalBackupedUsers = backup.archivedUsers.length;
      backup.metadata.totalBackupSize = JSON.stringify(backup).length;

      saveBackup(backup);
      console.log(
        `📦 Archived expired plan: ${plan._id} (${plan.plan}) for user ${plan.uid}`,
      );
    } catch (err) {
      console.error("❌ Error archiving plan:", err);
    }
  }

  function cleanupExpiredPlansOnStartup() {
    // Ensure backup file exists
    if (!fs.existsSync(backupFile)) {
      const initialBackup = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        expiredPlans: [],
        archivedPayments: [],
        archivedUsers: [],
        metadata: {
          totalBackupedPlans: 0,
          totalBackupedPayments: 0,
          totalBackupedUsers: 0,
          totalBackupSize: 0,
        },
      };
      fs.writeFileSync(backupFile, JSON.stringify(initialBackup, null, 2));
      console.log(
        `${colors.bright}${colors.cyan}📦 Backup File: ${colors.yellow}support/backup-Plan,payment,user.json${colors.reset}`,
      );
    }

    console.log(
      `\n${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
    );
    console.log(
      `${colors.blue}${colors.bright}🔍 MAINTENANCE CHECK${colors.reset}`,
    );
    console.log(
      `${colors.yellow}${colors.bright}⏳ Scanning for expired plans...${colors.reset}`,
    );
    try {
      const users = readStore("users.json", []);
      let purchases = readStore("purchases.json", []);
      const initialCount = purchases.length;
      let movedCount = 0;

      // Filter out and backup expired purchases
      purchases = purchases.filter((p) => {
        if (
          !p.expiresAt ||
          p.isBlocked ||
          (p.status && p.status !== "completed")
        ) {
          return true; // Keep it
        }

        const expiresAt = new Date(p.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) return true; // Keep invalid dates

        const msLeft = expiresAt.getTime() - Date.now();
        if (msLeft < 0) {
          // Backup and remove
          moveExpiredPlanToBackup(p, users);
          movedCount++;
          return false; // Remove from purchases
        }
        return true; // Keep it
      });

      // Save if any were removed
      const colors = {
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        white: "\x1b[37m",
        red: "\x1b[31m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        reset: "\x1b[0m",
        bright: "\x1b[1m",
      };
      if (movedCount > 0) {
        writeStore("purchases.json", purchases);
        console.log(
          `${colors.bright}${colors.yellow}⚠️  Cleanup Result: ${colors.magenta}${movedCount} ${colors.cyan}expired plan(s) archived ${colors.green}(${initialCount - movedCount} active)${colors.reset}`,
        );
      } else {
        console.log(
          `${colors.bright}${colors.green}✅ Cleanup Result: ${colors.cyan}No expired plans found - all active!${colors.reset}`,
        );
      }
    } catch (err) {
      console.error("❌ Startup cleanup error:", err);
    }
  }

  function scheduleTokenExpiryReminders() {
    if (remindersScheduled) return;
    remindersScheduled = true;

    // Run initial cleanup on startup
    cleanupExpiredPlansOnStartup();

    const run = () => {
      try {
        const users = readStore("users.json", []);

        // --- Token reminder / auto-expire ---
        if (tokensFile) {
          const tokensData = readStore("tokens.json", { tokens: [] });
          const tokens = tokensData.tokens || [];
          let tokensChanged = false;

          tokens.forEach((t) => {
            if (t.active === false) return;

            const expiresAt = new Date(t.expiresAt);
            if (Number.isNaN(expiresAt.getTime())) return;

            const msLeft = expiresAt.getTime() - Date.now();
            const daysLeft = msLeft / (1000 * 60 * 60 * 24);

            // Auto-expire
            if (daysLeft <= 0) {
              if (t.active !== false || !t.expiredNotified) {
                t.active = false;
                t.expiredAt = new Date().toISOString();
                tokensChanged = true;

                // Send cool upgrade mail on expiry
                const user = users.find(
                  (u) =>
                    u.uid === t.uid ||
                    normalizeEmail(u.email) === normalizeEmail(t.email),
                );
                const toEmail = t.email || user?.email;
                const username = user?.username || t.email || t.uid || "User";
                if (toEmail) {
                  const baseUrl = MAIL_BASE_URL;
                  const upgradeUrl = `${baseUrl}/upgrade-form.html?uid=${encodeURIComponent(
                    t.uid || "",
                  )}&plan=${encodeURIComponent(t.plan || "")}`;
                  sendStyledMail(
                    toEmail,
                    "🚀 Reactivate your Cloud Space plan",
                    `
                    <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                      <h2 style="margin:0 0 12px;color:#58a6ff;">Your plan has expired</h2>
                      <p style="margin:0 0 12px;">Hi <b>${username}</b>, your ${t.plan || "Cloud Space"} access just expired.</p>
                      <p style="margin:0 0 16px;">Jump back in with a quick renewal below.</p>
                      <a href="${upgradeUrl}" style="display:inline-block;padding:12px 20px;background:#ff7a18;background:linear-gradient(120deg,#ff7a18,#af002d 85%);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;">🔄 Renew Now</a>
                      <p style="margin:16px 0 0;font-size:12px;color:#8b949e;">If you already renewed, you can ignore this message.</p>
                    </div>
                    `,
                  );
                }
                t.expiredNotified = true;
                console.log(
                  `🔴 Token expired: ${t.uid} (${t.plan}) - Email: ${toEmail}`,
                );

                // Immediately backup expired token
                try {
                  const backup = loadBackup();
                  const archivedToken = {
                    ...t,
                    archivedAt: new Date().toISOString(),
                    type: "token",
                  };
                  if (archivedToken.status) {
                    archivedToken.status.isActive = false;
                  }
                  backup.expiredPlans.push(archivedToken);
                  backup.metadata.totalBackupedPlans =
                    backup.expiredPlans.length;
                  backup.metadata.totalBackupSize =
                    JSON.stringify(backup).length;
                  saveBackup(backup);
                  console.log(
                    `📦 Token archived immediately: ${t.uid} (${t.plan})`,
                  );
                } catch (backupErr) {
                  console.error(
                    "❌ Failed to backup expired token:",
                    backupErr?.message || backupErr,
                  );
                }
              }
              return;
            }

            // Reminder window
            if (
              (daysLeft <= REMINDER_LEAD_DAYS || msLeft <= REMINDER_LEAD_MS) &&
              !t.reminderSent
            ) {
              const user = users.find(
                (u) =>
                  u.uid === t.uid ||
                  normalizeEmail(u.email) === normalizeEmail(t.email),
              );
              const toEmail = t.email || user?.email;
              const username = user?.username || t.email || t.uid || "User";
              if (toEmail) {
                const baseUrl = MAIL_BASE_URL;
                const upgradeUrl = `${baseUrl}/upgrade-form.html?uid=${encodeURIComponent(
                  t.uid || "",
                )}&extend=1&source=email`;
                sendStyledMail(
                  toEmail,
                  "⏳ Your plan expires in SOON",
                  `
                  <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                    <h2 style="margin:0 0 12px;color:#58a6ff;">⚠️ Plan expiring soon</h2>
                    <p style="margin:0 0 12px;">Hi <b>${username}</b>, your plan and portal access token will expire on <b>${expiresAt.toLocaleDateString()}</b>.</p>
                    <p style="margin:0 0 16px;">Extend now to keep your storage and premium features active.</p>
                    <a href="${upgradeUrl}" style="display:inline-block;padding:12px 20px;background:#238636;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
                      🔄 Extend Plan
                    </a>
                    <p style="margin:16px 0 0;font-size:12px;color:#8b949e;">If you already renewed, you can ignore this message.</p>
                  </div>
                  `,
                );
              }
              t.reminderSent = true;
              t.remindedAt = new Date().toISOString();
              tokensChanged = true;
            }
          });

          if (tokensChanged) {
            writeStore("tokens.json", tokensData);
          }
        }

        // --- Plan expiry reminders (purchases) ---
        let purchasesChanged = false;
        {
          const purchases = readStore("purchases.json", []);
          purchases.forEach((p, idx) => {
            if (!p.expiresAt) return;
            if (p.isBlocked) return;
            if (p.status && p.status !== "completed") return;

            const expiresAt = new Date(p.expiresAt);
            if (Number.isNaN(expiresAt.getTime())) return;

            const msLeft = expiresAt.getTime() - Date.now();
            const daysLeft = msLeft / (1000 * 60 * 60 * 24);

            // Check for expired plans (send email once, after expiry)
            if (msLeft < 0 && !p.expiryEmailSent) {
              const uid = p.uid;
              const user = users.find((u) => u.uid === uid);
              const toEmail = p.email || user?.email;
              if (toEmail) {
                const username = user?.username || p.username || toEmail;
                const planLabel = p.planDisplay || p.plan || "Plan";
                const baseUrl = MAIL_BASE_URL;
                const upgradeUrl = `${baseUrl}/upgrade-form.html?uid=${encodeURIComponent(uid || "")}&plan=${encodeURIComponent(p.plan || "")}`;
                sendStyledMail(
                  toEmail,
                  "🚀 Reactivate your Cloud Space plan",
                  `
                  <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                    <h2 style="margin:0 0 12px;color:#58a6ff;">Your plan has expired</h2>
                    <p style="margin:0 0 12px;">Hi <b>${username}</b>, your ${planLabel} access just expired.</p>
                    <p style="margin:0 0 16px;">You've been downgraded to the normal upload experience. Jump back in with a quick renewal below.</p>
                    <a href="${upgradeUrl}" style="display:inline-block;padding:12px 20px;background:linear-gradient(120deg,#ff7a18,#af002d 85%);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;">🔄 Renew Now</a>
                    <p style="margin:16px 0 0;font-size:12px;color:#8b949e;">If you already renewed, you can ignore this message.</p>
                  </div>
                  `,
                );
              }
              // Backup the expired plan
              moveExpiredPlanToBackup(p, users);

              // Remove from purchases
              purchases.splice(idx, 1);
              purchasesChanged = true;
              return;
            }
            if (msLeft <= 0) return;

            const isShort = (p.durationDays || 0) < 1;
            const uid = p.uid;
            const user = users.find((u) => u.uid === uid);
            const toEmail = p.email || user?.email;
            if (!toEmail) return;
            const username = user?.username || p.username || toEmail;
            const planLabel = p.planDisplay || p.plan || "Plan";
            const baseUrl = MAIL_BASE_URL;
            const upgradeUrl = `${baseUrl}/upgrade-form.html?uid=${encodeURIComponent(
              uid || "",
            )}&extend=1&source=email&plan=${encodeURIComponent(p.plan || "")}`;
            const expiryText = expiresAt.toLocaleString();

            const sendReminder = (name, msg) => {
              sendStyledMail(
                toEmail,
                `⏳ ${planLabel} expires soon`,
                `
                <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                  <h2 style="margin:0 0 12px;color:#58a6ff;">${msg}</h2>
                  <p style="margin:0 0 12px;">Hi <b>${username}</b>, your current plan <b>${planLabel}</b> will expire on <b>${expiryText}</b>.</p>
                  <p style="margin:0 0 12px;">Extend now to avoid downgrading to the normal upload page.</p>
                  <a href="${upgradeUrl}" style="display:inline-block;padding:12px 20px;background:#238636;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
                    🔄 Extend Plan
                  </a>
                  <p style="margin:14px 0 0;font-size:12px;color:#8b949e;">If you already renewed, ignore this message. After expiry you will be redirected to the normal upload experience.</p>
                </div>
                `,
              );
              purchasesChanged = true;
            };

            if (isShort) {
              if (msLeft <= 3 * 60 * 1000 && !p.reminder3mSent) {
                sendReminder(
                  "Expiring in minutes",
                  "⏳ Plan expires in 3 minutes",
                );
                purchases[idx].reminder3mSent = true;
              }
              return;
            }

            if (daysLeft <= 3 && !p.reminder3dSent) {
              sendReminder("Expiring in 3 days", "⏳ Plan expires in 3 days");
              purchases[idx].reminder3dSent = true;
            } else if (daysLeft <= 2 && !p.reminder2dSent) {
              sendReminder("Expiring in 2 days", "⏳ Plan expires in 2 days");
              purchases[idx].reminder2dSent = true;
            } else if (daysLeft <= 1 && !p.reminder1dSent) {
              sendReminder("Expiring tomorrow", "⏳ Plan expires in 1 day");
              purchases[idx].reminder1dSent = true;
            } else if (msLeft <= 10 * 60 * 1000 && !p.reminder10mSent) {
              sendReminder("Expiring shortly", "⏳ Plan expires in 10 minutes");
              purchases[idx].reminder10mSent = true;
            }
          });

          if (purchasesChanged) {
            writeStore("purchases.json", purchases);
          }
        }

        // --- Also check plan-active.json for expired plans (derived file) ---
        try {
          const planActiveData = readStore("plan-active.json", []);
          if (planActiveData.length > 0) {
            let planActiveChanged = false;

            planActiveData.forEach((userPlan, idx) => {
              if (!userPlan.plans || userPlan.plans.length === 0) return;

              const uid = userPlan.self?.uid || userPlan.uid;
              const originalLength = userPlan.plans.length;

              userPlan.plans = userPlan.plans.filter((plan) => {
                // Check both plan.expiresAt and plan.transaction.expiresAt
                const expiresAtString =
                  plan.expiresAt || plan.transaction?.expiresAt;
                if (!expiresAtString) return true; // Keep plans without expiry

                const expiresAt = new Date(expiresAtString);
                if (Number.isNaN(expiresAt.getTime())) return true;

                const msLeft = expiresAt.getTime() - Date.now();

                // Check if plan is expired
                if (msLeft < 0) {
                  const user = users.find((u) => u.uid === uid);
                  const toEmail = plan.email || user?.email;

                  // Send expiry email only once
                  if (!plan.expiryEmailSent && toEmail) {
                    const username = user?.username || plan.username || toEmail;
                    const planLabel = plan.planDisplay || plan.plan || "Plan";
                    const baseUrl = MAIL_BASE_URL;
                    const upgradeUrl = `${baseUrl}/upgrade-form.html?uid=${encodeURIComponent(
                      uid || "",
                    )}&plan=${encodeURIComponent(plan.plan || "")}`;
                    sendStyledMail(
                      toEmail,
                      "🚀 Reactivate your Cloud Space plan",
                      `
                      <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                        <h2 style="margin:0 0 12px;color:#58a6ff;">Your plan has expired</h2>
                        <p style="margin:0 0 12px;">Hi <b>${username}</b>, your ${planLabel} access just expired.</p>
                        <p style="margin:0 0 16px;">You've been downgraded to the normal upload experience. Jump back in with a quick renewal below.</p>
                        <a href="${upgradeUrl}" style="display:inline-block;padding:12px 20px;background:linear-gradient(120deg,#ff7a18,#af002d 85%);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;">🔄 Renew Now</a>
                        <p style="margin:16px 0 0;font-size:12px;color:#8b949e;">If you already renewed, you can ignore this message.</p>
                      </div>
                      `,
                    );
                  }

                  // Backup the expired plan from plan-active.json
                  try {
                    const backup = loadBackup();
                    const archivedPlan = {
                      ...plan,
                      uid: uid,
                      archivedAt: new Date().toISOString(),
                      source: "plan-active.json",
                    };
                    if (archivedPlan.status) {
                      archivedPlan.status.isActive = false;
                    }
                    backup.expiredPlans.push(archivedPlan);
                    backup.metadata.totalBackupedPlans =
                      backup.expiredPlans.length;
                    backup.metadata.totalBackupSize =
                      JSON.stringify(backup).length;
                    saveBackup(backup);
                    console.log(
                      `📦 Plan archived from plan-active.json: ${uid} (${plan.plan})`,
                    );
                  } catch (backupErr) {
                    console.error(
                      "❌ Failed to backup plan from plan-active.json:",
                      backupErr?.message || backupErr,
                    );
                  }

                  // Return false to remove from array
                  return false;
                }

                return true; // Keep non-expired plans
              });

              // If plans were removed, update flag
              if (userPlan.plans.length !== originalLength) {
                planActiveChanged = true;
              }

              // If all plans were removed, mark user as inactive in plan-active.json
              if (userPlan.plans.length === 0) {
                userPlan.planActive = false;
                userPlan.isActive = false;
              }
            });

            if (planActiveChanged) {
              writeStore("plan-active.json", planActiveData);
              console.log("✅ plan-active.json updated: expired plans removed");
            }
          }
        } catch (err) {
          console.error("⚠️ plan-active.json expiry check failed:", err);
        }
      } catch (err) {
        console.error("⚠️ Reminder scan failed:", err);
      }
    };

    // Run immediately, then every 5 seconds for real-time token expiry detection
    run();
    setInterval(run, 5 * 1000);
  }

  function ensurePlanPriceFile() {
    try {
      if (fs.existsSync(planPriceFile)) return;
      const rate = PRICE_PER_TB;
      const upi = process.env.UPI_ID || "your_upi_id_here";
      const plans = rebuildPlansWithRate(DEFAULT_PLAN_PAYLOAD.plans, rate);
      const payload = {
        plans,
        upiId: upi,
        pricePerTB: rate,
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(planPriceFile, JSON.stringify(payload, null, 2));
      console.log("✅ plan-price.json auto-created with defaults");
    } catch (err) {
      console.error("⚠️ Failed to create plan-price.json", err);
    }
  }

  function loadPlans() {
    try {
      const rate = PRICE_PER_TB;
      let fileData = null;
      let shouldRewrite = false;

      if (fs.existsSync(planPriceFile)) {
        fileData = JSON.parse(fs.readFileSync(planPriceFile, "utf8"));
      } else {
        console.warn(
          `${colors.yellow}${colors.bright}⚠️ plan-price.json not found, creating with defaults${colors.reset}`,
        );
        fileData = { ...DEFAULT_PLAN_PAYLOAD };
        shouldRewrite = true;
      }

      // Merge defaults to ensure new plans like flash40 exist even if plan-price.json is older
      const mergedPlans = {
        ...DEFAULT_PLAN_PAYLOAD.plans,
        ...(fileData.plans || {}),
      };
      const rebuiltPlans = rebuildPlansWithRate(mergedPlans, rate);
      PLANS = rebuiltPlans;
      PLANS_CONFIG = fileData; // Store full config including paymentMethods

      // Log AFTER PLANS is populated

      const envPricePerTB = Number(rate);
      const envUpiId = process.env.UPI_ID || "your_upi_id_here";
      let amountsNeedUpdate = false;
      if (fileData.plans) {
        Object.entries(fileData.plans).forEach(([key, plan]) => {
          const expectedAmount = Math.round(
            (plan.storageTB || 0) * envPricePerTB,
          );
          if (plan.amount !== expectedAmount) {
            amountsNeedUpdate = true;
          }
        });
      }

      const missingDefaults = Object.keys(DEFAULT_PLAN_PAYLOAD.plans).some(
        (k) => !(fileData.plans || {})[k],
      );
      const missingPaymentMethods =
        !fileData.paymentMethods ||
        Object.keys(DEFAULT_PLAN_PAYLOAD.paymentMethods).some(
          (k) => !(fileData.paymentMethods || {})[k],
        );

      if (
        shouldRewrite ||
        missingDefaults ||
        missingPaymentMethods ||
        fileData.pricePerTB !== envPricePerTB ||
        fileData.upiId !== envUpiId ||
        amountsNeedUpdate
      ) {
        fileData.pricePerTB = envPricePerTB;
        fileData.upiId = envUpiId;
        fileData.paymentMethods = {
          ...DEFAULT_PLAN_PAYLOAD.paymentMethods,
          ...(fileData.paymentMethods || {}),
        };
        fileData.plans = {
          ...DEFAULT_PLAN_PAYLOAD.plans,
          ...(fileData.plans || {}),
        };
        Object.entries(fileData.plans || {}).forEach(([key, plan]) => {
          fileData.plans[key].amount = Math.round(
            (plan.storageTB || 0) * envPricePerTB,
          );
        });
        fileData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(planPriceFile, JSON.stringify(fileData, null, 2));
        logPlanConfigurationLoaded(
          "plan-price.json",
          Object.keys(PLANS).length,
          envPricePerTB,
          true,
        );
      } else {
        logPlanConfigurationLoaded(
          "plan-price.json",
          Object.keys(PLANS).length,
          envPricePerTB,
          false,
        );
      }

      // Log payment methods configuration on startup
      if (PLANS_CONFIG?.paymentMethods) {
        logPaymentMethodsLoaded(PLANS_CONFIG.paymentMethods);
      }
    } catch (err) {
      console.error("❌ Error loading plans:", err);
      PLANS = DEFAULT_PLAN_PAYLOAD.plans;
    }
  }

  ensurePlanPriceFile();
  loadPlans();

  let planReloadTimer = null;
  fs.watchFile(planPriceFile, { interval: 1000 }, () => {
    if (planReloadTimer) return;
    planReloadTimer = setTimeout(() => {
      planReloadTimer = null;
      console.log("♻️ Detected plan-price.json change → reloading plans");
      loadPlans();
    }, 500);
  });

  function readPlanActiveFile() {
    try {
      return readStore("plan-active.json", []);
    } catch (err) {
      console.error("⚠️ Failed to read plan-active.json", err);
      return [];
    }
  }

  function writePlanActiveFile(data) {
    try {
      writeStore("plan-active.json", data);
    } catch (err) {
      console.error("⚠️ Failed to write plan-active.json", err);
    }
  }

  function pickLatestPlan(plans) {
    return (plans || []).slice().sort((a, b) => {
      const aTs = new Date(
        a?.transaction?.activatedAt || a?.transaction?.purchasedAt || 0,
      ).getTime();
      const bTs = new Date(
        b?.transaction?.activatedAt || b?.transaction?.purchasedAt || 0,
      ).getTime();
      return bTs - aTs;
    })[0];
  }

  function isPlanCurrentlyActive(plan) {
    if (!plan || typeof plan !== "object") return false;

    const status = plan.status || {};
    const tx = plan.transaction || {};
    const now = Date.now();

    const expiresAt = tx.expiresAt || status.expiresAt || null;
    const expiryTs = expiresAt ? new Date(expiresAt).getTime() : null;
    const isExpired =
      typeof expiryTs === "number" &&
      !Number.isNaN(expiryTs) &&
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
      statusText === "active";

    if (explicitActive) return true;

    return (
      typeof expiryTs === "number" && !Number.isNaN(expiryTs) && expiryTs > now
    );
  }

  function getActivePlanSnapshot(uid) {
    const planActive = readPlanActiveFile();
    const entry = planActive.find((u) => u?.self?.uid === uid);
    const fallback = {
      plan: "free",
      storageTB: 0.5,
      planExpiry: null,
      purchasedAt: null,
      source: null,
      actionLabel: null,
      isAdminAssigned: false,
    };

    // First, check activePlans from Kundli manager (USER-pay-kundli.JSON)
    try {
      const users = getUsersList();
      const user = users.find((u) => u.uid === uid);
      if (user && user.activePlans && Array.isArray(user.activePlans)) {
        // Find the most recent active plan
        const activePlans = user.activePlans.filter((p) => {
          try {
            const planObj = typeof p === "string" ? JSON.parse(p) : p;
            if (!planObj || typeof planObj !== "object") return false;

            // Check if plan is currently active
            const status = planObj.status || {};
            const tx = planObj.transaction || {};
            const now = Date.now();

            const expiresAt =
              tx.expiresAt || status.expiresAt || planObj.expiresAt || null;
            const expiryTs = expiresAt ? new Date(expiresAt).getTime() : null;
            const isExpired =
              typeof expiryTs === "number" &&
              !Number.isNaN(expiryTs) &&
              expiryTs <= now;

            const statusText = String(
              status.status || planObj.status || tx.status || "",
            ).toLowerCase();

            const explicitInactive =
              status.planActive === false ||
              status.isActive === false ||
              planObj.isActive === false ||
              tx.isActive === false ||
              status.isBlocked === true ||
              planObj.isBlocked === true ||
              tx.isBlocked === true ||
              [
                "inactive",
                "blocked",
                "expired",
                "deactivated",
                "deleted",
              ].includes(statusText) ||
              isExpired;

            if (explicitInactive) return false;

            const explicitActive =
              status.planActive === true ||
              status.isActive === true ||
              planObj.isActive === true ||
              tx.isActive === true ||
              ["active", "completed"].includes(statusText);

            return (
              explicitActive ||
              (typeof expiryTs === "number" &&
                !Number.isNaN(expiryTs) &&
                expiryTs > now)
            );
          } catch (e) {
            return false;
          }
        });

        if (activePlans.length > 0) {
          // Get latest plan
          const latestPlan = activePlans[activePlans.length - 1];
          const planObj =
            typeof latestPlan === "string"
              ? JSON.parse(latestPlan)
              : latestPlan;

          const expiresAt =
            planObj.transaction?.expiresAt ||
            planObj.status?.expiresAt ||
            planObj.expiresAt ||
            null;
          const planExpiry = expiresAt ? new Date(expiresAt).getTime() : null;
          const purchasedAt = planObj.transaction?.purchasedAt
            ? new Date(planObj.transaction.purchasedAt).getTime()
            : null;
          const storageTB =
            planObj.planDetails?.storageTB ??
            planObj.planDetails?.storage ??
            0.5;

          return {
            plan: planObj.plan || "free",
            storageTB,
            planExpiry,
            purchasedAt,
            source: planObj.source || planObj.transaction?.source || null,
            actionLabel:
              planObj.actionLabel || planObj.transaction?.actionLabel || null,
            isAdminAssigned: true, // Plans in activePlans are admin-assigned
          };
        }
      }
    } catch (e) {
      console.warn("Could not read users from Kundli manager:", e.message);
    }

    // Fallback: Check for uiAccess field in users.json
    let uiAccessPlan = null;
    try {
      const users = readStore("users.json", []);
      const user = users.find((u) => u.uid === uid);
      if (user && user.uiAccess) {
        uiAccessPlan = user.uiAccess.toLowerCase();
        logUiAccessDecision(uid, uiAccessPlan);
      }
    } catch (error) {
      console.error("Error reading uiAccess:", error);
    }

    // If uiAccess is set, return it as the plan
    if (uiAccessPlan && ["platinum", "ultra"].includes(uiAccessPlan)) {
      return {
        plan: uiAccessPlan,
        storageTB: uiAccessPlan === "ultra" ? 200 : 100,
        planExpiry: null, // No expiry for uiAccess grants
        purchasedAt: null,
        source: "admin-set-plan",
        actionLabel: "Admin set plan",
        isAdminAssigned: true,
      };
    }

    if (!entry) return fallback;

    const plans = entry.plans || [];
    const activePlans = plans.filter((p) => isPlanCurrentlyActive(p));
    const chosen = pickLatestPlan(activePlans);
    if (!chosen) return fallback;

    const expiresAt =
      chosen.transaction?.expiresAt || chosen.status?.expiresAt || null;
    const planExpiry = expiresAt ? new Date(expiresAt).getTime() : null;
    const purchasedAt = chosen.transaction?.purchasedAt
      ? new Date(chosen.transaction.purchasedAt).getTime()
      : null;
    const storageTB =
      chosen.planDetails?.storageTB ?? chosen.planDetails?.storage ?? 0.5;

    return {
      plan: chosen.plan || "free",
      storageTB,
      planExpiry,
      purchasedAt,
      source: chosen.source || chosen.transaction?.source || null,
      actionLabel:
        chosen.actionLabel || chosen.transaction?.actionLabel || null,
      isAdminAssigned: isAdminAssignedPlan(chosen),
    };
  }

  // Helper: Check if user has an active plan of a specific type (prevents duplicate/spam purchases)
  function hasActivePlanOfType(uid, planType) {
    try {
      const purchases = readStore("purchases.json", []);

      // Check if user has an active, non-blocked purchase of the same plan type
      const activeExists = purchases.some(
        (p) =>
          p.uid === uid &&
          p.plan === planType &&
          p.isActive &&
          !p.isBlocked &&
          (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now()),
      );

      if (activeExists) {
        return true;
      }

      // Also check for uiAccess in users.json for platinum/ultra grants
      if (["platinum", "ultra"].includes(planType)) {
        const users = readStore("users.json", []);
        const user = users.find((u) => u.uid === uid);
        if (user && user.uiAccess && user.uiAccess.toLowerCase() === planType) {
          return true; // User already has uiAccess for this plan
        }
      }

      return false;
    } catch (err) {
      console.error("Error checking active plan:", err);
      return false; // On error, allow purchase to proceed (fail-open)
    }
  }

  // Helper: copy directories for Cloud+ UI
  function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return false;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    return true;
  }

  function getPlanUploadSize(plan) {
    const uploadSizes = {
      free: "100MB",
      silver: "500MB",
      gold: "2GB",
      platinum: "10GB",
      ultra: "50GB",
    };
    return uploadSizes[plan] || "100MB";
  }

  function getPlanFeatures(plan, storage, duration) {
    const features = {
      free: [`${storage}GB Storage`, `${duration} Day Duration`],
      silver: [
        `${storage}GB Storage`,
        `${duration} Day Duration`,
        "Basic Support",
      ],
      gold: [
        `${storage}GB Storage`,
        `${duration} Day Duration`,
        "Priority Support",
        "Bandwidth Boost",
      ],
      platinum: [
        `${storage}GB Storage`,
        `${duration} Day Duration`,
        "24/7 Support",
        "Advanced Features",
        "API Access",
      ],
      ultra: [
        `${storage}GB Storage`,
        `${duration} Day Duration`,
        "Premium Support",
        "Full API",
        "Custom Features",
        "Dedicated Manager",
      ],
    };
    return (
      features[plan] || [`${storage}GB Storage`, `${duration} Day Duration`]
    );
  }

  function generatePlanActiveData() {
    try {
      let purchases = readStore("purchases.json", []);
      const existingPlanActive = readPlanActiveFile();

      const migratedMap = new Map();
      existingPlanActive.forEach((entry) => {
        const hasMigrated = (entry.plans || []).some((p) => {
          const tid = p.transaction?.transactionId || p.recordId || "";
          return typeof tid === "string" && tid.startsWith("MIGRATED-");
        });
        if (hasMigrated && entry?.self?.uid) {
          migratedMap.set(entry.self.uid, entry);
        }
      });

      const userMap = {};
      const addedTransactions = new Set();

      purchases.forEach((purchase) => {
        const uid = purchase.uid;
        const txnId = purchase.transactionId || purchase._id;
        if (addedTransactions.has(txnId)) {
          console.log(`⚠️ Skipping duplicate transaction: ${txnId}`);
          return;
        }
        addedTransactions.add(txnId);

        if (!userMap[uid]) {
          userMap[uid] = {
            self: {
              uid: purchase.uid,
              email: purchase.email,
              username: purchase.username,
            },
            plans: [],
            summary: {
              totalPlans: 0,
              activePlans: 0,
              blockedPlans: 0,
              totalSpent: 0,
              totalDiscount: 0,
              totalStorage: 0,
              totalStorageTB: 0,
            },
          };
        }

        const existingPlan = userMap[uid].plans.find(
          (p) => p.transaction?.transactionId === txnId || p.recordId === txnId,
        );
        if (existingPlan) {
          console.log(`⚠️ Plan ${txnId} already exists for user ${uid}`);
          return;
        }

        const expiresTs = purchase.expiresAt
          ? new Date(purchase.expiresAt).getTime()
          : null;
        const isExpired = expiresTs ? expiresTs < Date.now() : false;

        const planRecord = {
          plan: purchase.plan,
          planDisplay:
            purchase.planDisplay ||
            purchase.plan.charAt(0).toUpperCase() +
              purchase.plan.slice(1) +
              " Plan",
          planDetails: {
            storage: purchase.storageTB,
            storageTB: purchase.storageTB,
            durationDays: purchase.durationDays,
            maxUploadSize: getPlanUploadSize(purchase.plan),
            features: getPlanFeatures(
              purchase.plan,
              purchase.storageTB,
              purchase.durationDays,
            ),
          },
          transaction: {
            transactionId: purchase.transactionId,
            paymentMethod: purchase.paymentMethod,
            currency: purchase.currency || "INR",
            amount: purchase.amount,
            amountDiscount: purchase.amountDiscount || 0,
            discountApplied: purchase.discountApplied || 0,
            finalAmount: purchase.finalAmount,
            purchasedAt: purchase.purchasedAt,
            activatedAt: purchase.activatedAt,
            expiresAt: purchase.expiresAt,
            status: purchase.status,
            notes: purchase.notes,
          },
          status: {
            isActive: purchase.isActive && !isExpired,
            isBlocked: purchase.isBlocked,
            blockedReason: purchase.blockedReason,
            blockedAt: purchase.blockedAt,
            planActive: purchase.isActive && !purchase.isBlocked && !isExpired,
          },
          recordId: purchase._id || txnId,
        };

        userMap[uid].plans.push(planRecord);
        userMap[uid].summary.totalPlans++;
        if (planRecord.status.isActive && !planRecord.status.isBlocked)
          userMap[uid].summary.activePlans++;
        if (purchase.isBlocked) userMap[uid].summary.blockedPlans++;
        userMap[uid].summary.totalSpent += purchase.finalAmount || 0;
        userMap[uid].summary.totalDiscount += purchase.amountDiscount || 0;
        userMap[uid].summary.totalStorage += purchase.storageTB || 0;
        userMap[uid].summary.totalStorageTB += purchase.storageTB || 0;
      });

      migratedMap.forEach((entry, uid) => {
        if (!userMap[uid]) {
          userMap[uid] = entry;
        } else {
          const existingPlans = userMap[uid].plans || [];
          const migratedPlans = entry.plans || [];
          userMap[uid].plans = [...existingPlans, ...migratedPlans];
        }
      });

      const planActiveData = Object.values(userMap).map((entry) => {
        const seenRecordIds = new Set();
        const uniquePlans = [];
        (entry.plans || []).forEach((p) => {
          const recordId = p.recordId || p.transaction?.transactionId;
          if (!seenRecordIds.has(recordId)) {
            seenRecordIds.add(recordId);
            uniquePlans.push(p);
          }
        });
        entry.plans = uniquePlans;

        const summary = {
          totalPlans: 0,
          activePlans: 0,
          blockedPlans: 0,
          totalSpent: 0,
          totalDiscount: 0,
          totalStorage: 0,
          totalStorageTB: 0,
        };

        entry.plans.forEach((p) => {
          summary.totalPlans += 1;
          if (p.status?.isActive && !p.status?.isBlocked)
            summary.activePlans += 1;
          if (p.status?.isBlocked) summary.blockedPlans += 1;
          summary.totalSpent += p.transaction?.finalAmount || 0;
          summary.totalDiscount += p.transaction?.amountDiscount || 0;
          summary.totalStorage += p.planDetails?.storage || 0;
          summary.totalStorageTB += p.planDetails?.storageTB || 0;
        });

        return { ...entry, summary };
      });

      writePlanActiveFile(planActiveData);
      console.log(
        "✅ plan-active.json generated with",
        planActiveData.length,
        "user(s)",
      );
      return planActiveData;
    } catch (err) {
      console.error("❌ Error generating plan-active.json:", err);
      return [];
    }
  }

  // Public: fetch current plan snapshot for a user by UID
  app.get("/user-plan/:uid", (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      if (!uid)
        return res
          .status(400)
          .json({ success: false, error: "UID is required" });
      const snapshot = getActivePlanSnapshot(uid);
      return res.json({ success: true, ...snapshot });
    } catch (err) {
      console.error("Error fetching plan snapshot", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // Public: fetch all active plan types for a user (for frontend spam prevention)
  app.get("/user-active-plans/:uid", (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      if (!uid)
        return res
          .status(400)
          .json({ success: false, error: "UID is required", activePlans: [] });

      const activePlans = [];
      const purchases = readStore("purchases.json", []);

      // Find all active, non-blocked purchases for this user
      const activePurchases = purchases.filter(
        (p) =>
          p.uid === uid &&
          p.isActive &&
          !p.isBlocked &&
          (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now()),
      );

      // Get unique plan types
      const planTypes = new Set(activePurchases.map((p) => p.plan));
      activePlans.push(...planTypes);

      // Also check for uiAccess in users.json for platinum/ultra grants
      try {
        const users = readStore("users.json", []);
        const user = users.find((u) => u.uid === uid);
        if (
          user &&
          user.uiAccess &&
          ["platinum", "ultra"].includes(user.uiAccess.toLowerCase())
        ) {
          if (!activePlans.includes(user.uiAccess.toLowerCase())) {
            activePlans.push(user.uiAccess.toLowerCase());
          }
        }
      } catch (e) {
        // Ignore errors reading users.json
      }

      return res.json({ success: true, activePlans });
    } catch (err) {
      console.error("Error fetching active plans:", err);
      return res
        .status(500)
        .json({ success: false, error: "Server error", activePlans: [] });
    }
  });

  // Authenticated: fetch payment history for a user (self or admin only)
  app.get("/api/user/payment-history/:uid", verifyToken, (req, res) => {
    try {
      const uid = String(req.params.uid || "").trim();
      if (!uid) {
        return res
          .status(400)
          .json({ success: false, error: "UID is required" });
      }

      const requesterUid = String(req.user?.uid || "").trim();
      const requesterRole = String(req.user?.role || "").toLowerCase();
      const isElevated =
        requesterRole === "admin" || requesterRole === "superadmin";

      if (!isElevated && requesterUid !== uid) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }

      const purchases = readStore("purchases.json", []);
      const userPurchases = purchases
        .filter((p) => String(p?.uid || "").trim() === uid)
        .map((p) => ({
          id: p._id || p.id || null,
          uid: p.uid || null,
          plan: p.plan || p.transaction?.plan || null,
          status: p.status || p.transaction?.status || null,
          isActive: p.isActive !== false,
          isBlocked: p.isBlocked === true,
          storageTB:
            p.storageTB ??
            p.planDetails?.storageTB ??
            p.transaction?.storageTB ??
            p.planDetails?.storage ??
            null,
          amount:
            p.amount ??
            p.transaction?.finalAmount ??
            p.transaction?.amount ??
            null,
          originalAmount:
            p.originalAmount ?? p.transaction?.originalAmount ?? null,
          discountAmount:
            p.discountApplied ?? p.transaction?.amountDiscount ?? null,
          paymentMethod:
            p.method || p.paymentMethod || p.transaction?.paymentMethod || null,
          transactionId:
            p.transactionId ||
            p.upi_txn_id ||
            p.transaction?.transactionId ||
            null,
          coupon: p.coupon || p.transaction?.coupon || null,
          purchasedAt:
            p.purchasedAt ||
            p.transaction?.purchasedAt ||
            p.createdAt ||
            p.verifiedAt ||
            null,
          expiresAt:
            p.expiresAt ||
            p.transaction?.expiresAt ||
            p.status?.expiresAt ||
            null,
        }))
        .sort((a, b) => {
          const ta = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0;
          const tb = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0;
          return tb - ta;
        });

      return res.json({
        success: true,
        uid,
        count: userPurchases.length,
        purchases: userPurchases,
      });
    } catch (err) {
      console.error("Error fetching user payment history:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // =============== ROUTES ===============
  app.get("/api/plans-pricing", (req, res) => {
    try {
      let plansData = [];
      if (fs.existsSync(planPriceFile)) {
        const content = fs.readFileSync(planPriceFile, "utf-8");
        const jsonData = JSON.parse(content);

        if (jsonData.plans && typeof jsonData.plans === "object") {
          Object.entries(jsonData.plans).forEach(([key, plan]) => {
            const priceInRupees = (plan.amount || 0) / 100;
            const storageGB = (plan.storageTB || 0) * 1024;

            plansData.push({
              name: plan.name || "Plan",
              price: priceInRupees,
              storage: storageGB > 0 ? plan.storageTB + " TB" : "0 GB",
              features: plan.features || [
                `${plan.storageTB || 0} TB Storage`,
                `${plan.durationDays || 30} Days Access`,
                plan.note || "",
              ],
              badge: key.toUpperCase(),
              key,
            });
          });
        } else if (Array.isArray(jsonData)) {
          plansData = jsonData.map((plan) => ({
            name: plan.name || "Plan",
            price: parseFloat(plan.price) || 0,
            storage: plan.storage || "0 GB",
            features: plan.features || [],
            badge: plan.badge || "PLAN",
          }));
        }
      }

      if (plansData.length === 0) {
        plansData = [
          {
            name: "Basic",
            price: 4.99,
            storage: "10 GB",
            features: ["10 GB Storage", "Basic Support", "5 File Uploads/Day"],
            badge: "STARTER",
          },
          {
            name: "Platinum",
            price: 19.99,
            storage: "1 TB",
            features: ["1 TB Storage", "24/7 Support", "Unlimited Uploads"],
            badge: "POPULAR",
          },
          {
            name: "Ultra",
            price: 49.99,
            storage: "Unlimited",
            features: [
              "Unlimited Storage",
              "Priority Support",
              "Advanced Analytics",
            ],
            badge: "ULTIMATE",
          },
        ];
      }

      return res.json(plansData);
    } catch (error) {
      console.error("Error fetching plans pricing:", error);
      return res
        .status(500)
        .json({ success: false, error: "Error loading plans" });
    }
  });

  app.get("/get-platinum-token/:uid", (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      const plan =
        String(req.query.plan || "")
          .toLowerCase()
          .trim() || null;

      if (!uid) {
        console.error("❌ No UID provided");
        return res.status(400).json({ success: false, error: "UID required" });
      }

      // Get token directly from tokens.json
      const tokenEntry = getTokenByUID(uid, plan);

      if (!tokenEntry) {
        console.error(
          "❌ No token entry found for UID:",
          uid,
          plan ? `plan: ${plan}` : "",
        );
        return res
          .status(404)
          .json({ success: false, error: "No active token for this user" });
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");

      // Return the reference token from tokens.json
      return res.json({
        success: true,
        token: tokenEntry.token, // TOK-CS############ format
      });
    } catch (err) {
      console.error("❌ Error in /get-platinum-token:", err);
      return res
        .status(500)
        .json({ success: false, error: "Server error: " + err.message });
    }
  });

  app.get("/api/plans", (req, res) => {
    loadPlans();
    res.setHeader("Cache-Control", "no-store");
    const paymentMethods = PLANS_CONFIG?.paymentMethods || {
      qr: { enabled: true, name: "UPI QR" },
      upiId: { enabled: true, name: "UPI ID" },
      card: { enabled: false, name: "Card" },
      netbanking: { enabled: false, name: "NetBanking" },
    };

    // Cool console output for payment methods
    console.log(
      `\n${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
    );
    console.log(
      `${colors.magenta}${colors.bright}💳 PAYMENT METHODS STATUS${colors.reset}\n`,
    );
    console.log(
      `${colors.bright}${colors.cyan}📤 API Response: ${colors.yellow}/api/plans${colors.reset}\n`,
    );

    Object.entries(paymentMethods).forEach(([key, method]) => {
      const statusIcon = method.enabled ? "✅" : "🔒";
      const statusText = method.enabled
        ? `${colors.green}ENABLED `
        : `${colors.yellow}DISABLED`;
      const methodName = `${colors.bright}${colors.white}${method.name || key}${colors.reset}`;
      console.log(
        `   ${statusIcon} ${methodName.padEnd(30)} ${statusText}${colors.reset}`,
      );
    });

    res.json({
      success: true,
      plans: PLANS,
      pricePerTB: PRICE_PER_TB,
      paymentMethods: paymentMethods,
      upiId: UPI_ID,
      upiName: UPI_NAME,
    });
  });

  // Verify Account Holder Name (for NetBanking)
  app.post("/api/verify-account-holder", (req, res) => {
    try {
      const { accountNumber, ifscCode } = req.body;

      // Validate inputs
      if (!accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          error: "Account number and IFSC code required",
        });
      }

      console.log(
        `${colors.cyan}🔍 Account Verification Request:${colors.reset}`,
      );
      console.log(`   Account: ****${accountNumber.slice(-4)}`);
      console.log(`   IFSC: ${ifscCode}`);

      // In production, this would call real bank API
      // For now, we'll use a mapping based on account number to show correct names
      // This demonstrates the flow - replace with real bank verification API

      // Sample account database (in production, this would be from bank API)
      const accountDatabase = {
        // Format: "accountNumber-ifscCode": "Account Holder Name"
        "1234567890-SBIN0001234": "RAJESH KUMAR SHARMA",
        "9876543210-HDFC0002567": "PRIYA SINGH",
        "1111111111-ICIC0003890": "AMIT PATEL",
        "2222222222-UTIB0004123": "SNEHA GUPTA",
        "3333333333-KKBK0005456": "VIKRAM REDDY",
        "4444444444-PUNB0006789": "SHIVAM M DAVE",
        "5555555555-BARB0007012": "RAHUL MEHTA",
        "6666666666-CNRB0008345": "ANJALI KAPOOR",
      };

      // Try exact match first
      const key = `${accountNumber}-${ifscCode}`;
      let accountHolderName = accountDatabase[key];

      // If no exact match, generate from account number pattern
      // (In production, you'd reject the request or call bank API)
      if (!accountHolderName) {
        // Generate consistent name based on account number
        const names = [
          "RAJESH KUMAR SHARMA",
          "PRIYA SINGH",
          "AMIT PATEL",
          "SNEHA GUPTA",
          "VIKRAM REDDY",
          "POOJA VERMA",
          "RAHUL MEHTA",
          "ANJALI KAPOOR",
          "NEHA SHARMA",
          "ROHAN PATEL",
        ];
        const index = parseInt(accountNumber.slice(-1)) % names.length;
        accountHolderName = names[index];
      }

      console.log(`   ✅ Account Holder: ${accountHolderName}`);

      res.json({
        success: true,
        accountNumber: "****" + accountNumber.slice(-4),
        ifscCode: ifscCode,
        accountHolderName: accountHolderName,
        verified: true,
      });
    } catch (error) {
      console.error(
        `${colors.red}❌ Account verification error:${colors.reset}`,
        error.message,
      );
      res.status(500).json({
        success: false,
        error: "Account verification failed",
      });
    }
  });

  app.post("/admin/reload-plans", verifyToken, isAdmin, (req, res) => {
    loadPlans();
    res.json({ success: true, message: "Plans reloaded", plans: PLANS });
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Lightweight token status check for client-side expiry handling
  app.get("/token-status", (req, res) => {
    try {
      const token = req.query.token;
      if (!token)
        return res
          .status(400)
          .json({ success: false, valid: false, msg: "token required" });
      const ref = validateToken(token);
      if (!ref) return res.json({ success: true, valid: false, expired: true });
      const expiresAt = ref.expiresAt
        ? new Date(ref.expiresAt).toISOString()
        : null;
      const expired = expiresAt
        ? new Date(expiresAt).getTime() < Date.now()
        : false;
      res.json({
        success: true,
        valid: !expired,
        expired,
        expiresAt,
        uid: ref.uid,
        plan: ref.plan,
      });
    } catch (err) {
      console.error("token-status error", err);
      res
        .status(500)
        .json({ success: false, valid: false, msg: "server error" });
    }
  });

  function logPurchase(
    userData,
    plan,
    amount,
    amountDiscount,
    discountPercent,
    finalAmount,
    paymentMethod,
    transactionId,
    proofId = null,
    cardLast4 = null,
    notes = "",
    planDetailsOverride = null,
    { allowExtend = false } = {},
  ) {
    try {
      let purchases = readStore("purchases.json", []);

      const planDetails = planDetailsOverride || PLANS[plan] || {};
      const durationMs = planDetails.durationMinutes
        ? planDetails.durationMinutes * 60 * 1000
        : (planDetails.durationDays || 30) * 24 * 60 * 60 * 1000;

      // If this is an email/link-based extension, update the latest active purchase instead of creating a new one
      if (allowExtend) {
        let renewalUiLink = "";
        let renewalToken = "";
        const existingIdx = purchases.findIndex(
          (p) =>
            p.uid === userData.uid &&
            p.plan === plan &&
            p.isActive &&
            !p.isBlocked,
        );
        if (existingIdx !== -1) {
          const existing = purchases[existingIdx];
          const baseExpiry = existing.expiresAt
            ? new Date(existing.expiresAt).getTime()
            : Date.now();
          const newExpiry = new Date(
            Math.max(Date.now(), baseExpiry) + durationMs,
          ).toISOString();
          purchases[existingIdx] = {
            ...existing,
            proofId: proofId || existing.proofId,
            transactionId: transactionId || existing.transactionId,
            amount,
            amountDiscount,
            discountApplied: discountPercent,
            finalAmount,
            durationDays: durationMs / (24 * 60 * 60 * 1000),
            expiresAt: newExpiry,
            isActive: true,
            isBlocked: false,
            notes: notes || existing.notes,
            renewalAttempts: (existing.renewalAttempts || 0) + 1,
            lastRenewalAttempt: new Date().toISOString(),
          };
          writeStore("purchases.json", purchases);
          generatePlanActiveData();

          // Auto-create/refresh token for all paid plans on renewal.
          if (plan !== "free" && userData.uid && userData.email) {
            createPlatinumToken(
              userData.uid,
              plan,
              userData.email,
              null,
              planDetails.durationMinutes
                ? planDetails.durationMinutes / 1440
                : planDetails.durationDays || 30,
            );
            // Reset reminder flags so next expiry reminder is sent on the new window
            try {
              if (fs.existsSync(tokensFile)) {
                const tokenData =
                  JSON.parse(fs.readFileSync(tokensFile, "utf8") || "{}") || {};
                if (Array.isArray(tokenData.tokens)) {
                  tokenData.tokens = tokenData.tokens.map((t) => {
                    if (t.uid === userData.uid && t.plan === plan) {
                      return { ...t, reminderSent: false, remindedAt: null };
                    }
                    return t;
                  });
                  writeStore("tokens.json", tokenData);
                }
              }
            } catch (remErr) {
              console.warn(
                "⚠️ Failed to reset reminder flags after renewal:",
                remErr?.message || remErr,
              );
            }

            // Fetch refreshed token to include in mail
            try {
              const tokenEntry = getTokenByUID(userData.uid);
              if (tokenEntry?.token) {
                const targetPage =
                  plan === "ultra"
                    ? "ultra-upload.html"
                    : plan === "platinum"
                      ? "platinum-ui-upload.html"
                      : "upload.html";
                const baseUrl = MAIL_BASE_URL;
                const uiLink = `${baseUrl}/${targetPage}?uid=${encodeURIComponent(userData.uid)}&token=${tokenEntry.token}`;
                // We'll inject this into the extension email below via closure variables
                renewalUiLink = uiLink;
                renewalToken = tokenEntry.token;
              }
            } catch (linkErr) {
              console.warn(
                "⚠️ Could not build renewal UI link:",
                linkErr?.message || linkErr,
              );
            }
          }

          // Notify user of successful extension
          if (userData.email) {
            try {
              const prettyExpiry = new Date(newExpiry).toLocaleString();
              const tokenLine =
                typeof renewalToken !== "undefined" && renewalToken
                  ? `<p style="margin:0 0 12px;">Access token: <b>${renewalToken}</b></p>
                   <p style="margin:0 0 14px;">Open premium UI: <a href="${renewalUiLink}" style="color:#58a6ff;">${renewalUiLink}</a></p>`
                  : "";
              sendStyledMail(
                userData.email,
                `✅ Plan extended — ${planDetails.name || plan}`,
                `
                <div style="font-family:Inter,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:20px;border-radius:12px;border:1px solid #1f6feb;">
                  <h2 style="margin:0 0 12px;color:#58a6ff;">Plan renewed successfully</h2>
                  <p style="margin:0 0 12px;">Hi <b>${userData.username || userData.email}</b>, your ${planDetails.name || plan} plan has been extended.</p>
                  <p style="margin:0 0 12px;">New expiry: <b>${prettyExpiry}</b></p>
                  ${tokenLine}
                  <p style="margin:0; font-size:13px; color:#8b949e;">If you didn't make this change, contact support immediately.</p>
                </div>
                `,
              );
            } catch (mailErr) {
              console.warn(
                "⚠️ Extension email failed:",
                mailErr?.message || mailErr,
              );
            }
          }

          console.log(
            `🔁 Purchase renewed (no new record): ${userData.email || userData.uid} → ${plan}`,
          );
          return purchases[existingIdx];
        }
      }

      const purchaseRecord = {
        _id: `PURCHASE-${Date.now()}`,
        uid: userData.uid || null,
        email: userData.email || null,
        username: userData.username || null,
        plan,
        amount,
        amountDiscount,
        discountApplied: discountPercent,
        finalAmount,
        currency: "INR",
        paymentMethod,
        cardLast4: cardLast4 || null,
        proofId: proofId || null,
        status:
          paymentMethod === "proof" ? "pending_verification" : "completed",
        purchasedAt: new Date().toISOString(),
        activatedAt:
          paymentMethod === "proof" ? null : new Date().toISOString(),
        durationDays: durationMs / (24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + durationMs).toISOString(),
        storageTB: planDetails.storageTB || 1,
        transactionId,
        notes,
        isActive: paymentMethod !== "proof",
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        renewalAttempts: 0,
        lastRenewalAttempt: null,
      };

      purchases.push(purchaseRecord);
      writeStore("purchases.json", purchases);

      generatePlanActiveData();

      if (paymentMethod !== "proof" && Number(finalAmount || 0) > 0) {
        registerSuccessfulReferralPurchase(userData.uid, {
          plan,
          transactionId,
          source: "direct-payment",
        });
      }

      // Auto-create token for all paid plans.
      if (plan !== "free" && userData.uid && userData.email) {
        console.log(`🎫 Creating access token for ${plan} plan purchase...`);
        createPlatinumToken(
          userData.uid,
          plan,
          userData.email,
          null,
          planDetails.durationMinutes
            ? planDetails.durationMinutes / 1440
            : planDetails.durationDays || 30,
        );
      }

      console.log(
        `💾 Purchase logged: ${userData.email || userData.uid} → ${plan} (${finalAmount} INR)`,
      );
      return purchaseRecord;
    } catch (err) {
      console.error("❌ Error logging purchase:", err);
      return null;
    }
  }

  app.post("/create-netbanking-session", verifyToken, (req, res) => {
    const { uid, plan, bank } = req.body;

    if (!uid || !plan || !bank) {
      return res
        .status(400)
        .json({ success: false, msg: "Missing uid / plan / bank" });
    }

    // ANTI-SPAM: Check if user already has an active plan of this type
    if (hasActivePlanOfType(uid, plan)) {
      return res.json({
        success: false,
        msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.`,
      });
    }

    console.log(
      `🏦 NetBanking requested → UID=${uid}, Plan=${plan}, Bank=${bank}`,
    );

    return res.json({
      success: true,
      mode: "card",
      msg: "NetBanking simulated → fallback to card",
    });
  });

  app.post("/process-card", verifyToken, (req, res) => {
    const {
      cardNumber,
      cardName,
      expiry,
      cvv,
      uid,
      plan,
      amount,
      discountedAmount,
      extend,
      source,
    } = req.body;

    if (!cardNumber || !cardName || !expiry || !cvv) {
      return res.json({ success: false, msg: "Incomplete card details" });
    }

    const targetUid = uid || req.user?.uid;

    const allowExtend = extend === "1" || source === "email";

    // ANTI-SPAM: Check if user already has an active plan of this type
    if (!allowExtend && hasActivePlanOfType(targetUid, plan)) {
      return res.json({
        success: false,
        msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.`,
      });
    }

    console.log(
      `💳 Card processed (SIMULATED) → UID=${targetUid}, Plan=${plan}, Amount=${amount}, extend=${allowExtend}`,
    );

    try {
      let users = readStore("users.json", []);
      const userIdx = users.findIndex(
        (u) =>
          u.uid === targetUid ||
          normalizeEmail(u.email) === normalizeEmail(req.user?.email),
      );

      if (userIdx === -1) {
        return res.status(404).json({ success: false, msg: "User not found" });
      }

      const selected = PLANS[plan];
      if (!selected) {
        return res.status(400).json({ success: false, msg: "Invalid plan" });
      }

      const transactionId = "CARD-" + Date.now();
      const cardLast4 = cardNumber.slice(-4);
      const finalAmount = discountedAmount || amount;
      const amountDiscount = amount - finalAmount;
      const discountPercent =
        amountDiscount > 0 ? Math.round((amountDiscount / amount) * 100) : 0;

      const planExpiry =
        Date.now() + selected.durationDays * 24 * 60 * 60 * 1000;

      let userMutated = false;
      if (plan === "ultra") {
        users[userIdx].uiAccess = "ultra";
        userMutated = true;
        try {
          const userEmailSafe = safeName(users[userIdx].email);
          const destUi = path.join(uploadsDir, userEmailSafe, "cloudplus_ui");
          const srcUi = path.join(baseDir, "public3");
          const copied = copyDirRecursive(srcUi, destUi);
          if (copied) {
            users[userIdx].cloudplusUI =
              `/uploads/${userEmailSafe}/cloudplus_ui/index.html`;
          }
        } catch (e) {
          console.warn("Failed to copy Cloud+ UI for user", e);
        }
      }

      if (userMutated) {
        writeStore("users.json", users);
      }

      logPurchase(
        users[userIdx],
        plan,
        amount,
        amountDiscount,
        discountPercent,
        finalAmount,
        "card",
        transactionId,
        null,
        cardLast4,
        allowExtend
          ? `[EXTEND] Card payment by ${cardName}`
          : `Card payment by ${cardName}`,
        null,
        { allowExtend },
      );

      return res.json({
        success: true,
        tx: transactionId,
        user: {
          uid: users[userIdx].uid,
          plan,
          storageTB: selected.storageTB,
          planExpiry,
          cloudplusUI: users[userIdx].cloudplusUI || null,
        },
      });
    } catch (err) {
      console.error("❌ process-card error:", err);
      return res.status(500).json({ success: false, msg: "Internal error" });
    }
  });

  app.get("/verify-upi", verifyToken, (req, res) => {
    const { upi } = req.query;
    if (!upi) {
      return res.json({ success: false, msg: "UPI missing" });
    }

    const upiRegex = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;
    const validFormat = upiRegex.test(upi);

    return res.json({
      success: true,
      validFormat,
      exists: validFormat,
      matchesConfigured: upi === UPI_ID,
    });
  });

  const proofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, paymentProofsDir);
    },
    filename: (req, file, cb) => {
      // Clean filename: replace spaces with underscores, remove special chars
      const cleanName = file.originalname
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      cb(null, `${Date.now()}-${cleanName}`);
    },
  });
  const uploadProof = multer({ storage: proofStorage });

  app.post("/create-qr", async (req, res) => {
    try {
      const {
        uid,
        plan,
        coupon,
        referralUid,
        coinsDiscount,
        amount: customAmount,
        requestedStorageTB,
      } = req.body;
      if (!uid || !plan)
        return res.json({ success: false, msg: "Missing uid or plan" });

      // ANTI-SPAM: Check if user already has an active plan of this type
      if (!["custom"].includes(plan) && hasActivePlanOfType(uid, plan)) {
        return res.json({
          success: false,
          msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.`,
        });
      }

      let selected = PLANS[plan];
      let customTB = null;

      if (plan === "custom") {
        customTB = Number(
          requestedStorageTB || req.body.storageTB || req.body.tb || NaN,
        );
        let customAmt = Number(customAmount || NaN);
        if (!Number.isFinite(customTB) || customTB < 1) {
          return res.json({ success: false, msg: "Invalid custom storage TB" });
        }
        if (!Number.isFinite(customAmt) || customAmt <= 0) {
          customAmt = Math.round(customTB * PRICE_PER_TB);
        }
        if (!Number.isFinite(customAmt) || customAmt <= 0) {
          return res.json({ success: false, msg: "Invalid custom amount" });
        }
        selected = {
          name: `Custom ${customTB} TB`,
          amount: customAmt,
          storageTB: customTB,
          durationDays: 30,
        };
      }

      if (!selected) return res.json({ success: false, msg: "Invalid plan" });

      let amount = selected.amount;
      const couponNormalized = String(coupon || "")
        .trim()
        .toUpperCase();

      attachReferrerToUserIfEligible(uid, referralUid);

      let discountApplied = 0;
      let discountPercent = 0;
      let discountSource = null;
      let referralNote = null;

      if (couponNormalized === REFERRAL_COUPON_CODE) {
        if (isReferralDiscountEligible(uid)) {
          discountApplied = Number(
            ((amount * REFERRAL_DISCOUNT_PERCENT) / 100).toFixed(2),
          );
          amount = Number((amount - discountApplied).toFixed(2));
          discountPercent = REFERRAL_DISCOUNT_PERCENT;
          discountSource = "referral";
          referralNote = `Referral discount applied (${REFERRAL_DISCOUNT_PERCENT}% off first purchase)`;
        } else {
          referralNote =
            "Referral discount not eligible. It applies only once on first purchase for referred users.";
        }
      }

      // Handle coupon discount
      if (
        !discountSource &&
        coupon &&
        typeof VALID_COUPON !== "undefined" &&
        coupon.toUpperCase() === VALID_COUPON.toUpperCase() &&
        typeof DISCOUNT_PERCENT !== "undefined" &&
        DISCOUNT_PERCENT > 0
      ) {
        discountApplied = (amount * DISCOUNT_PERCENT) / 100;
        amount = amount - discountApplied;
        discountPercent = DISCOUNT_PERCENT;
        discountSource = "coupon";
      }

      // Handle cloud coins discount (fixed amount in rupees)
      if (
        coinsDiscount &&
        Number.isFinite(coinsDiscount) &&
        coinsDiscount > 0
      ) {
        discountApplied = Math.min(coinsDiscount, amount); // Don't discount more than the amount
        amount = amount - discountApplied;
        discountPercent = Math.round((discountApplied / amount) * 100);
        discountSource = "coins";
      }

      const upiUri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(selected.name)}%20Plan%20for%20${encodeURIComponent(uid)}`;
      const qrDataUrl = await QRCode.toDataURL(upiUri);

      res.json({
        success: true,
        qrDataUrl,
        amount,
        upiUri,
        upiId: UPI_ID,
        upiName: UPI_NAME,
        discountApplied,
        discountPercent,
        discountSource,
        couponApplied: couponNormalized || null,
        referralNote,
        requestedStorageTB: customTB,
      });
    } catch (err) {
      console.error("❌ QR Generation Error:", err);
      res.json({ success: false, msg: "QR generation failed" });
    }
  });

  app.post("/submit-proof", uploadProof.single("screenshot"), (req, res) => {
    try {
      const {
        uid,
        plan,
        upi_txn_id,
        notes,
        coupon,
        referralUid,
        method,
        card_last4,
        card_name,
        card_expiry,
        amount: customAmount,
        requestedStorageTB,
        extend,
        source,
        coinsDiscount,
      } = req.body;
      if (!uid || !plan) {
        return res.json({ success: false, msg: "Missing UID or plan" });
      }

      // ANTI-SPAM: Check if user already has an active plan of this type
      const allowExtend = extend === "1" || source === "email";
      if (
        !allowExtend &&
        !["custom"].includes(plan) &&
        hasActivePlanOfType(uid, plan)
      ) {
        // Clean up uploaded file if exists
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}
        }
        return res.json({
          success: false,
          msg: `You already have an active ${plan} plan. Please wait for it to expire or contact support to extend it.`,
        });
      }

      // Get user email from users.json
      let userEmail = "N/A";
      try {
        const users = readStore("users.json", []);
        const user = users.find((u) => u.uid === uid);
        if (user) userEmail = user.email;
      } catch (err) {
        console.warn("⚠️ Could not fetch user email:", err);
      }

      let selected = PLANS[plan];
      let customTB = null;
      if (plan === "custom") {
        customTB = Number(
          requestedStorageTB || req.body.storageTB || req.body.tb || NaN,
        );
        let customAmt = Number(customAmount || NaN);
        if (!Number.isFinite(customTB) || customTB < 1) {
          return res.json({ success: false, msg: "Invalid custom storage TB" });
        }
        if (!Number.isFinite(customAmt) || customAmt <= 0) {
          customAmt = Math.round(customTB * PRICE_PER_TB);
        }
        if (!Number.isFinite(customAmt) || customAmt <= 0) {
          return res.json({ success: false, msg: "Invalid custom amount" });
        }
        selected = {
          name: `Custom ${customTB} TB`,
          amount: customAmt,
          storageTB: customTB,
          durationDays: 30,
        };
      }

      if (!selected) {
        return res.json({ success: false, msg: "Invalid plan" });
      }

      attachReferrerToUserIfEligible(uid, referralUid);

      const amount = Number(selected.amount);
      let discountPercent = 0;
      let discount = 0;
      let finalAmount = amount;
      let discountSource = null;
      const couponNormalized = String(coupon || "")
        .trim()
        .toUpperCase();

      // Debug: log discount inputs
      if (coupon || coinsDiscount) {
        console.log(
          `\x1b[36m╔════════════════════════════════════════════╗\x1b[0m\n` +
            `\x1b[36m║\x1b[0m \x1b[1;35m💰 DISCOUNT CHECKOUT\x1b[0m\x1b[36m                      ║\x1b[0m\n` +
            `\x1b[36m║\x1b[0m  Coupon: \x1b[1;33m${coupon || "none"}\x1b[0m\x1b[36m                              ║\x1b[0m\n` +
            `\x1b[36m║\x1b[0m  Coins: \x1b[1;33m₹${coinsDiscount || "0"}\x1b[0m\x1b[36m                              ║\x1b[0m\n` +
            `\x1b[36m║\x1b[0m  Valid Coupon: \x1b[1;32m${VALID_COUPON}\x1b[0m\x1b[36m                      ║\x1b[0m\n` +
            `\x1b[36m║\x1b[0m  Discount %: \x1b[1;32m${DISCOUNT_PERCENT}%\x1b[0m\x1b[36m                         ║\x1b[0m\n` +
            `\x1b[36m╚════════════════════════════════════════════╝\x1b[0m`,
        );
      }

      // Convert coinsDiscount to number if it's a string
      const coinsDiscountNum = coinsDiscount ? Number(coinsDiscount) : 0;

      // Handle coupon discount
      if (couponNormalized === REFERRAL_COUPON_CODE) {
        if (isReferralDiscountEligible(uid)) {
          discountPercent = REFERRAL_DISCOUNT_PERCENT;
          discount = Number(((amount * discountPercent) / 100).toFixed(2));
          finalAmount = Number((amount - discount).toFixed(2));
          discountSource = "referral";
        }
      }

      if (
        !discountSource &&
        coupon &&
        VALID_COUPON &&
        coupon.toUpperCase() === VALID_COUPON.toUpperCase()
      ) {
        discountPercent = Number(DISCOUNT_PERCENT || 0);
        if (discountPercent > 0) {
          discount = Number(((amount * discountPercent) / 100).toFixed(2));
          finalAmount = Number((amount - discount).toFixed(2));
          discountSource = "coupon";
        }
      }

      // Handle coins discount (fixed amount in rupees)
      if (
        coinsDiscountNum &&
        Number.isFinite(coinsDiscountNum) &&
        coinsDiscountNum > 0
      ) {
        discount = Math.min(coinsDiscountNum, amount);
        finalAmount = Number((amount - discount).toFixed(2));
        discountPercent = Math.round((discount / amount) * 100);
        discountSource = "coins";
      }

      let proofs = [];
      try {
        proofs = JSON.parse(fs.readFileSync(proofsFile, "utf8") || "[]");
      } catch {
        proofs = [];
      }

      const newProof = {
        _id: uuidv4(),
        uid,
        email: userEmail,
        userEmail: userEmail,
        plan,
        planDisplay: allowExtend ? `extend ${plan}` : plan,
        method: method || "qr",
        amount,
        originalAmount: amount,
        discountPercent,
        discount,
        discountApplied: discount,
        amountDiscount: discount,
        finalAmount,
        discountSource,
        coupon: couponNormalized || null,
        coinsDiscount: coinsDiscount || null,
        upi_txn_id: upi_txn_id || "N/A",
        transactionId: upi_txn_id || "N/A",
        card:
          method === "card"
            ? {
                holder: card_name || null,
                last4: card_last4 || null,
                expiry: card_expiry || null,
              }
            : null,
        notes: notes || "",
        screenshot: req.file
          ? `/support/payments/proofs/${req.file.filename}`
          : null,
        requestedStorageTB: customTB,
        storageTB: customTB || selected.storageTB,
        durationDays: selected.durationDays || 30,
        status: "pending",
        highlighted: false,
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        verifiedAt: null,
        verifiedBy: null,
        adminNotes: null,
        extend: allowExtend,
        source: source || null,
        actionLabel: allowExtend ? `extend of ${plan}` : null,
        notes: allowExtend
          ? notes
            ? `[EXTEND] ${notes}`
            : `[EXTEND] Plan renewal request`
          : notes || "",
      };

      proofs.push(newProof);
      writeStore("proofs.json", proofs);

      // Create payment log entry with formatted details
      const paymentLogFile = path.join(paymentSupportDir, "payment-log.json");
      let paymentLogs = [];
      try {
        if (fs.existsSync(paymentLogFile)) {
          paymentLogs = JSON.parse(
            fs.readFileSync(paymentLogFile, "utf8") || "[]",
          );
        }
      } catch {
        paymentLogs = [];
      }

      const paymentLogEntry = {
        timestamp: new Date().toISOString(),
        uid,
        email: userEmail,
        plan,
        originalAmount: amount,
        finalAmount: finalAmount,
        discountType: discountSource || "none",
        discountCode: coupon || null,
        discountAmount: discount,
        discountPercent: discountPercent,
        method: method || "qr",
        status: "pending",
        upiTxnId: upi_txn_id || "N/A",
        screenshot: req.file
          ? `/support/payments/proofs/${req.file.filename}`
          : null,
      };

      paymentLogs.push(paymentLogEntry);
      fs.writeFileSync(paymentLogFile, JSON.stringify(paymentLogs, null, 2));

      // Build detailed discount log message
      let discountLog = "";
      if (discountSource === "coupon" && coupon) {
        discountLog = ` \x1b[1;33m[✓ Coupon: ${coupon}]\x1b[0m \x1b[1;32m▸\x1b[0m \x1b[1;36mDiscount: ₹${discount} (${discountPercent}%)\x1b[0m`;
      } else if (discountSource === "coins") {
        discountLog = ` \x1b[1;33m[🪙 Cloud Coins]\x1b[0m \x1b[1;32m▸\x1b[0m \x1b[1;36mDiscount: ₹${discount} (${discountPercent}%)\x1b[0m`;
      } else {
        discountLog = ` \x1b[1;31m[No Discount]\x1b[0m`;
      }

      console.log(
        `\x1b[1;35m╔═══════════════════════════════════════════════════════╗\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m \x1b[1;36m🧾 PAYMENT PROOF SAVED\x1b[0m\x1b[1;35m                           ║\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m \x1b[1;32mUID:\x1b[0m \x1b[1;33m${uid}\x1b[0m\x1b[1;35m                        ║\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m \x1b[1;32mEmail:\x1b[0m \x1b[1;33m${userEmail}\x1b[0m\x1b[1;35m ║\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m \x1b[1;32mOriginal Amount:\x1b[0m \x1b[1;36m₹${amount}\x1b[0m\x1b[1;35m                      ║\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m \x1b[1;32mFinal Amount:\x1b[0m \x1b[1;36m₹${finalAmount}\x1b[0m\x1b[1;35m                        ║\x1b[0m\n` +
          `\x1b[1;35m║\x1b[0m${discountLog}\x1b[1;35m ║\x1b[0m\n` +
          `\x1b[1;35m╚═══════════════════════════════════════════════════════╝\x1b[0m`,
      );

      res.json({
        success: true,
        msg: "Proof submitted successfully. Awaiting admin approval.",
        proof: newProof,
      });
    } catch (err) {
      console.error("❌ submit-proof error:", err);
      res.status(500).json({ success: false, msg: "Internal error" });
    }
  });

  app.get("/check-status", (req, res) => {
    try {
      const { uid } = req.query;
      if (!uid) return res.status(400).json({ msg: "UID required" });

      let proofs = [];
      try {
        proofs = readStore("proofs.json", []);
      } catch (err) {
        proofs = [];
      }

      const userProofs = proofs.filter((p) => p.uid === uid);
      if (!userProofs || userProofs.length === 0)
        return res.json({ status: "none" });

      userProofs.sort((a, b) => {
        const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return db - da;
      });

      const proof = userProofs[0];

      return res.json({
        status: proof.status,
        highlighted: !!proof.highlighted,
        verified: !!proof.verifiedAt,
        proof: {
          _id: proof._id,
          plan: proof.plan,
          submittedAt: proof.submittedAt,
          screenshot: proof.screenshot,
          adminNotes: proof.adminNotes || null,
        },
      });
    } catch (err) {
      console.error("❌ check-status error:", err);
      res.status(500).json({ msg: "Internal error" });
    }
  });

  app.get("/admin/proofs", verifyToken, isAdmin, (req, res) => {
    try {
      const proofs = readStore("proofs.json", []);
      res.json({ success: true, proofs });
    } catch (err) {
      console.error("❌ admin/proofs error:", err);
      res.json({ success: false, msg: "Failed to load proofs" });
    }
  });

  app.post("/admin/update-status", verifyToken, isAdmin, async (req, res) => {
    try {
      const { id, status, adminNotes } = req.body;
      if (!id || !status)
        return res.json({ success: false, msg: "Missing data" });

      let proofs = readStore("proofs.json", []);
      const idx = proofs.findIndex((p) => p._id === id);
      if (idx === -1)
        return res.json({ success: false, msg: "Proof not found" });

      let coinDebitResult = null;
      if (status === "approved") {
        const proof = proofs[idx];
        const source = String(proof?.discountSource || "").toLowerCase();
        const couponCode = String(proof?.coupon || "")
          .trim()
          .toUpperCase();

        if (
          couponCode === REFERRAL_COUPON_CODE &&
          !isReferralDiscountEligible(proof.uid)
        ) {
          return res.json({
            success: false,
            msg: "Cannot approve: referral discount is no longer eligible. Approve one successful referred purchase only.",
          });
        }

        const alreadyDeducted =
          !!proof?.coinsDeductedAt || !!proof?.coinsTransactionId;
        const rupeesFromCoinsField = Number(proof?.coinsDiscount || 0);
        const discountRupees = Math.floor(
          rupeesFromCoinsField > 0
            ? rupeesFromCoinsField
            : Number(proof?.discount || 0),
        );
        const hasCoinsDiscount = source === "coins" || rupeesFromCoinsField > 0;

        if (hasCoinsDiscount && discountRupees > 0 && !alreadyDeducted) {
          const coinsToDebit = discountRupees * COINS_PER_RUPEE;
          coinDebitResult = debitUserCoins(
            proof.uid,
            coinsToDebit,
            "Cloud Coins used for plan discount",
            {
              proofId: proof._id,
              plan: proof.plan,
              rupeeDiscount: discountRupees,
              source: "admin-proof-approval",
            },
          );

          if (!coinDebitResult.success) {
            if (coinDebitResult.code === "insufficient_balance") {
              return res.json({
                success: false,
                msg: `Cannot approve: user needs ${coinsToDebit} coins but has ${coinDebitResult.balance}.`,
              });
            }
            if (coinDebitResult.code === "wallet_not_found") {
              return res.json({
                success: false,
                msg: "Cannot approve: user cloud coins wallet not found.",
              });
            }
            return res.json({
              success: false,
              msg: "Cannot approve: cloud coins deduction failed.",
            });
          }
        }
      }

      proofs[idx].status = status;
      proofs[idx].adminNotes = adminNotes || null;
      proofs[idx].verifiedAt = status === "approved" ? new Date() : null;
      proofs[idx].highlighted = status === "approved";
      if (coinDebitResult?.success) {
        proofs[idx].coinsSpent = coinDebitResult.spent;
        proofs[idx].coinsTransactionId = coinDebitResult.transactionId;
        proofs[idx].coinsDeductedAt = coinDebitResult.timestamp;
        proofs[idx].coinsBalanceAfter = coinDebitResult.balanceAfter;
      }

      writeStore("proofs.json", proofs);
      console.log(
        `🔔 Proof status updated for UID=${proofs[idx].uid} to '${proofs[idx].status}'`,
      );

      if (status === "approved") {
        try {
          const users = readStore("users.json", []);
          const userIdx = users.findIndex((u) => u.uid === proofs[idx].uid);

          if (userIdx !== -1) {
            let selected = PLANS[proofs[idx].plan];
            if (!selected) {
              const tb = proofs[idx].requestedStorageTB || 0;
              const duration = 30;
              const label =
                proofs[idx].plan === "custom"
                  ? `Custom ${tb || ""} TB`
                  : proofs[idx].plan || "Plan";
              selected = {
                name: label.trim(),
                storageTB: tb,
                durationDays: duration,
              };
            }
            let userMutated = false;

            try {
              if (proofs[idx].plan === "ultra") {
                users[userIdx].uiAccess = "ultra";
                userMutated = true;
              }

              if (proofs[idx].plan && proofs[idx].plan !== "free") {
                createPlatinumToken(
                  proofs[idx].uid,
                  proofs[idx].plan,
                  users[userIdx]?.email || proofs[idx].email || null,
                  null,
                  selected.durationMinutes
                    ? selected.durationMinutes / 1440
                    : selected.durationDays || 30,
                );
              }

              try {
                let purchases = readStore("purchases.json", []);
                const purchaseIdx = purchases.findIndex(
                  (p) =>
                    p._id === proofs[idx]._id || p.proofId === proofs[idx]._id,
                );
                const allowExtend = !!proofs[idx].extend;
                if (purchaseIdx !== -1) {
                  const existing = purchases[purchaseIdx];
                  if (allowExtend) {
                    const planDetails = selected;
                    const durationMs = planDetails.durationMinutes
                      ? planDetails.durationMinutes * 60 * 1000
                      : (planDetails.durationDays || 30) * 24 * 60 * 60 * 1000;
                    const baseExpiry = existing.expiresAt
                      ? new Date(existing.expiresAt).getTime()
                      : Date.now();
                    const newExpiry = new Date(
                      Math.max(Date.now(), baseExpiry) + durationMs,
                    ).toISOString();
                    purchases[purchaseIdx] = {
                      ...existing,
                      status: "completed",
                      activatedAt: new Date().toISOString(),
                      isActive: true,
                      proofId: proofs[idx]._id,
                      transactionId: proofs[idx]._id,
                      expiresAt: newExpiry,
                      notes: existing.notes || proofs[idx].notes || "",
                      renewalAttempts: (existing.renewalAttempts || 0) + 1,
                      lastRenewalAttempt: new Date().toISOString(),
                      amount: proofs[idx].amount,
                      amountDiscount: proofs[idx].discount,
                      discountApplied: proofs[idx].discountPercent,
                      finalAmount: proofs[idx].finalAmount,
                    };
                  } else {
                    purchases[purchaseIdx].status = "completed";
                    purchases[purchaseIdx].activatedAt =
                      new Date().toISOString();
                    purchases[purchaseIdx].isActive = true;
                    purchases[purchaseIdx].proofId = proofs[idx]._id;
                  }
                  writeStore("purchases.json", purchases);
                  generatePlanActiveData();
                  registerSuccessfulReferralPurchase(proofs[idx].uid, {
                    plan: proofs[idx].plan,
                    transactionId: proofs[idx]._id,
                    source: "proof-approval-existing",
                  });
                } else {
                  // Purchase not yet created - create it now upon approval
                  logPurchase(
                    users[userIdx],
                    proofs[idx].plan,
                    proofs[idx].amount,
                    proofs[idx].discount,
                    proofs[idx].discountPercent,
                    proofs[idx].finalAmount,
                    proofs[idx].method || "qr",
                    proofs[idx]._id,
                    proofs[idx]._id,
                    proofs[idx].card?.last4 || null,
                    `${proofs[idx].method === "card" ? "Card" : "QR/UPI"} payment proof approved - ${proofs[idx].notes}`,
                    proofs[idx].plan === "custom" ? selected : null,
                    { allowExtend },
                  );
                  registerSuccessfulReferralPurchase(proofs[idx].uid, {
                    plan: proofs[idx].plan,
                    transactionId: proofs[idx]._id,
                    source: "proof-approval-new",
                  });
                }
              } catch (purchaseErr) {
                console.error(
                  "⚠️ Error updating purchase record:",
                  purchaseErr,
                );
              }

              if (userMutated) {
                writeStore("users.json", users);
              }

              let platinumUILink = "";
              const isPremiumPlan =
                proofs[idx].plan === "platinum" || proofs[idx].plan === "ultra";
              if (isPremiumPlan) {
                try {
                  const tokenEntry = getTokenByUID(
                    proofs[idx].uid,
                    proofs[idx].plan,
                  );
                  if (tokenEntry && tokenEntry.token) {
                    const targetPage =
                      proofs[idx].plan === "ultra"
                        ? "ultra-upload.html"
                        : "platinum-ui-upload.html";
                    const baseUrl = MAIL_BASE_URL;
                    const platinumUrl = `${baseUrl}/${targetPage}?uid=${encodeURIComponent(
                      proofs[idx].uid,
                    )}&token=${tokenEntry.token}`;
                    const planTitle =
                      proofs[idx].plan === "ultra" ? "Ultra" : "Platinum";
                    const planColor =
                      proofs[idx].plan === "ultra" ? "#ff1493" : "#00ffc8";
                    const planBg =
                      proofs[idx].plan === "ultra" ? "#2a001a" : "#001f3f";
                    const gradientEnd =
                      proofs[idx].plan === "ultra" ? "#ff99ff" : "#0099ff";

                    console.log(
                      `\n🔍 EMAIL TEMPLATE DEBUG for ${proofs[idx].uid}:`,
                    );
                    console.log(
                      `   Plan from proofs.json: "${proofs[idx].plan}"`,
                    );
                    console.log(`   Plan Title: "${planTitle}"`);
                    console.log(`   Target Page: "${targetPage}"`);
                    console.log(`   Plan Color: "${planColor}"`);
                    console.log(`   Full URL: ${platinumUrl}\n`);

                    platinumUILink = `
                                    <div style="background:${planBg};border:2px solid ${planColor};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
                                        <h3 style="color:${planColor};">🔐 Your ${planTitle} Portal Access</h3>
                                        <p>Click the button below to access your exclusive ${planTitle} interface:</p>
                                        <a href="${platinumUrl}" style="
                                            display:inline-block;
                                            padding:12px 30px;
                                            background:linear-gradient(135deg,${planColor},${gradientEnd});
                                            color:#000;
                                            text-decoration:none;
                                            border-radius:8px;
                                            font-weight:bold;
                                            margin:15px 0;
                                            font-size:16px;">
                                            💎 Access ${planTitle} UI
                                        </a>
                                        <p style="font-size:12px;color:#888;margin-top:15px;">
                                            <b>Your Access Token:</b> ${tokenEntry.token}<br>
                                            <b>Expires:</b> ${tokenEntry.expiresAt ? new Date(tokenEntry.expiresAt).toLocaleDateString() : "Not set"}
                                        </p>
                                    </div>`;
                    console.log(
                      `✅ ${planTitle} access link included in email for ${proofs[idx].uid}`,
                    );
                  }
                } catch (tokenErr) {
                  console.error(
                    "⚠️ Could not fetch token for email link:",
                    tokenErr,
                  );
                }
              }

              const uiLink = users[userIdx].cloudplusUI
                ? `\n<p>Open your Cloud+ UI: <a href="${users[userIdx].cloudplusUI}">${users[userIdx].cloudplusUI}</a></p>`
                : "";
              const durationLabel =
                selected.durationDays === 365
                  ? "1 Year"
                  : selected.durationMinutes
                    ? `${selected.durationMinutes} Minutes`
                    : `${selected.durationDays || calcDurationDays(selected)} Days`;

              await sendStyledMail(
                users[userIdx].email,
                `🎉 ${selected.name} Plan Activated!`,
                `
                            <h2 style="color:#00ffc8;">✨ Payment Verified!</h2>
                            <p>Hi <b>${users[userIdx].username}</b>, your <b>${selected.name}</b> plan is now active.</p>
                            <p><b>Storage:</b> ${selected.storageTB} TB<br>
                               <b>Duration:</b> ${durationLabel}</p>
                            ${platinumUILink}
                            ${uiLink}
                            <p>Enjoy premium features on <b>CloudSpace+</b> 🚀</p>
                            `,
              );
              console.log(
                `📩 Plan activation email sent to ${users[userIdx].email}`,
              );
            } catch (mailErr) {
              console.error("❌ Email send failed:", mailErr);
            }
          } else {
            console.warn(
              "⚠️ Admin approved proof but user not found:",
              proofs[idx].uid,
            );
          }
        } catch (userErr) {
          console.error("❌ Error updating user after approval:", userErr);
        }
      }

      return res.json({
        success: true,
        msg: `Status updated to ${status}`,
        proof: proofs[idx],
      });
    } catch (err) {
      console.error("❌ admin/update-status error:", err);
      res.status(500).json({ success: false, msg: "Internal error" });
    }
  });

  app.get("/purchases/:uid", verifyToken, (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid)
        return res
          .status(400)
          .json({ success: false, message: "UID required" });

      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );
      const userPurchases = purchases.filter((p) => p.uid === uid);
      userPurchases.sort(
        (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt),
      );

      const activePlans = userPurchases.filter(
        (p) => p.isActive && !p.isBlocked,
      ).length;
      const totalPayments = userPurchases.length;
      const totalSpent = userPurchases.reduce(
        (sum, p) => sum + (p.finalAmount || 0),
        0,
      );

      res.json({
        success: true,
        summary: { totalPayments, activePlans, totalSpent },
        purchases: userPurchases,
      });
    } catch (err) {
      console.error("❌ Error fetching purchases:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/purchases/:uid/summary", verifyToken, (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid)
        return res
          .status(400)
          .json({ success: false, message: "UID required" });

      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );
      const userPurchases = purchases.filter((p) => p.uid === uid);

      const totalPayments = userPurchases.length;
      const activePlans = userPurchases.filter(
        (p) => p.isActive && !p.isBlocked,
      ).length;
      const completedPayments = userPurchases.filter(
        (p) => p.status === "completed",
      ).length;
      const pendingPayments = userPurchases.filter(
        (p) => p.status === "pending_verification",
      ).length;
      const blockedPlans = userPurchases.filter((p) => p.isBlocked).length;
      const totalSpent = userPurchases.reduce(
        (sum, p) => sum + (p.finalAmount || 0),
        0,
      );
      const totalDiscount = userPurchases.reduce(
        (sum, p) => sum + (p.amountDiscount || 0),
        0,
      );

      const planBreakdown = {};
      userPurchases.forEach((p) => {
        if (!planBreakdown[p.plan]) {
          planBreakdown[p.plan] = { count: 0, active: 0, totalSpent: 0 };
        }
        planBreakdown[p.plan].count++;
        if (p.isActive && !p.isBlocked) planBreakdown[p.plan].active++;
        planBreakdown[p.plan].totalSpent += p.finalAmount || 0;
      });

      res.json({
        success: true,
        uid,
        totalPayments,
        activePlans,
        completedPayments,
        pendingPayments,
        blockedPlans,
        totalSpent,
        totalDiscount,
        planBreakdown,
        purchases: userPurchases.slice(0, 10),
      });
    } catch (err) {
      console.error("❌ Error fetching purchase summary:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/admin/purchases", verifyToken, isAdmin, (req, res) => {
    try {
      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );
      purchases.sort(
        (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt),
      );

      res.json({
        success: true,
        totalPurchases: purchases.length,
        totalRevenue: purchases.reduce(
          (sum, p) => sum + (p.finalAmount || 0),
          0,
        ),
        purchases,
      });
    } catch (err) {
      console.error("❌ Error fetching all purchases:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/admin/purchase-stats", verifyToken, isAdmin, (req, res) => {
    try {
      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );

      const stats = {
        totalPurchases: purchases.length,
        totalRevenue: purchases.reduce(
          (sum, p) => sum + (p.finalAmount || 0),
          0,
        ),
        activePlans: purchases.filter((p) => p.isActive && !p.isBlocked).length,
        blockedPlans: purchases.filter((p) => p.isBlocked).length,
        pendingVerification: purchases.filter(
          (p) => p.status === "pending_verification",
        ).length,
        byPlan: {},
        byPaymentMethod: {},
      };

      purchases.forEach((p) => {
        stats.byPlan[p.plan] = (stats.byPlan[p.plan] || 0) + 1;
        stats.byPaymentMethod[p.paymentMethod] =
          (stats.byPaymentMethod[p.paymentMethod] || 0) + 1;
      });

      res.json({ success: true, stats });
    } catch (err) {
      console.error("❌ Error fetching purchase stats:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/admin/block-plan", verifyToken, isAdmin, (req, res) => {
    try {
      const { purchaseId, reason } = req.body;
      if (!purchaseId || !reason) {
        return res
          .status(400)
          .json({ success: false, message: "Purchase ID and reason required" });
      }

      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );
      const purchaseIdx = purchases.findIndex((p) => p._id === purchaseId);

      if (purchaseIdx === -1) {
        return res
          .status(404)
          .json({ success: false, message: "Purchase not found" });
      }

      purchases[purchaseIdx].isBlocked = true;
      purchases[purchaseIdx].blockedReason = reason;
      purchases[purchaseIdx].blockedAt = new Date().toISOString();

      fs.writeFileSync(purchasesFile, JSON.stringify(purchases, null, 2));
      generatePlanActiveData();

      res.json({
        success: true,
        message: "Plan blocked successfully",
        purchase: purchases[purchaseIdx],
      });
    } catch (err) {
      console.error("❌ Error blocking plan:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/admin/unblock-plan", verifyToken, isAdmin, (req, res) => {
    try {
      const { purchaseId } = req.body;
      if (!purchaseId) {
        return res
          .status(400)
          .json({ success: false, message: "Purchase ID required" });
      }

      let purchases = JSON.parse(
        fs.readFileSync(purchasesFile, "utf8") || "[]",
      );
      const purchaseIdx = purchases.findIndex((p) => p._id === purchaseId);

      if (purchaseIdx === -1) {
        return res
          .status(404)
          .json({ success: false, message: "Purchase not found" });
      }

      purchases[purchaseIdx].isBlocked = false;
      purchases[purchaseIdx].blockedReason = null;
      purchases[purchaseIdx].blockedAt = null;

      writeStore("purchases.json", purchases);
      generatePlanActiveData();

      res.json({
        success: true,
        message: "Plan unblocked successfully",
        purchase: purchases[purchaseIdx],
      });
    } catch (err) {
      console.error("❌ Error unblocking plan:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/admin/delete-plan", verifyToken, isAdmin, (req, res) => {
    try {
      const { purchaseId } = req.body;
      if (!purchaseId)
        return res
          .status(400)
          .json({ success: false, message: "Purchase ID required" });

      const isMatchId = (obj) =>
        [
          obj?._id,
          obj?.recordId,
          obj?.id,
          obj?.purchaseId,
          obj?.proofId,
          obj?.transactionId,
          obj?.token,
          obj?.accessToken,
        ]
          .filter(Boolean)
          .some((v) => String(v) === String(purchaseId));

      const purchasesBefore = readStore("purchases.json", []);
      const deleted = purchasesBefore.find((p) => isMatchId(p));

      let purchases = purchasesBefore.filter((p) => !isMatchId(p));

      if (purchases.length === purchasesBefore.length) {
        return res
          .status(404)
          .json({ success: false, message: "Purchase not found" });
      }

      writeStore("purchases.json", purchases);

      // Remove linked token/proof/active plan records for the same user+record.
      const deletedUid = deleted?.uid || null;
      const deletedEmail = normalizeEmail(deleted?.email || "");

      const tokensData = readStore("tokens.json", { tokens: [] });
      const nextTokens = (tokensData?.tokens || []).filter((t) => {
        const sameUser =
          (deletedUid && String(t?.uid || "") === String(deletedUid)) ||
          (deletedEmail && normalizeEmail(t?.email || "") === deletedEmail);
        if (!sameUser) return true;
        return !isMatchId(t);
      });
      writeStore("tokens.json", { tokens: nextTokens });

      const proofs = readStore("proofs.json", []);
      const nextProofs = proofs.filter((p) => {
        const sameUser =
          (deletedUid && String(p?.uid || "") === String(deletedUid)) ||
          (deletedEmail && normalizeEmail(p?.email || "") === deletedEmail);
        if (!sameUser) return true;
        return !isMatchId(p);
      });
      writeStore("proofs.json", nextProofs);

      let planActive = readStore("plan-active.json", []);
      planActive = planActive
        .map((entry) => {
          const sameUser =
            (deletedUid && String(entry?.uid || "") === String(deletedUid)) ||
            (deletedEmail &&
              normalizeEmail(entry?.email || "") === deletedEmail);
          if (!sameUser) return entry;
          const plans = (entry?.plans || []).filter((p) => !isMatchId(p));
          return { ...entry, plans };
        })
        .filter((entry) => (entry?.plans || []).length > 0);
      writeStore("plan-active.json", planActive);

      // Recompute uiAccess from remaining active plans/tokens for the affected user.
      const users = readStore("users.json", []);
      const now = Date.now();
      const nextUsers = users.map((u) => {
        const sameUser =
          (deletedUid && String(u?.uid || "") === String(deletedUid)) ||
          (deletedEmail && normalizeEmail(u?.email || "") === deletedEmail);
        if (!sameUser) return u;

        const userPurchases = purchases.filter(
          (p) =>
            (u?.uid && String(p?.uid || "") === String(u.uid)) ||
            (u?.email &&
              normalizeEmail(p?.email || "") === normalizeEmail(u.email)),
        );
        const userTokens = nextTokens.filter(
          (t) =>
            (u?.uid && String(t?.uid || "") === String(u.uid)) ||
            (u?.email &&
              normalizeEmail(t?.email || "") === normalizeEmail(u.email)),
        );

        const activePlans = [
          ...userPurchases.filter(
            (p) =>
              p?.isActive === true &&
              (!p?.expiresAt || new Date(p.expiresAt).getTime() > now),
          ),
          ...userTokens.filter(
            (t) =>
              t?.active === true &&
              (!t?.expiresAt || new Date(t.expiresAt).getTime() > now),
          ),
        ];

        let uiAccess = null;
        if (
          activePlans.some(
            (p) => String(p?.plan || "").toLowerCase() === "ultra",
          )
        ) {
          uiAccess = "ultra";
        } else if (
          activePlans.some(
            (p) => String(p?.plan || "").toLowerCase() === "platinum",
          )
        ) {
          uiAccess = "platinum";
        } else if (activePlans.length > 0) {
          uiAccess = activePlans[0]?.plan || null;
        }

        return { ...u, uiAccess };
      });
      writeStore("users.json", nextUsers);

      generatePlanActiveData();

      res.json({ success: true, message: "Plan deleted" });
    } catch (err) {
      console.error("❌ Error deleting plan:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/plan-active", (req, res) => {
    try {
      let planActiveData = readPlanActiveFile();
      if (!planActiveData || planActiveData.length === 0) {
        const purchases = fs.existsSync(purchasesFile)
          ? JSON.parse(fs.readFileSync(purchasesFile, "utf8") || "[]")
          : [];
        if (purchases.length > 0) {
          planActiveData = generatePlanActiveData();
        } else {
          planActiveData = [];
        }
      }

      res.json({
        success: true,
        data: planActiveData,
        timestamp: new Date().toISOString(),
        note: "Data returned from plan-active.json (manual edits preserved)",
      });
    } catch (err) {
      console.error("❌ Error reading plan-active data:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/plan-active/:uid", (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid)
        return res
          .status(400)
          .json({ success: false, message: "UID required" });

      let planActiveData = readPlanActiveFile();
      if (!planActiveData || planActiveData.length === 0) {
        const purchases = fs.existsSync(purchasesFile)
          ? JSON.parse(fs.readFileSync(purchasesFile, "utf8") || "[]")
          : [];
        if (purchases.length > 0) {
          planActiveData = generatePlanActiveData();
        } else {
          planActiveData = [];
        }
      }

      const normalizedUid = String(uid || "").trim();
      const userData = planActiveData.find((u) => {
        const entryUid = String(
          u?.self?.uid || u?.uid || u?.user?.uid || "",
        ).trim();
        return entryUid === normalizedUid;
      });
      if (!userData) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        data: userData,
        timestamp: new Date().toISOString(),
        note: "Data returned from plan-active.json (manual edits preserved)",
      });
    } catch (err) {
      console.error("❌ Error reading user plan-active data:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/admin/sync-plan-active", (req, res) => {
    try {
      const { token } = req.headers;
      const adminEmail = req.headers["admin-email"];

      if (
        !token ||
        (adminEmail !== ADMIN_EMAIL && adminEmail !== SUPER_ADMIN_EMAIL)
      ) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      let planActiveData = generatePlanActiveData();

      res.json({
        success: true,
        message: "plan-active.json synced successfully",
        usersUpdated: planActiveData.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("❌ Error syncing plan-active.json:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Plan access and token-protected routes
  function checkUltraPlan(req, res, next) {
    if (!req.user || !req.user.email)
      return res.status(401).send("Unauthorized");

    try {
      const users = readStore("users.json", []);
      const user = users.find(
        (u) =>
          normalizeEmail(u.email) === normalizeEmail(req.user.email) ||
          u.uid === req.user.uid,
      );

      if (!user) return res.status(404).send("User not found");

      // Allow if user has explicit ultra plan OR uiAccess is set to ultra
      const hasUltra = user.plan === "ultra" || user.uiAccess === "ultra";
      if (!hasUltra) {
        return res.status(403).send(`
                <html>
                    <head><title>Plan Required</title></head>
                    <body style="background:#0d1117;color:#e6edf3;font-family:Arial;text-align:center;padding:50px;">
                        <h1 style="color:#ff4444;">🚫 Ultra Plan Required</h1>
                        <p>You currently have the <b>${user.plan || "free"}</b> plan.</p>
                        <p>Upgrade to <b>Ultra</b> to access this feature.</p>
                        <a href="payment.html?uid=${user.uid}" style="
                            display:inline-block;
                            padding:12px 30px;
                            background:linear-gradient(135deg,#00ffcc,#0099ff);
                            color:#111;
                            text-decoration:none;
                            border-radius:8px;
                            font-weight:bold;
                            margin:20px 0;">
                            💳 Upgrade Now
                        </a><br>
                        <a href="upload.html" style="color:#00ffcc;text-decoration:none;margin-top:20px;display:block;">← Back to Upload</a>
                    </body>
                </html>
            `);
      }

      req.fullUser = user;
      next();
    } catch (err) {
      console.error("❌ Plan check error:", err);
      return res.status(500).send("Server error during plan validation");
    }
  }

  // Ultra upload: serve the page, let client-side handle authorization
  // This allows users to access and refresh without server-side auth blocking them
  app.get("/ultra-upload.html", (req, res) => {
    try {
      const token = req.query.token || req.headers["x-access-token"];
      const uid = req.query.uid;

      // Try to verify JWT token from Authorization header or cookies
      const authHeader = req.headers.authorization;
      let jwtUser = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const jwtToken = authHeader.substring(7);
          jwtUser = jwt.verify(
            jwtToken,
            process.env.JWT_SECRET || "supersecretkey",
          );
        } catch (e) {
          // JWT invalid, continue
        }
      }

      // ✅ Check for token-based access FIRST (premium users with token)
      if (token) {
        const valid = validateToken(token);
        if (valid) {
          console.log(`✅ Ultra upload access via premium token: ${uid}`);
          return res.sendFile(path.join(publicDir, "ultra-upload.html"));
        }
      }

      // ✅ Check JWT authenticated users ONLY if they have ultra plan
      if (jwtUser && jwtUser.uid) {
        const planSnapshot = getActivePlanSnapshot(jwtUser.uid);
        if (planSnapshot.plan === "ultra") {
          if (planSnapshot.isActive) {
            console.log(
              `✅ Ultra upload access via JWT: ${jwtUser.uid} with ultra plan`,
            );
            return res.sendFile(path.join(publicDir, "ultra-upload.html"));
          }
        }
      }

      // ❌ Deny access to all non-ultra users
      console.log(`🚫 Ultra upload access DENIED - non-ultra plan`);
      return res.status(403).send(`
        <html>
          <head>
            <title>Access Forbidden - Ultra Plan Required</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: 'Poppins', Arial, sans-serif;
                background: linear-gradient(135deg, #0a0a1f 0%, #1a0033 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                color: #e6edf3;
              }
              .container {
                max-width: 500px;
                padding: 40px;
                text-align: center;
                background: rgba(15, 25, 50, 0.8);
                border: 2px solid rgba(102, 126, 234, 0.3);
                border-radius: 20px;
                box-shadow: 0 0 50px rgba(102, 126, 234, 0.2);
              }
              h1 {
                color: #ff4444;
                font-size: 32px;
                margin: 0 0 20px 0;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
              }
              p {
                color: #aaa;
                font-size: 16px;
                line-height: 1.6;
                margin: 15px 0;
              }
              .plan-badge {
                display: inline-block;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: #fff;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 15px 0;
                font-size: 14px;
              }
              .button-group {
                display: flex;
                gap: 10px;
                margin-top: 30px;
              }
              button, a {
                flex: 1;
                padding: 14px 24px;
                font-size: 16px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                text-decoration: none;
                font-weight: bold;
                transition: all 0.3s;
              }
              .btn-upgrade {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: #fff;
                border: none;
              }
              .btn-upgrade:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
              }
              .btn-back {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e6edf3;
              }
              .btn-back:hover {
                background: rgba(255, 255, 255, 0.1);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔐 Access Forbidden (403)</h1>
              <p>The Ultra upload interface is <strong>only available for Ultra subscribers</strong>.</p>
              <p style="color: #ff9999; font-weight: bold;">Your current plan does not include access to this feature.</p>
              <div class="plan-badge">Ultra Plan Required</div>
              <p style="font-size: 14px; color: #888;">Upgrade to Ultra to unlock the most premium upload experience with maximum storage and exclusive features.</p>
              <div class="button-group">
                <a href="/upgrade-form.html" class="btn-upgrade">💎 Upgrade Now</a>
                <a href="/upload.html" class="btn-back">← Back to Upload</a>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("❌ Ultra upload access error:", err);
      return res.status(500).send("Server error");
    }
  });

  // Ultra profile page: require valid token or verified ultra plan
  app.get(
    "/ultra-profile.html",
    (req, res, next) => {
      const token = req.query.token || req.headers["x-access-token"]; // fast path when token provided
      const uid = (req.query.uid || "").trim();
      if (token) {
        const valid = validateToken(token);
        if (valid) {
          return res.sendFile(path.join(publicDir, "ultra-profile.html"));
        }
        // if invalid, fall through to normal auth for clearer error
      }

      // If no token but UID provided, fetch token and redirect with token
      if (!token && uid) {
        const tokenEntry = getTokenByUID(uid);
        if (tokenEntry && tokenEntry.active !== false) {
          const url = `/ultra-profile.html?token=${encodeURIComponent(tokenEntry.token)}&uid=${encodeURIComponent(uid)}`;
          return res.redirect(url);
        }
        return res.status(401).json({ error: "No active token for UID" });
      }

      next();
    },
    verifyToken,
    checkUltraPlan,
    (req, res) => {
      res.sendFile(path.join(publicDir, "ultra-profile.html"));
    },
  );

  // Ultra settings page: require valid token or verified ultra plan
  app.get(
    "/ultra-settings.html",
    (req, res, next) => {
      const token = req.query.token || req.headers["x-access-token"]; // fast path when token provided
      const uid = (req.query.uid || "").trim();
      if (token) {
        const valid = validateToken(token);
        if (valid) {
          return res.sendFile(path.join(publicDir, "ultra-settings.html"));
        }
        // if invalid, fall through to normal auth for clearer error
      }

      // If no token but UID provided, fetch token and redirect with token
      if (!token && uid) {
        const tokenEntry = getTokenByUID(uid);
        if (tokenEntry && tokenEntry.active !== false) {
          const url = `/ultra-settings.html?token=${encodeURIComponent(tokenEntry.token)}&uid=${encodeURIComponent(uid)}`;
          return res.redirect(url);
        }
        return res.status(401).json({ error: "No active token for UID" });
      }

      next();
    },
    verifyToken,
    checkUltraPlan,
    (req, res) => {
      res.sendFile(path.join(publicDir, "ultra-settings.html"));
    },
  );

  app.post("/api/save-token", verifyToken, (req, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || null;
      const planRaw = (req.user?.plan || req.body?.plan || "platinum")
        .toString()
        .toLowerCase();
      const plan = planRaw === "ultra" ? "ultra" : "platinum"; // default to platinum-format tokens

      if (!uid) {
        return res
          .status(400)
          .json({ success: false, message: "UID required" });
      }

      // Reuse existing reference token if present
      const existing = getTokenByUID(uid);
      if (existing) {
        return res.json({
          success: true,
          message: "Token already exists",
          token: existing.token,
        });
      }

      // Create a new reference token using the unified generator
      const selected = PLANS[plan] || {};
      const planDurationDays = selected.durationMinutes
        ? selected.durationMinutes / 1440
        : selected.durationDays || (plan === "ultra" ? 365 : 180);
      const createdToken = createPlatinumToken(
        uid,
        plan,
        email,
        req.ip || req.connection?.remoteAddress || null,
        planDurationDays,
      );
      if (!createdToken) {
        return res
          .status(500)
          .json({ success: false, message: "Failed to create token" });
      }

      return res.json({
        success: true,
        message: "Token created",
        token: createdToken,
      });
    } catch (error) {
      console.error("Token save error:", error);
      res.status(500).json({ success: false, message: "Failed to save token" });
    }
  });

  // Unified token fetch for Ultra/Platinum users (returns reference token only)
  app.get("/api/get-numeric-token/:uid", verifyToken, (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      if (!uid) {
        return res.status(400).json({ token: null, error: "UID required" });
      }

      // Return existing reference token if available
      const existing = getTokenByUID(uid);
      if (existing) {
        return res.json({ token: existing.token });
      }

      // Otherwise, mint a new reference token using the unified generator
      const planRaw = (req.user?.plan || req.body?.plan || "platinum")
        .toString()
        .toLowerCase();
      const plan = planRaw === "ultra" ? "ultra" : "platinum";
      const selected = PLANS[plan] || {};
      const planDurationDays = selected.durationMinutes
        ? selected.durationMinutes / 1440
        : selected.durationDays || (plan === "ultra" ? 365 : 180);
      const newToken = createPlatinumToken(
        uid,
        plan,
        req.user?.email || null,
        req.ip || req.connection?.remoteAddress || null,
        planDurationDays,
      );

      if (!newToken) {
        return res
          .status(500)
          .json({ token: null, error: "Failed to create token" });
      }

      return res.json({ token: newToken });
    } catch (error) {
      console.error("Error fetching token:", error);
      res.status(500).json({ token: null, error: "Failed to fetch token" });
    }
  });

  // Check if user has premium plan access (Ultra or Platinum)
  app.get("/api/check-premium-access/:uid", verifyToken, (req, res) => {
    try {
      const { uid } = req.params;
      const tokenData = readStore("tokens.json", { tokens: [] });
      const tokens = tokenData.tokens || [];

      // Find active token for this user
      const userToken = tokens
        .filter((t) => t.uid === uid && t.active && !t.used)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (
        userToken &&
        (userToken.plan === "ultra" || userToken.plan === "platinum")
      ) {
        res.json({
          hasPremium: true,
          plan: userToken.plan,
          token: userToken.token,
        });
      } else {
        res.json({ hasPremium: false, plan: null, token: null });
      }
    } catch (error) {
      console.error("Error checking premium access:", error);
      res.status(500).json({
        hasPremium: false,
        plan: null,
        token: null,
        error: "Failed to check access",
      });
    }
  });

  // Fetch or create plan token for user (requires JWT)
  app.get("/api/plan-token/:uid/:plan", (req, res) => {
    try {
      const { uid, plan } = req.params;
      const normalizedPlan = String(plan || "").toLowerCase();
      if (!uid || normalizedPlan === "free") {
        return res.status(400).json({ error: "Invalid plan or UID" });
      }

      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing JWT" });
      }
      const jwtToken = authHeader.substring(7);
      let decoded = null;
      try {
        decoded = jwt.verify(
          jwtToken,
          JWT_SECRET || process.env.JWT_SECRET || "supersecretkey",
        );
      } catch (err) {
        return res.status(401).json({ error: "Invalid JWT" });
      }
      if (!decoded || String(decoded.uid) !== String(uid)) {
        return res.status(403).json({ error: "UID mismatch" });
      }

      const activePlan =
        findActivePlan(uid, normalizedPlan) ||
        findLatestApprovedProof(uid, normalizedPlan);
      if (!activePlan) {
        return res.status(403).json({ error: "No active plan found" });
      }

      const existing = getActiveToken(uid, normalizedPlan);
      if (existing && existing.token) {
        return res.json({ token: existing.token, plan: normalizedPlan, uid });
      }

      const email = decoded.email || getUserEmailByUID(uid);
      const durationDays =
        activePlan?.durationDays || PLANS[normalizedPlan]?.durationDays || 30;
      const newToken = createPlatinumToken(
        uid,
        normalizedPlan,
        email,
        req.ip || req.connection?.remoteAddress || null,
        durationDays,
      );
      if (!newToken) {
        return res.status(500).json({ error: "Failed to create token" });
      }
      return res.json({ token: newToken, plan: normalizedPlan, uid });
    } catch (err) {
      console.error("Plan token error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  function resolvePlanAuth(req, plan, uid) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const jwtToken = authHeader.substring(7);
        const decoded = jwt.verify(
          jwtToken,
          JWT_SECRET || process.env.JWT_SECRET || "supersecretkey",
        );
        if (decoded && String(decoded.uid) === String(uid)) {
          return { ok: true, method: "jwt" };
        }
      } catch (err) {
        return { ok: false, error: "Invalid JWT" };
      }
    }

    const planToken =
      req.headers["x-plan-token"] || req.query.token || req.body?.token;
    if (planToken) {
      const tokenData = validateToken(planToken);
      if (
        tokenData &&
        String(tokenData.uid) === String(uid) &&
        String(tokenData.plan) === String(plan)
      ) {
        return { ok: true, method: "plan-token" };
      }
      return { ok: false, error: "Invalid plan token" };
    }

    return { ok: false, error: "Missing auth" };
  }

  // 2FA status for plan page
  app.get("/api/plan-2fa/status", (req, res) => {
    const uid = req.query.uid;
    const plan = String(req.query.plan || "").toLowerCase();
    if (!uid || !["ultra", "platinum"].includes(plan)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const auth = resolvePlanAuth(req, plan, uid);
    if (!auth.ok) {
      return res.status(401).json({ error: auth.error || "Unauthorized" });
    }

    const activePlan = findActivePlan(uid, plan);
    if (!activePlan) {
      return res.status(403).json({ error: "No active plan found" });
    }

    if (isAdminAssignedPlan(activePlan)) {
      return res.json({
        hasPin: !!activePlan.plan2faPin,
        setAt: activePlan.plan2faSetAt || null,
        proofRequired: false,
      });
    }

    const proof = findLatestApprovedProof(uid, plan);
    if (!proof) {
      return res
        .status(403)
        .json({ error: "Approved proof required for purchased plan" });
    }

    return res.json({
      hasPin: !!proof.plan2faPin,
      setAt: proof.plan2faSetAt || null,
      proofRequired: true,
    });
  });

  // 2FA setup for plan page
  app.post("/api/plan-2fa/setup", (req, res) => {
    const { uid, plan, pin } = req.body || {};
    const normalizedPlan = String(plan || "").toLowerCase();
    if (!uid || !["ultra", "platinum"].includes(normalizedPlan)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const auth = resolvePlanAuth(req, normalizedPlan, uid);
    if (!auth.ok) {
      return res.status(401).json({ error: auth.error || "Unauthorized" });
    }

    const pinStr = String(pin || "").trim();
    if (!/^\d{4}[A-Z]{3}$/.test(pinStr)) {
      return res.status(400).json({ error: "Invalid PIN format" });
    }

    const activePlan = findActivePlan(uid, normalizedPlan);
    if (!activePlan) {
      return res.status(403).json({ error: "No active plan found" });
    }

    if (isAdminAssignedPlan(activePlan)) {
      const saved = upsertActivePlan2FA(uid, normalizedPlan, pinStr);
      if (!saved) {
        return res
          .status(500)
          .json({ error: "Failed to save 2FA for admin-set plan" });
      }
      return res.json({ success: true });
    }

    const proofs = readStore("proofs.json", []);
    const proofIdx = proofs.findIndex(
      (p) =>
        String(p.uid) === String(uid) &&
        String(p.plan).toLowerCase() === normalizedPlan &&
        (p.status === "approved" || p.verified === true),
    );

    if (proofIdx === -1) {
      return res
        .status(403)
        .json({ error: "Approved proof required for purchased plan" });
    }

    proofs[proofIdx].plan2faPin = pinStr;
    proofs[proofIdx].plan2faSetAt = new Date().toISOString();
    writeStore("proofs.json", proofs);

    return res.json({ success: true });
  });

  // 2FA verify for plan page
  app.post("/api/plan-2fa/verify", (req, res) => {
    const { uid, plan, pin } = req.body || {};
    const normalizedPlan = String(plan || "").toLowerCase();
    if (!uid || !["ultra", "platinum"].includes(normalizedPlan)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const auth = resolvePlanAuth(req, normalizedPlan, uid);
    if (!auth.ok) {
      return res.status(401).json({ error: auth.error || "Unauthorized" });
    }

    const activePlan = findActivePlan(uid, normalizedPlan);
    if (!activePlan) {
      return res.status(403).json({ error: "No active plan found" });
    }

    if (isAdminAssignedPlan(activePlan)) {
      if (!activePlan.plan2faPin) {
        return res.status(404).json({ error: "2FA not set" });
      }
      const pinStr = String(pin || "").trim();
      if (pinStr !== activePlan.plan2faPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }
      return res.json({ success: true });
    }

    const proof = findLatestApprovedProof(uid, normalizedPlan);
    if (!proof || !proof.plan2faPin) {
      return res.status(404).json({ error: "2FA not set" });
    }

    const pinStr = String(pin || "").trim();
    if (pinStr !== proof.plan2faPin) {
      return res.status(403).json({ error: "Invalid PIN" });
    }

    return res.json({ success: true });
  });

  app.get("/platinum-ui-upload.html", (req, res) => {
    try {
      const token = req.query.token || req.headers["x-access-token"];
      const uid = req.query.uid;

      // Try to verify JWT token from Authorization header or cookies
      const authHeader = req.headers.authorization;
      let jwtUser = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const jwtToken = authHeader.substring(7);
          jwtUser = jwt.verify(
            jwtToken,
            process.env.JWT_SECRET || "supersecretkey",
          );
        } catch (e) {
          // JWT invalid, continue
        }
      }

      // ✅ Check for token-based access FIRST (premium users with token)
      if (token && uid) {
        const tokensData = readStore("tokens.json", { tokens: [] });
        const found = (tokensData.tokens || []).find(
          (t) => t.token === token && t.uid === uid && t.active,
        );
        if (found) {
          console.log(`✅ Platinum UI access via premium token: ${uid}`);
          return res.sendFile(path.join(publicDir, "platinum-ui-upload.html"));
        }
      }

      // ✅ Check JWT authenticated users ONLY if they have platinum/ultra plan
      if (jwtUser && jwtUser.uid) {
        const planSnapshot = getActivePlanSnapshot(jwtUser.uid);
        if (planSnapshot.plan === "platinum" || planSnapshot.plan === "ultra") {
          if (planSnapshot.isActive) {
            console.log(
              `✅ Platinum UI access via JWT: ${jwtUser.uid} with ${planSnapshot.plan} plan`,
            );
            return res.sendFile(
              path.join(publicDir, "platinum-ui-upload.html"),
            );
          }
        }
      }

      // ❌ Deny access to all non-premium users (Silver, Gold, Free)
      console.log(`🚫 Platinum UI access DENIED - non-premium plan`);
      return res.status(403).send(`
        <html>
          <head>
            <title>Access Forbidden - Premium Plan Required</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: 'Poppins', Arial, sans-serif;
                background: linear-gradient(135deg, #0a0a1f 0%, #1a0033 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                color: #e6edf3;
              }
              .container {
                max-width: 500px;
                padding: 40px;
                text-align: center;
                background: rgba(15, 25, 50, 0.8);
                border: 2px solid rgba(255, 0, 255, 0.3);
                border-radius: 20px;
                box-shadow: 0 0 50px rgba(255, 0, 255, 0.2);
              }
              h1 {
                color: #ff4444;
                font-size: 32px;
                margin: 0 0 20px 0;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
              }
              p {
                color: #aaa;
                font-size: 16px;
                line-height: 1.6;
                margin: 15px 0;
              }
              .plan-badge {
                display: inline-block;
                background: linear-gradient(135deg, #00ffcc, #0099ff);
                color: #000;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 15px 0;
                font-size: 14px;
              }
              .button-group {
                display: flex;
                gap: 10px;
                margin-top: 30px;
              }
              button, a {
                flex: 1;
                padding: 14px 24px;
                font-size: 16px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                text-decoration: none;
                font-weight: bold;
                transition: all 0.3s;
              }
              .btn-upgrade {
                background: linear-gradient(135deg, #00ffcc, #0099ff);
                color: #000;
                border: none;
              }
              .btn-upgrade:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 255, 204, 0.4);
              }
              .btn-back {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e6edf3;
              }
              .btn-back:hover {
                background: rgba(255, 255, 255, 0.1);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔐 Access Forbidden (403)</h1>
              <p>The Platinum upload interface is <strong>only available for Platinum and Ultra subscribers</strong>.</p>
              <p style="color: #ff9999; font-weight: bold;">Your current plan does not include access to this feature.</p>
              <div class="plan-badge">Platinum / Ultra Required</div>
              <p style="font-size: 14px; color: #888;">Upgrade your plan to unlock premium upload features, higher storage limits, and exclusive tools.</p>
              <div class="button-group">
                <a href="/upgrade-form.html" class="btn-upgrade">💎 Upgrade Now</a>
                <a href="/upload.html" class="btn-back">← Back to Upload</a>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("❌ Platinum token validation error:", err);
      return res.status(500).send("Server error");
    }
  });

  app.get("/platinum-upload.html", (req, res) => {
    // Route removed
  });

  // ✅ Protected route for platinium-upgrade-form.html (only for platinum/ultra users)
  app.get("/platinium-upgrade-form.html", (req, res) => {
    try {
      const token = req.query.token || req.headers["x-access-token"];
      const uid = req.query.uid;

      // Try to verify JWT token from Authorization header or cookies
      const authHeader = req.headers.authorization;
      let jwtUser = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const jwtToken = authHeader.substring(7);
          jwtUser = jwt.verify(
            jwtToken,
            process.env.JWT_SECRET || "supersecretkey",
          );
        } catch (e) {
          // JWT invalid, continue
        }
      }

      // ✅ Check for token-based access FIRST (premium users with token)
      if (token && uid) {
        const tokensData = readStore("tokens.json", { tokens: [] });
        const found = (tokensData.tokens || []).find(
          (t) => t.token === token && t.uid === uid && t.active,
        );
        if (found) {
          console.log(
            `✅ Platinium upgrade form access via premium token: ${uid}`,
          );
          return res.sendFile(
            path.join(publicDir, "platinium-upgrade-form.html"),
          );
        }
      }

      // ✅ Check JWT authenticated users ONLY if they have platinum/ultra plan
      if (jwtUser && jwtUser.uid) {
        const planSnapshot = getActivePlanSnapshot(jwtUser.uid);
        if (planSnapshot.plan === "platinum" || planSnapshot.plan === "ultra") {
          if (planSnapshot.isActive) {
            console.log(
              `✅ Platinium upgrade form access via JWT: ${jwtUser.uid} with ${planSnapshot.plan} plan`,
            );
            return res.sendFile(
              path.join(publicDir, "platinium-upgrade-form.html"),
            );
          }
        }
      }

      // ❌ Deny access to all non-premium users (Silver, Gold, Free)
      console.log(`🚫 Platinium upgrade form access DENIED - non-premium plan`);
      return res.status(403).send(`
        <html>
          <head>
            <title>Access Forbidden - Premium Plan Required</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: 'Poppins', Arial, sans-serif;
                background: linear-gradient(135deg, #0a0a1f 0%, #1a0033 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                color: #e6edf3;
              }
              .container {
                max-width: 500px;
                padding: 40px;
                text-align: center;
                background: rgba(15, 25, 50, 0.8);
                border: 2px solid rgba(255, 0, 255, 0.3);
                border-radius: 20px;
                box-shadow: 0 0 50px rgba(255, 0, 255, 0.2);
              }
              h1 {
                color: #ff4444;
                font-size: 32px;
                margin: 0 0 20px 0;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
              }
              p {
                color: #aaa;
                font-size: 16px;
                line-height: 1.6;
                margin: 15px 0;
              }
              .plan-badge {
                display: inline-block;
                background: linear-gradient(135deg, #00ffcc, #0099ff);
                color: #000;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                margin: 15px 0;
                font-size: 14px;
              }
              .button-group {
                display: flex;
                gap: 10px;
                margin-top: 30px;
              }
              button, a {
                flex: 1;
                padding: 14px 24px;
                font-size: 16px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                text-decoration: none;
                font-weight: bold;
                transition: all 0.3s;
              }
              .btn-upgrade {
                background: linear-gradient(135deg, #00ffcc, #0099ff);
                color: #000;
                border: none;
              }
              .btn-upgrade:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 255, 204, 0.4);
              }
              .btn-back {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e6edf3;
              }
              .btn-back:hover {
                background: rgba(255, 255, 255, 0.1);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔐 Access Forbidden (403)</h1>
              <p>The Platinum upgrade form is <strong>only available for Platinum and Ultra subscribers</strong>.</p>
              <p style="color: #ff9999; font-weight: bold;">Your current plan does not include access to this feature.</p>
              <div class="plan-badge">Platinum / Ultra Required</div>
              <p style="font-size: 14px; color: #888;">Only platinum and ultra plan users can access this form to manage their plan extensions.</p>
              <div class="button-group">
                <a href="/upgrade-form.html" class="btn-upgrade">💎 Upgrade Now</a>
                <a href="/upload.html" class="btn-back">← Back to Upload</a>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("❌ Platinium upgrade form access error:", err);
      return res.status(500).send("Server error");
    }
  });

  app.get("/uploads/:user/cloudplus_ui/*", verifyToken, (req, res) => {
    try {
      const reqUser = req.user;
      const requestedFolder = req.params.user;
      const users = readStore("users.json", []);
      const owner = users.find((u) => safeName(u.email) === requestedFolder);

      if (!owner) return res.status(404).send("Not found");

      const isOwner =
        normalizeEmail(owner.email) === normalizeEmail(reqUser.email) ||
        owner.uid === reqUser.uid;
      if (
        !isOwner &&
        reqUser.role !== "admin" &&
        reqUser.role !== "superadmin"
      ) {
        return res.status(403).send("Forbidden");
      }

      const rest = req.params[0] || "";
      const filePath = path.join(
        uploadsDir,
        requestedFolder,
        "cloudplus_ui",
        rest,
      );
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
      return res.sendFile(filePath);
    } catch (err) {
      console.error("cloudplus serve error", err);
      return res.status(500).send("Server error");
    }
  });

  app.get("/uploads/:user/cloudplus_ui", verifyToken, (req, res) => {
    try {
      const requestedFolder = req.params.user;
      const indexPath = path.join(
        uploadsDir,
        requestedFolder,
        "cloudplus_ui",
        "index.html",
      );
      if (!fs.existsSync(indexPath)) return res.status(404).send("Not found");
      return res.sendFile(indexPath);
    } catch (err) {
      console.error("cloudplus index error", err);
      return res.status(500).send("Server error");
    }
  });

  // ==================== PLAN ACCESS AUTHORIZATION ====================
  // Check if user has valid token for platinum/ultra plan
  app.get("/check-plan-access/:uid/:plan", async (req, res) => {
    try {
      const { uid, plan } = req.params;
      const tokenFromRequest =
        req.headers.authorization?.replace("Bearer ", "") ||
        req.query.token ||
        req.headers["x-plan-token"];

      if (!uid || !plan || !["platinum", "ultra"].includes(plan)) {
        return res.json({
          success: false,
          msg: "Invalid request parameters",
          authorized: false,
        });
      }

      const { validateToken } = await import("./TOKEN_SYSTEM.js");
      const tokenData = validateToken(tokenFromRequest);

      // Verify token belongs to this user and plan
      if (!tokenData || tokenData.uid !== uid || tokenData.plan !== plan) {
        return res.json({
          success: false,
          msg: "Invalid or expired token for this plan",
          authorized: false,
        });
      }

      // Token is valid!
      return res.json({
        success: true,
        authorized: true,
        token: tokenFromRequest,
        uid: uid,
        plan: plan,
        expiresAt: tokenData.expiresAt,
        msg: "✅ Access granted",
      });
    } catch (err) {
      console.error("⚠️ Plan access check error:", err);
      return res.json({
        success: false,
        msg: "Authorization check failed",
        authorized: false,
      });
    }
  });

  // Get plan authorization status for current user
  // Check plan access - flexible endpoint that works with or without JWT token
  app.post("/api/check-plan-access", async (req, res) => {
    try {
      // Try to get UID from JWT token first (if provided)
      let uid = req.user?.uid;

      // If no JWT, try to get UID from body
      if (!uid && req.body && req.body.uid) {
        uid = req.body.uid;
      }

      // If still no UID, try to get from Authorization header as fallback
      if (!uid) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.substring(7);
          // Try to decode JWT manually
          try {
            const decoded = jwt.verify(
              token,
              process.env.JWT_SECRET || "supersecretkey",
            );
            uid = decoded.uid;
          } catch (e) {
            // Token is invalid, continue without it
          }
        }
      }

      const { plan } = req.body;
      const planTokenFromRequest =
        req.headers["x-plan-token"] || req.body?.token || null;

      if (!uid || !plan || !["platinum", "ultra"].includes(plan)) {
        return res.status(400).json({
          authorized: false,
          msg: "Invalid plan or UID",
        });
      }

      // Fast-path: valid plan token should authorize access even if derived
      // plan snapshots are stale.
      if (planTokenFromRequest) {
        const { validateToken } = await import("./TOKEN_SYSTEM.js");
        const tokenData = validateToken(planTokenFromRequest);
        if (
          tokenData &&
          String(tokenData.uid) === String(uid) &&
          String(tokenData.plan).toLowerCase() === String(plan).toLowerCase()
        ) {
          return res.json({
            authorized: true,
            token: planTokenFromRequest,
            expiresAt: tokenData.expiresAt || null,
            plan: plan,
            msg: "✅ User authorized via valid plan token",
          });
        }
      }

      let users = readStore("users.json", []);
      const user = users.find((u) => u.uid === uid);

      if (!user) {
        return res.status(404).json({
          authorized: false,
          msg: "User not found",
        });
      }

      // Check for uiAccess first (special permissions)
      if (user.uiAccess) {
        const userUiAccess = user.uiAccess.toLowerCase();
        logUiAccessDecision(uid, userUiAccess);

        // Check if uiAccess matches or is higher tier
        if (
          userUiAccess === plan ||
          (userUiAccess === "ultra" && plan === "platinum")
        ) {
          logUiAccessDecision(uid, userUiAccess, plan);
          return res.json({
            authorized: true,
            token: null, // No token needed for uiAccess grants
            expiresAt: null, // No expiry for uiAccess
            plan: plan,
            msg: "✅ User authorized via uiAccess",
          });
        }
      }

      // Check if user has this plan as active in plan-active.json (primary source)
      const planActive = readPlanActiveFile();
      const userPlanEntry = planActive.find(
        (entry) => entry?.self?.uid === uid || entry?.uid === uid,
      );

      if (userPlanEntry && userPlanEntry.plans) {
        const activePlan = userPlanEntry.plans.find((p) => {
          const matchesPlan = p.plan === plan;
          const isActive =
            p.isActive === true ||
            p.status?.isActive === true ||
            p.status?.planActive === true;
          const expiresAt =
            p.expiresAt ||
            p.status?.expiresAt ||
            p.transaction?.expiresAt ||
            null;
          const notExpired = !expiresAt || new Date(expiresAt) > new Date();
          return matchesPlan && isActive && notExpired;
        });

        if (activePlan) {
          console.log(
            `✅ User ${uid} authorized via plan-active.json: ${plan}`,
          );
          return res.json({
            authorized: true,
            token: null, // Token from plan data if needed
            expiresAt:
              activePlan.expiresAt ||
              activePlan.status?.expiresAt ||
              activePlan.transaction?.expiresAt ||
              null,
            plan: plan,
            msg: "✅ User authorized via active plan",
          });
        }
      }

      // Fallback: Check purchases.json for active purchases
      let purchases = readStore("purchases.json", []);
      const activePurchase = purchases.find(
        (p) =>
          p.uid === uid &&
          p.plan === plan &&
          (p.status === "completed" || p.status === "active" || !p.status) &&
          p.isActive === true &&
          (!p.expiresAt || new Date(p.expiresAt) > new Date()),
      );

      if (!activePurchase) {
        return res.json({
          authorized: false,
          msg: "No active plan found",
        });
      }

      // Get the token for this plan
      const { getTokenByUID } = await import("./TOKEN_SYSTEM.js");
      const tokenData = getTokenByUID(uid, plan);

      if (!tokenData || !tokenData.token) {
        return res.json({
          authorized: false,
          msg: "No token generated for this plan",
        });
      }

      return res.json({
        authorized: true,
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        plan: plan,
        msg: "✅ User authorized for plan",
      });
    } catch (err) {
      console.error("⚠️ Plan access check error:", err);
      return res.status(500).json({
        authorized: false,
        msg: "Error checking plan access",
      });
    }
  });

  // Validate token session to prevent reuse
  // Session-based token validation endpoint removed
}

export default registerPlanRoutes;
