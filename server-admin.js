import fs from "fs";
import path from "path";
import { createPlatinumToken, getTokenByUID } from "./TOKEN_SYSTEM.js";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import {
  getPlanActiveList,
  getProofsList,
  getPurchasesList,
  getTokensList,
  getUsersList,
  readKundli,
  updatePlanActiveFromList,
  updateProofsFromList,
  updatePurchasesFromList,
  updateTokensFromList,
  updateUsersFromList,
  writeKundli,
} from "./utils/pay-kundli-manager.js";
import {
  clearVerificationStore,
  getRecentVerifications,
  getVerificationStats,
} from "./utils/verification-store.js";

// Attach admin, support, and JSON-editor routes
export function registerAdminRoutes(core) {
  const { app, paths, helpers, mail, aggregateAllUsersData } = core;
  const PORT = core?.config?.PORT || process.env.PORT || 5000;
  const MAIL_BASE_URL = `http://localhost:${PORT}`;

  // Log the privacy-refresh messages only during the first 2 min of each 22-min cycle
  // (2 min visible → 20 min silent → 2 min visible → …)
  const _privacyLogStart = Date.now();
  const _PRIVACY_LOG_CYCLE_MS = 22 * 60 * 1000; // 22 min full cycle
  const _PRIVACY_LOG_WINDOW_MS = 2 * 60 * 1000; // 2  min show window
  function _shouldLogPrivacy() {
    const elapsed = Date.now() - _privacyLogStart;
    return elapsed % _PRIVACY_LOG_CYCLE_MS < _PRIVACY_LOG_WINDOW_MS;
  }

  const {
    usersFile,
    filesMetaFile,
    planActiveFile,
    planPriceFile,
    proofsFile,
    purchasesFile,
    logsDir,
    uploadsDir,
    supportDir,
    mailLog,
    resetRequestsLog,
    passwordChangesLog,
    uploadsLog,
    loginAttemptsLog,
    flagsLog,
    passwordChangesJsonFile,
  } = paths;
  const { verifyToken, isAdmin, normalizeEmail, safeName } = helpers;
  const { sendStyledMail } = mail;

  function getUsersSafe() {
    return getUsersList();
  }

  function saveUsersSafe(users) {
    updateUsersFromList(users);
  }

  function getPurchasesSafe() {
    return getPurchasesList();
  }

  function savePurchasesSafe(purchases) {
    updatePurchasesFromList(purchases);
  }

  function getProofsSafe() {
    return getProofsList();
  }

  function saveProofsSafe(proofs) {
    updateProofsFromList(proofs);
  }

  function getPlanActiveSafe() {
    return getPlanActiveList();
  }

  function savePlanActiveSafe(planActive) {
    updatePlanActiveFromList(planActive);
  }

  function getTokensSafe() {
    return getTokensList();
  }

  function saveTokensSafe(tokensPayload) {
    updateTokensFromList(tokensPayload);
  }

  function sanitizeAdminPaymentMethod(method) {
    const normalized = String(method || "")
      .trim()
      .toLowerCase();
    if (!normalized) return "admin-manual";
    // Avoid unsafe values in persisted payment metadata.
    if (!/^[a-z0-9_-]{2,40}$/.test(normalized)) return "admin-manual";
    return normalized;
  }

  const COINS_PER_RUPEE = 5;

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
      console.warn("⚠️ Failed to read cloud coins:", err?.message || err);
      return [];
    }
  }

  function saveCoinsSafe(coins) {
    fs.writeFileSync(getCoinsFilePath(), JSON.stringify(coins, null, 2));
    syncCoinsLedgerFromWallets(supportDir, coins);
  }

  function debitUserCoins(uid, amount, reason, meta = {}) {
    const value = Math.floor(Number(amount) || 0);
    if (!uid || value <= 0) {
      return { success: false, code: "invalid_amount", balance: 0 };
    }

    const users = getUsersSafe();
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

  function creditUserCoins(uid, amount, reason, meta = {}) {
    const value = Number(amount) || 0;
    if (!uid || value <= 0) return false;

    const users = getUsersSafe();
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

  const REFERRAL_SUCCESS_TARGET = 10;
  const REFERRAL_REWARD_COINS = 10000;

  function registerSuccessfulReferralPurchaseInAdmin(
    referredUid,
    purchaseMeta = {},
  ) {
    if (!referredUid) return;

    const users = getUsersSafe();
    const referredIdx = users.findIndex(
      (u) => String(u.uid) === String(referredUid),
    );
    if (referredIdx === -1) return;

    const referredUser = users[referredIdx];
    if (!referredUser.referral) referredUser.referral = {};

    const referrerUid = String(referredUser.referral?.referredByUID || "");
    if (!referrerUid) return;

    // Mark this referral completion only once
    if (referredUser.referral.successfulPurchaseCounted === true) return;
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
      const referrer = users[referrerIdx];
      if (!referrer.referral) referrer.referral = {};
      if (!Array.isArray(referrer.referral.successfulReferredUsers)) {
        referrer.referral.successfulReferredUsers = [];
      }

      const list = referrer.referral.successfulReferredUsers;
      if (!list.includes(String(referredUid))) {
        list.push(String(referredUid));
      }
      referrer.referral.successfulReferralsCount = list.length;

      // Award milestone coins
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
        console.log(
          `✅ Awarded ${coinsToAward} coins to ${referrer.email} for reaching ${list.length} successful referrals`,
        );
      }
    }

    saveUsersSafe(users);
  }

  const supportDataDir = path.join(supportDir, "data");
  const supportFiles = {
    reasons: path.join(supportDataDir, "contactReasons.json"),
    priorities: path.join(supportDataDir, "priorities.json"),
    socials: path.join(supportDataDir, "socials.json"),
  };

  const supportDefaults = {
    reasons: {
      reasons: [
        "Technical Issue",
        "Payment / Billing",
        "Account Problem",
        "Feature Request",
        "Feedback / Review",
        "Business / Partnership",
        "Security Concern",
        "Other",
      ],
    },
    priorities: {
      priorities: ["Low", "Normal", "High", "Urgent"],
    },
    socials: {
      socials: [
        {
          name: "Instagram",
          icon: "📸",
          url: "https://instagram.com/YOUR_USERNAME",
        },
        {
          name: "Twitter",
          icon: "🐦",
          url: "https://twitter.com/YOUR_USERNAME",
        },
        { name: "GitHub", icon: "💻", url: "https://github.com/YOUR_USERNAME" },
        { name: "Email", icon: "📧", url: "mailto:support@cloudspace.com" },
      ],
    },
  };

  // Helper function to load PLANS from plan-price.json
  function loadPlans() {
    try {
      if (fs.existsSync(planPriceFile)) {
        const planData = JSON.parse(fs.readFileSync(planPriceFile, "utf8"));
        return planData.plans || {};
      }
      return {};
    } catch (err) {
      console.error("❌ Error loading plans:", err);
      return {};
    }
  }

  // Helper function to generate plan active data (from server-plans.js)
  function generatePlanActiveData() {
    try {
      const purchases = getPurchasesSafe();
      const users = getUsersSafe();

      const planActive = [];
      users.forEach((user) => {
        const userPurchases = purchases.filter(
          (p) => p.uid === user.uid && p.isActive,
        );
        if (userPurchases.length > 0) {
          planActive.push({
            email: user.email,
            uid: user.uid,
            plans: userPurchases,
          });
        }
      });

      savePlanActiveSafe(planActive);
      console.log(
        `✅ Generated plan-active data for ${planActive.length} users`,
      );
    } catch (err) {
      console.error("❌ Error generating plan active data:", err);
    }
  }

  // Helper function to log purchase (simplified version from server-plans.js)
  function logPurchase(
    user,
    plan,
    originalAmount,
    discount,
    discountPercent,
    finalAmount,
    method,
    transactionId,
    proofId,
    cardLast4,
    notes,
    customPlanDetails,
    options = {},
  ) {
    try {
      let purchases = getPurchasesSafe();

      const PLANS = loadPlans();
      const planDetails = customPlanDetails ||
        PLANS[plan] || { storageTB: 0, durationDays: 30 };

      const durationMs = planDetails.durationMinutes
        ? planDetails.durationMinutes * 60 * 1000
        : (planDetails.durationDays || 30) * 24 * 60 * 60 * 1000;

      const newPurchase = {
        _id: proofId,
        uid: user.uid,
        email: user.email,
        username: user.username,
        plan: plan,
        planDetails: planDetails,
        amount: originalAmount,
        discount: discount || 0,
        discountPercent: discountPercent || 0,
        finalAmount: finalAmount,
        method: method,
        transactionId: transactionId,
        cardLast4: cardLast4 || null,
        notes: notes || "",
        purchasedAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMs).toISOString(),
        isActive: true,
        status: "completed",
        proofId: proofId,
      };

      purchases.push(newPurchase);
      savePurchasesSafe(purchases);
      generatePlanActiveData();

      console.log(`✅ Purchase logged: ${user.email} - ${plan}`);
    } catch (err) {
      console.error("❌ Error logging purchase:", err);
    }
  }

  function ensureSupportData() {
    if (!fs.existsSync(supportDir))
      fs.mkdirSync(supportDir, { recursive: true });
    if (!fs.existsSync(supportDataDir))
      fs.mkdirSync(supportDataDir, { recursive: true });

    if (!fs.existsSync(supportFiles.reasons))
      fs.writeFileSync(
        supportFiles.reasons,
        JSON.stringify(supportDefaults.reasons, null, 2),
      );

    if (!fs.existsSync(supportFiles.priorities))
      fs.writeFileSync(
        supportFiles.priorities,
        JSON.stringify(supportDefaults.priorities, null, 2),
      );

    if (!fs.existsSync(supportFiles.socials))
      fs.writeFileSync(
        supportFiles.socials,
        JSON.stringify(supportDefaults.socials, null, 2),
      );
  }

  ensureSupportData();

  app.get("/api/admin/data", (req, res) => {
    res.json({ message: "Cloud Space Server Active ✅" });
  });

  app.get("/api/admin/all-json-data", verifyToken, isAdmin, (req, res) => {
    try {
      const proofs = getProofsSafe();
      const purchases = getPurchasesSafe();
      const planActive = getPlanActiveSafe();
      const planPrice = JSON.parse(fs.readFileSync(planPriceFile, "utf8"));
      const users = getUsersSafe();

      // Read files.json
      let files = [];
      try {
        files = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));
      } catch (e) {
        console.warn("Could not read files.json:", e.message);
      }

      res.json({
        proofs,
        purchases,
        planActive,
        planPrice,
        users,
        files,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error reading JSON files:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch JSON data", details: error.message });
    }
  });

  // Admin Friends Monitor endpoint
  app.post("/api/admin/friends-monitor", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      // Read friends data files
      const friendsDir = path.join(supportDir, "friends");
      const friendsFile = path.join(friendsDir, "friends.json");
      const messagesFile = path.join(friendsDir, "messages.json");
      const reqFile = path.join(friendsDir, "req.json");
      const shareFile = path.join(friendsDir, "share.json");

      let friends = [];
      let messages = [];
      let requests = [];
      let shares = [];

      try {
        if (fs.existsSync(friendsFile)) {
          friends = JSON.parse(fs.readFileSync(friendsFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read friends.json:", e.message);
      }

      try {
        if (fs.existsSync(messagesFile)) {
          messages = JSON.parse(fs.readFileSync(messagesFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read messages.json:", e.message);
      }

      try {
        if (fs.existsSync(reqFile)) {
          requests = JSON.parse(fs.readFileSync(reqFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read req.json:", e.message);
      }

      try {
        if (fs.existsSync(shareFile)) {
          shares = JSON.parse(fs.readFileSync(shareFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read share.json:", e.message);
      }

      // Process and organize data
      const stats = {
        totalFriends: friends.length,
        totalMessages: messages.length,
        totalRequests: requests.length,
        totalShares: shares.length,
      };

      // Count pending requests
      const pendingRequests = requests.filter(
        (r) => r.status === "pending",
      ).length;

      // Count active/recent messages
      const activeChats = new Set(
        messages.map((m) => m.chatId || `${m.from}-${m.to}`),
      ).size;

      res.json({
        stats: { ...stats, pendingRequests, activeChats },
        friends: friends.slice(0, 50), // Limit to 50 for performance
        messages: messages.slice(-100).reverse(), // Last 100 messages
        requests,
        shares: shares.slice(-50).reverse(), // Last 50 shares
      });
    } catch (error) {
      console.error("Error reading friends monitor data:", error);
      res.status(500).json({
        error: "Failed to fetch friends data",
        details: error.message,
      });
    }
  });

  // Admin Chat Management endpoints
  app.post("/api/admin/chat/send-message", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin, toUser, toUID, message } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      if (!message || !toUser) {
        return res
          .status(400)
          .json({ error: "Message and recipient required" });
      }

      // Read messages.json
      const friendsDir = path.join(supportDir, "friends");
      const messagesFile = path.join(friendsDir, "messages.json");
      const adminChatsFile = path.join(friendsDir, "admin-chats.json");

      let messages = [];
      try {
        if (fs.existsSync(messagesFile)) {
          messages = JSON.parse(fs.readFileSync(messagesFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read messages.json:", e.message);
      }

      // Auto-approve user for admin chat when admin sends first message
      let adminChats = [];
      try {
        if (fs.existsSync(adminChatsFile)) {
          adminChats = JSON.parse(
            fs.readFileSync(adminChatsFile, "utf8") || "[]",
          );
        }
      } catch (e) {
        console.warn("Could not read admin-chats.json:", e.message);
      }

      const existingChat = adminChats.find((c) => c.userUID === toUID);
      if (!existingChat) {
        adminChats.push({
          id: `admin_chat_${Date.now()}`,
          userUID: toUID || toUser,
          userEmail: toUser,
          approved: true,
          initiatedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        });
        fs.writeFileSync(adminChatsFile, JSON.stringify(adminChats, null, 2));
      }

      // Add new message from admin
      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        from: "ADMIN",
        fromUID: "admin_system",
        to: toUser,
        toUID: toUID || toUser,
        message: message,
        messageType: "admin_message",
        timestamp: new Date().toISOString(),
        read: false,
      };

      messages.push(newMessage);

      // Write back to messages.json
      fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));

      res.json({
        success: true,
        message: "Message sent",
        messageId: newMessage.id,
      });
    } catch (error) {
      console.error("Error sending admin message:", error);
      res
        .status(500)
        .json({ error: "Failed to send message", details: error.message });
    }
  });

  app.post(
    "/api/admin/chat/delete-message",
    verifyToken,
    isAdmin,
    (req, res) => {
      try {
        const { pin, messageId } = req.body;
        const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

        if (pin !== correctPin) {
          return res.status(403).json({ error: "Invalid PIN" });
        }

        const friendsDir = path.join(supportDir, "friends");
        const messagesFile = path.join(friendsDir, "messages.json");

        let messages = [];
        try {
          if (fs.existsSync(messagesFile)) {
            messages = JSON.parse(
              fs.readFileSync(messagesFile, "utf8") || "[]",
            );
          }
        } catch (e) {
          console.warn("Could not read messages.json:", e.message);
        }

        // Remove the message
        const initialLength = messages.length;
        messages = messages.filter((m) => m.id !== messageId);

        if (messages.length === initialLength) {
          return res.status(404).json({ error: "Message not found" });
        }

        fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));

        res.json({ success: true, message: "Message deleted" });
      } catch (error) {
        console.error("Error deleting message:", error);
        res
          .status(500)
          .json({ error: "Failed to delete message", details: error.message });
      }
    },
  );

  app.post("/api/admin/chat/edit-message", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin, messageId, newMessage } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      if (!newMessage) {
        return res.status(400).json({ error: "New message required" });
      }

      const friendsDir = path.join(supportDir, "friends");
      const messagesFile = path.join(friendsDir, "messages.json");

      let messages = [];
      try {
        if (fs.existsSync(messagesFile)) {
          messages = JSON.parse(fs.readFileSync(messagesFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read messages.json:", e.message);
      }

      // Update the message
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) {
        return res.status(404).json({ error: "Message not found" });
      }

      msg.message = newMessage;
      msg.edited = new Date().toISOString();

      fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));

      res.json({ success: true, message: "Message updated" });
    } catch (error) {
      console.error("Error editing message:", error);
      res
        .status(500)
        .json({ error: "Failed to edit message", details: error.message });
    }
  });

  // Ban user from chat (permanent or timed)
  app.post("/api/admin/chat/ban-user", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin, toUser, toUID, banType, duration, durationUnit } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      if (!toUser) {
        return res.status(400).json({ error: "User to ban required" });
      }

      const friendsDir = path.join(supportDir, "friends");
      const bansFile = path.join(friendsDir, "chat-bans.json");

      let bans = [];
      try {
        if (fs.existsSync(bansFile)) {
          bans = JSON.parse(fs.readFileSync(bansFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read chat-bans.json:", e.message);
      }

      // Check if already banned
      const existingBan = bans.find(
        (b) => b.userEmail === toUser || b.userUID === toUID,
      );
      if (existingBan) {
        return res.status(400).json({ error: "User already banned" });
      }

      // Calculate expiry if timed ban
      let expiresAt = null;
      let durationLabel = null;
      if (banType === "timed" && duration) {
        const now = new Date();
        const unit = (durationUnit || "hours").toLowerCase();
        const minutes = unit === "minutes" ? duration : duration * 60;
        const expiryTime = new Date(now.getTime() + minutes * 60 * 1000);
        expiresAt = expiryTime.toISOString();
        durationLabel = `${duration} ${unit}`;
      }

      const ban = {
        id: `ban_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userEmail: toUser,
        userUID: toUID || toUser,
        banType: banType || "permanent",
        bannedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        reason: req.body.reason || "No reason provided",
        bannedBy: "ADMIN",
      };

      bans.push(ban);
      fs.writeFileSync(bansFile, JSON.stringify(bans, null, 2));

      res.json({
        success: true,
        message: `User banned ${banType === "timed" ? `for ${durationLabel}` : "permanently"}`,
        banId: ban.id,
      });
    } catch (error) {
      console.error("Error banning user:", error);
      res
        .status(500)
        .json({ error: "Failed to ban user", details: error.message });
    }
  });

  // Unban user from chat
  app.post("/api/admin/chat/unban-user", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin, banId } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      if (!banId) {
        return res.status(400).json({ error: "Ban ID required" });
      }

      const friendsDir = path.join(supportDir, "friends");
      const bansFile = path.join(friendsDir, "chat-bans.json");

      let bans = [];
      try {
        if (fs.existsSync(bansFile)) {
          bans = JSON.parse(fs.readFileSync(bansFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read chat-bans.json:", e.message);
      }

      const initialLength = bans.length;
      bans = bans.filter((b) => b.id !== banId);

      if (bans.length === initialLength) {
        return res.status(404).json({ error: "Ban not found" });
      }

      fs.writeFileSync(bansFile, JSON.stringify(bans, null, 2));

      res.json({ success: true, message: "User unbanned" });
    } catch (error) {
      console.error("Error unbanning user:", error);
      res
        .status(500)
        .json({ error: "Failed to unban user", details: error.message });
    }
  });

  // Get all chat bans
  app.post("/api/admin/chat/get-bans", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      const friendsDir = path.join(supportDir, "friends");
      const bansFile = path.join(friendsDir, "chat-bans.json");

      let bans = [];
      try {
        if (fs.existsSync(bansFile)) {
          bans = JSON.parse(fs.readFileSync(bansFile, "utf8") || "[]");
        }
      } catch (e) {
        console.warn("Could not read chat-bans.json:", e.message);
      }

      // Filter out expired timed bans
      const now = new Date();
      bans = bans.filter((b) => {
        if (b.banType === "timed" && b.expiresAt) {
          const expiryTime = new Date(b.expiresAt);
          if (expiryTime < now) {
            return false; // Ban expired
          }
        }
        return true;
      });

      // Save back (to clean up expired bans)
      fs.writeFileSync(bansFile, JSON.stringify(bans, null, 2));

      res.json({ success: true, bans: bans });
    } catch (error) {
      console.error("Error fetching bans:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch bans", details: error.message });
    }
  });

  // Mark admin chat as approved (user can now reply to admin)
  app.post("/api/admin/chat/approve-user", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin, userUID, userEmail } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      if (!userUID) {
        return res.status(400).json({ error: "User UID required" });
      }

      const friendsDir = path.join(supportDir, "friends");
      const adminChatsFile = path.join(friendsDir, "admin-chats.json");

      let adminChats = [];
      try {
        if (fs.existsSync(adminChatsFile)) {
          adminChats = JSON.parse(
            fs.readFileSync(adminChatsFile, "utf8") || "[]",
          );
        }
      } catch (e) {
        console.warn("Could not read admin-chats.json:", e.message);
      }

      // Check if already approved
      const existingChat = adminChats.find((c) => c.userUID === userUID);
      if (existingChat && existingChat.approved) {
        return res.status(400).json({ error: "User already approved" });
      }

      if (existingChat) {
        existingChat.approved = true;
        existingChat.approvedAt = new Date().toISOString();
      } else {
        adminChats.push({
          id: `admin_chat_${Date.now()}`,
          userUID: userUID,
          userEmail: userEmail || "",
          approved: true,
          initiatedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        });
      }

      fs.writeFileSync(adminChatsFile, JSON.stringify(adminChats, null, 2));

      res.json({ success: true, message: "User approved for admin chat" });
    } catch (error) {
      console.error("Error approving admin chat:", error);
      res
        .status(500)
        .json({ error: "Failed to approve user", details: error.message });
    }
  });

  // Admin Privacy endpoint - requires admin + PIN verification
  app.post("/api/admin/privacy-data", verifyToken, isAdmin, (req, res) => {
    try {
      const { pin } = req.body;
      const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

      if (pin !== correctPin) {
        return res.status(403).json({ error: "Invalid PIN" });
      }

      // Re-aggregate all data from JSON files to ensure fresh data
      const aggColors = {
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        magenta: "\x1b[35m",
        white: "\x1b[37m",
        reset: "\x1b[0m",
        bright: "\x1b[1m",
      };
      if (_shouldLogPrivacy()) {
        console.log(
          `${aggColors.bright}${aggColors.cyan}🔄 Re-aggregating ${aggColors.yellow}all user data ${aggColors.cyan}from ${aggColors.magenta}JSON files${aggColors.cyan}...${aggColors.reset}`,
        );
      }
      aggregateAllUsersData();

      // Read all-users-data.json
      const allUsersDataFile = path.join(supportDir, "all-users-data.json");
      if (!fs.existsSync(allUsersDataFile)) {
        return res.status(404).json({ error: "Privacy data file not found" });
      }

      const allUsersData = JSON.parse(
        fs.readFileSync(allUsersDataFile, "utf8"),
      );

      // Normalize purchase active flags for admin UI consistency.
      const resolvePurchaseIsActive = (purchase) => {
        if (!purchase) return false;

        const explicitFalse =
          purchase?.status?.isActive === false ||
          purchase?.status?.planActive === false ||
          purchase?.isActive === false;
        if (explicitFalse) return false;

        const explicitInactive =
          purchase.isBlocked === true ||
          purchase?.status?.isBlocked === true ||
          String(purchase?.status || "").toLowerCase() === "inactive";
        if (explicitInactive) return false;

        const explicitActive =
          purchase?.status?.isActive === true ||
          purchase?.status?.planActive === true ||
          purchase.isActive === true ||
          String(purchase?.status || "").toLowerCase() === "active";
        if (!explicitActive) return false;

        const expiryRaw =
          purchase.expiresAt ||
          purchase?.status?.expiresAt ||
          purchase?.transaction?.expiresAt ||
          null;
        if (!expiryRaw) return true;
        const expiryMs = new Date(expiryRaw).getTime();
        return Number.isFinite(expiryMs) ? expiryMs > Date.now() : true;
      };

      if (Array.isArray(allUsersData?.users)) {
        allUsersData.users.forEach((entry) => {
          const purchases = entry?.payments?.purchases;
          if (!Array.isArray(purchases)) return;
          purchases.forEach((purchase) => {
            const normalizedActive = resolvePurchaseIsActive(purchase);
            purchase.status = {
              ...(purchase.status || {}),
              isActive: normalizedActive,
              planActive: normalizedActive,
            };
            purchase.isActive = normalizedActive;
            if (normalizedActive) {
              purchase.isBlocked = false;
            }
          });
        });
      }

      if (_shouldLogPrivacy()) {
        console.log(
          `${aggColors.bright}${aggColors.green}✅ Privacy data loaded ${aggColors.cyan}with latest data from ${aggColors.yellow}all JSON files${aggColors.reset}`,
        );
      }
      res.json(allUsersData);
    } catch (error) {
      console.error("Error reading privacy data:", error);
      res.status(500).json({
        error: "Failed to fetch privacy data",
        details: error.message,
      });
    }
  });

  app.post(
    "/api/admin/privacy-kundli-user",
    verifyToken,
    isAdmin,
    (req, res) => {
      try {
        const { pin, email, uid } = req.body || {};
        const correctPin = process.env.ADMIN_PRIVACY_PIN || "your_admin_pin_here";

        if (pin !== correctPin) {
          return res.status(403).json({ error: "Invalid PIN" });
        }

        if (!email && !uid) {
          return res.status(400).json({ error: "email or uid is required" });
        }

        const kundli = readKundli();
        const normalizedEmail = normalizeEmail(email || "");
        const userEntry = (kundli || []).find((entry) => {
          if (uid && entry.uid === uid) return true;
          if (
            normalizedEmail &&
            normalizeEmail(entry.email || "") === normalizedEmail
          )
            return true;
          return false;
        });

        if (!userEntry) {
          return res
            .status(404)
            .json({ error: "User not found in USER-pay-kundli.JSON" });
        }

        return res.json({ user: userEntry });
      } catch (error) {
        console.error("Error fetching user from USER-pay-kundli.JSON:", error);
        return res.status(500).json({
          error: "Failed to fetch USER-pay-kundli entry",
          details: error.message,
        });
      }
    },
  );

  // Update user plan endpoint
  app.post("/api/admin/update-user-plan", verifyToken, isAdmin, (req, res) => {
    try {
      const { email, newPlan, createNew, paymentMethod } = req.body;
      const assignmentSource = "admin-set-plan";
      const normalizedEmail = normalizeEmail(email);
      const nowIso = new Date().toISOString();
      const selectedPaymentMethod = sanitizeAdminPaymentMethod(paymentMethod);

      if (!email || !newPlan) {
        return res.status(400).json({ error: "Email and plan are required" });
      }

      // Read plan-active.json
      let planActive = getPlanActiveSafe();
      const users = getUsersSafe();
      const baseUser = users.find(
        (u) => normalizeEmail(u.email || "") === normalizedEmail,
      );

      // Find user's plan data
      let userPlan = planActive.find(
        (p) =>
          normalizeEmail(p.email || "") === normalizedEmail ||
          (p.self && normalizeEmail(p.self.email || "") === normalizedEmail),
      );

      // If user plan doesn't exist, create it
      if (!userPlan) {
        const user = baseUser;

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Create new plan entry
        userPlan = {
          uid: user.uid || email.split("@")[0],
          email: user.email || email,
          username: user.username || email,
          self: {
            uid: user.uid || email.split("@")[0],
            email: user.email || email,
            username: user.username || email,
            phone: user.phone || "",
            createdAt:
              user.created_at || user.createdAt || new Date().toISOString(),
          },
          plans: [],
          summary: {
            totalPlans: 0,
            currentPlan: "free",
            lastUpdate: new Date().toISOString(),
          },
        };

        planActive.push(userPlan);
        console.log(`📝 Created new plan entry for user: ${email}`);
      }

      const planUid =
        userPlan.uid ||
        userPlan.self?.uid ||
        baseUser?.uid ||
        email.split("@")[0];
      const planEmail =
        userPlan.email || userPlan.self?.email || baseUser?.email || email;
      const planUsername =
        userPlan.username ||
        userPlan.self?.username ||
        baseUser?.username ||
        planEmail;

      // Canonicalize identity fields to avoid writing orphan entries.
      userPlan.uid = planUid;
      userPlan.email = planEmail;
      userPlan.username = planUsername;
      userPlan.self = {
        ...(userPlan.self || {}),
        uid: planUid,
        email: planEmail,
        username: planUsername,
      };

      // Admin plan switch should make the new assignment the single active entitlement.
      userPlan.plans = (
        Array.isArray(userPlan.plans) ? userPlan.plans : []
      ).map((record) => {
        if (!record || typeof record !== "object") return record;

        const status = { ...(record.status || {}) };
        const isActiveNow =
          status.planActive === true ||
          status.isActive === true ||
          record.isActive === true;

        if (!isActiveNow) return record;

        status.planActive = false;
        status.isActive = false;
        status.status = "inactive";
        status.deactivatedAt = nowIso;

        return {
          ...record,
          isActive: false,
          status,
        };
      });

      // Read plan pricing
      const planPrice = JSON.parse(
        fs.readFileSync(planPriceFile, "utf8") || "{}",
      );
      const plans = planPrice.plans || {};
      const newPlanData = plans[newPlan];

      if (!newPlanData) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      // Generate token for paid plans using unified token generator.
      function generatePlanToken(planType) {
        const normalized = String(planType || "").toLowerCase();
        if (!normalized || normalized === "free") return null;
        const durationDays = Number(newPlanData.durationDays) || 30;
        return createPlatinumToken(
          planUid,
          normalized,
          planEmail,
          null,
          durationDays,
        );
      }

      function tokenMatchesPlan(tokenValue, planType) {
        const token = String(tokenValue || "").toUpperCase();
        const plan = String(planType || "").toLowerCase();
        if (!token) return false;
        if (plan === "platinum") {
          return token.includes("-PLATPLAN-") || token.startsWith("TOK-PCS");
        }
        if (plan === "ultra") {
          return token.includes("-ULTRPLAN-") || token.startsWith("TOK-UCS");
        }
        if (plan === "silver") return token.includes("-SILVPLAN-");
        if (plan === "gold") return token.includes("-GOLDPLAN-");
        return true;
      }

      // Load existing tokens for reuse (one token per user+plan unless createNew=true)
      let existingToken = null;
      try {
        const tokenData = getTokensSafe();
        const tokenArr = Array.isArray(tokenData.tokens)
          ? tokenData.tokens
          : [];
        existingToken =
          tokenArr.find((t) => {
            const samePlan =
              (t.plan || "").toLowerCase() === newPlan.toLowerCase();
            const sameEmail =
              normalizeEmail(t.email || "") === normalizeEmail(planEmail);
            const sameUid = (t.uid || "") === planUid;
            return samePlan && (sameEmail || sameUid);
          }) || null;
      } catch (err) {
        console.error(
          "❌ Failed reading tokens from USER-pay-kundli.JSON:",
          err,
        );
      }

      // If existing token prefix mismatches the target plan, expire it and force new generation
      if (existingToken && !tokenMatchesPlan(existingToken.token, newPlan)) {
        try {
          const tokenData = getTokensSafe();
          const tokenArr = Array.isArray(tokenData.tokens)
            ? tokenData.tokens
            : [];
          tokenArr.forEach((t) => {
            const samePlan =
              (t.plan || "").toLowerCase() === newPlan.toLowerCase();
            const sameEmail =
              normalizeEmail(t.email || "") === normalizeEmail(planEmail);
            const sameUid = (t.uid || "") === planUid;
            if (samePlan && (sameEmail || sameUid)) {
              t.active = false;
              t.used = true;
              t.expiresAt = new Date().toISOString();
            }
          });
          saveTokensSafe({ tokens: tokenArr });
        } catch (err) {
          console.error("❌ Failed to expire mismatched token:", err);
        }
        existingToken = null;
      }

      // If admin wants a brand-new issuance, expire old tokens for that plan
      if (createNew && existingToken) {
        try {
          const tokenData = getTokensSafe();
          const tokenArr = Array.isArray(tokenData.tokens)
            ? tokenData.tokens
            : [];
          tokenArr.forEach((t) => {
            const samePlan =
              (t.plan || "").toLowerCase() === newPlan.toLowerCase();
            const sameEmail =
              normalizeEmail(t.email || "") === normalizeEmail(planEmail);
            const sameUid = (t.uid || "") === planUid;
            if (samePlan && (sameEmail || sameUid)) {
              t.active = false;
              t.used = true;
              t.expiresAt = new Date().toISOString();
            }
          });
          saveTokensSafe({ tokens: tokenArr });
        } catch (err) {
          console.error("❌ Failed expiring old tokens:", err);
        }
        existingToken = null; // force new generation
      }

      const planToken =
        !createNew && existingToken?.token
          ? existingToken.token
          : generatePlanToken(newPlan.toLowerCase());

      // Create new plan record
      const issuedAt = new Date().toISOString();
      const issueStamp = Date.now();
      const adminProofId = `ADMIN-PROOF-${issueStamp}`;
      const adminTransactionId = `ADMIN-UPDATE-${issueStamp}`;
      const durationDays = newPlanData.durationDays || 30;
      const expiresAt = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const newPlanRecord = {
        plan: newPlan,
        planDisplay:
          newPlanData.name ||
          newPlan.charAt(0).toUpperCase() + newPlan.slice(1) + " Plan",
        source: assignmentSource,
        actionLabel: "Admin set plan",
        assignedBy: req.user?.email || "admin",
        planDetails: {
          storage: newPlanData.storageTB,
          storageTB: newPlanData.storageTB,
          durationDays: durationDays,
          maxUploadSize: "10GB",
          features: newPlanData.features || [],
        },
        transaction: {
          transactionId: adminTransactionId,
          paymentMethod: selectedPaymentMethod,
          currency: "INR",
          amount: 0,
          amountDiscount: 0,
          discountApplied: 0,
          finalAmount: 0,
          purchasedAt: issuedAt,
          activatedAt: issuedAt,
          expiresAt: expiresAt,
          status: "approved",
          approved: true,
          approvedAt: issuedAt,
          approvedBy: req.user?.email || "admin",
          proofId: adminProofId,
          notes: "Plan updated by admin",
          source: assignmentSource,
          actionLabel: "Admin set plan",
          assignedBy: req.user?.email || "admin",
        },
        status: {
          isActive: true,
          isBlocked: false,
          blockedReason: null,
          blockedAt: null,
          planActive: true,
        },
        recordId: "PURCHASE-" + Date.now(),
      };

      // Add token if applicable (reuse existing when createNew=false, otherwise create once)
      if (planToken) {
        newPlanRecord.accessToken = planToken;
        if (existingToken) {
          console.log(
            `🔑 Reusing existing token for ${newPlan.toUpperCase()}: ${planToken}`,
          );
        } else {
          console.log(
            `🔑 Generated ${newPlan.toUpperCase()} token: ${planToken}`,
          );
        }
      }

      // Persist purchase entry so UI can fetch from purchases.json
      try {
        const purchases = getPurchasesSafe();
        const purchaseNowIso = issuedAt;

        // Keep a single active purchase entitlement for this user after admin plan switch.
        purchases.forEach((p) => {
          const sameEmail =
            normalizeEmail(p.email || "") === normalizeEmail(planEmail);
          const sameUid = (p.uid || "") === planUid;
          if (sameEmail || sameUid) {
            p.isActive = false;
            p.status = "completed";
            p.deactivatedAt = purchaseNowIso;
            p.accessToken = p.accessToken || null;
          }
        });

        const purchaseRecord = {
          _id: newPlanRecord.recordId,
          uid: planUid,
          email: planEmail,
          username: planUsername,
          plan: newPlan,
          source: assignmentSource,
          actionLabel: "Admin set plan",
          assignedBy: req.user?.email || "admin",
          amount: 0,
          amountDiscount: 0,
          discountApplied: 0,
          finalAmount: 0,
          currency: "INR",
          paymentMethod: selectedPaymentMethod,
          cardLast4: null,
          proofId: adminProofId,
          status: "approved",
          verified: true,
          verifiedAt: purchaseNowIso,
          verifiedBy: req.user?.email || "admin",
          purchasedAt: purchaseNowIso,
          activatedAt: purchaseNowIso,
          expiresAt: expiresAt,
          durationDays: newPlanRecord.planDetails.durationDays,
          storageTB: newPlanRecord.planDetails.storageTB,
          transactionId: adminTransactionId,
          notes: `Admin plan approved and set manually by ${req.user?.email || "admin"}`,
          isActive: true,
          isBlocked: false,
          blockedReason: null,
          blockedAt: null,
          renewalAttempts: 0,
          lastRenewalAttempt: null,
          accessToken: planToken || null,
        };
        purchases.push(purchaseRecord);
        savePurchasesSafe(purchases);
      } catch (err) {
        console.error("❌ Failed to persist purchase entry:", err);
      }

      // Persist a synthetic approved proof for admin-assigned plans.
      try {
        const proofs = getProofsSafe();
        const uid = planUid;
        const existingProofIdx = proofs.findIndex(
          (p) =>
            String(p._id || p.proofId || "") === adminProofId ||
            (String(p.uid || "") === String(uid) &&
              String(p.transactionId || "") === String(adminTransactionId)),
        );

        const adminProofRecord = {
          _id: adminProofId,
          uid,
          email,
          userEmail: email,
          plan: newPlan,
          planDisplay:
            newPlanData.name ||
            newPlan.charAt(0).toUpperCase() + newPlan.slice(1) + " Plan",
          method: selectedPaymentMethod,
          paymentMethod: selectedPaymentMethod,
          amount: 0,
          originalAmount: 0,
          discountPercent: 0,
          discount: 0,
          finalAmount: 0,
          discountSource: "admin",
          coupon: null,
          coinsDiscount: null,
          upi_txn_id: adminTransactionId,
          transactionId: adminTransactionId,
          card: null,
          notes: `Auto-approved proof generated for admin set plan by ${req.user?.email || "admin"}`,
          screenshot: null,
          requestedStorageTB: newPlanData.storageTB,
          storageTB: newPlanData.storageTB,
          durationDays,
          status: "approved",
          highlighted: false,
          submittedAt: issuedAt,
          createdAt: issuedAt,
          verifiedAt: issuedAt,
          verifiedBy: req.user?.email || "admin",
          adminNotes: "Auto-created because plan was assigned by admin",
          extend: false,
          source: assignmentSource,
          actionLabel: "Admin set plan",
          verified: true,
        };

        if (existingProofIdx >= 0) {
          proofs[existingProofIdx] = {
            ...proofs[existingProofIdx],
            ...adminProofRecord,
          };
        } else {
          proofs.push(adminProofRecord);
        }
        saveProofsSafe(proofs);
      } catch (err) {
        console.error("❌ Failed to persist admin synthetic proof:", err);
      }

      // Add to plans array
      userPlan.plans.push(newPlanRecord);

      // Update summary
      userPlan.summary = {
        totalPlans: userPlan.plans.length,
        currentPlan: newPlan,
        lastUpdate: new Date().toISOString(),
      };

      // Save updated plan-active.json
      savePlanActiveSafe(planActive);

      // Regenerate all-users-data.json
      aggregateAllUsersData();

      res.json({
        success: true,
        message: "Plan updated successfully",
        paymentMethod: selectedPaymentMethod,
        newPlan: newPlanRecord,
      });
    } catch (error) {
      console.error("Error updating user plan:", error);
      res
        .status(500)
        .json({ error: "Failed to update plan", details: error.message });
    }
  });

  app.put("/api/admin/update-user", verifyToken, isAdmin, (req, res) => {
    try {
      const { email, updatedData } = req.body;
      if (!email || !updatedData) {
        return res
          .status(400)
          .json({ error: "Email and updated data are required" });
      }

      let users = getUsersSafe();
      const targetEmail = normalizeEmail(email);
      const userIndex = users.findIndex(
        (u) => normalizeEmail(u.email || "") === targetEmail,
      );

      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!updatedData.password) {
        updatedData.password = users[userIndex].password;
      }

      users[userIndex] = { ...users[userIndex], ...updatedData };
      saveUsersSafe(users);

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 📝 User ${email} updated by ${req.user.email}\n`,
      );

      // Regenerate all-users-data.json to reflect changes
      aggregateAllUsersData();

      res.json({
        success: true,
        message: "User updated successfully",
        user: users[userIndex],
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res
        .status(500)
        .json({ error: "Failed to update user", details: error.message });
    }
  });

  // Admin actions on user account
  app.post("/api/admin/user-admin-action", verifyToken, isAdmin, (req, res) => {
    try {
      const { email, action, payload = {} } = req.body;
      if (!email || !action) {
        return res.status(400).json({ error: "Email and action are required" });
      }

      let users = getUsersSafe();
      const userIndex = users.findIndex(
        (u) => normalizeEmail(u.email || "") === normalizeEmail(email),
      );
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = users[userIndex];
      const adminNotes = Array.isArray(user.adminNotes) ? user.adminNotes : [];
      const addNote = (noteText) => {
        if (!noteText) return;
        adminNotes.push({
          note: noteText,
          by: req.user.email,
          at: new Date().toISOString(),
          action,
        });
      };

      const generateTempPassword = () =>
        Math.random().toString(36).slice(-10) +
        Math.floor(Math.random() * 1000);
      let extra = {};

      switch (action) {
        case "resetPassword": {
          const newPassword = payload.newPassword || generateTempPassword();
          user.password = newPassword;
          user.mustChangePassword = true;
          addNote(`Password reset and must change on next login`);
          extra.newPassword = newPassword;
          break;
        }
        case "forceLogout": {
          const token4 = Math.floor(1000 + Math.random() * 9000).toString();
          user.forceLogoutAt = new Date().toISOString();
          user.forceLogoutToken = token4;
          addNote(`Force logout triggered (token ${token4})`);
          break;
        }
        case "updateRole": {
          const allowedRoles = ["user", "admin", "superadmin"];
          const newRole = (payload.role || "").toLowerCase();
          if (!allowedRoles.includes(newRole)) {
            return res.status(400).json({ error: "Invalid role" });
          }
          user.role = newRole;
          addNote(`Role changed to ${newRole}`);
          break;
        }
        case "updateUiAccess": {
          const uiAccess = payload.uiAccess || null;
          user.uiAccess = uiAccess;
          addNote(`UI access set to ${uiAccess}`);
          break;
        }
        case "setStorageQuota": {
          const quota = Number(payload.storageQuotaTB);
          if (Number.isNaN(quota) || quota < 0) {
            return res.status(400).json({ error: "Invalid storage quota" });
          }
          user.storageQuotaTB = quota;
          addNote(`Storage quota set to ${quota} TB`);
          break;
        }
        case "adjustStorageQuota": {
          const adjustment = Number(payload.adjustmentTB);
          const newQuota = Number(payload.newQuotaTB);
          const reason = payload.reason || "Admin adjustment";

          if (Number.isNaN(adjustment) || Number.isNaN(newQuota)) {
            return res.status(400).json({ error: "Invalid adjustment values" });
          }

          if (newQuota < 0.1) {
            return res
              .status(400)
              .json({ error: "Quota must be at least 0.1 TB" });
          }

          const oldQuota = user.storageQuotaTB || 1;
          user.storageQuotaTB = newQuota;
          addNote(
            `Storage quota adjusted: ${oldQuota}TB → ${newQuota}TB (${adjustment > 0 ? "+" : ""}${adjustment}TB). Reason: ${reason}`,
          );
          break;
        }
        case "addNote": {
          if (!payload.note) {
            return res.status(400).json({ error: "Note is required" });
          }
          addNote(payload.note);
          break;
        }
        case "lockAccount": {
          user.locked = true;
          user.lockedAt = new Date().toISOString();
          user.lockReason = payload.reason || "Locked by admin";
          addNote(`Account locked: ${user.lockReason}`);
          break;
        }
        case "unlockAccount": {
          user.locked = false;
          user.lockReason = null;
          addNote("Account unlocked");
          break;
        }
        default:
          return res.status(400).json({ error: "Unsupported action" });
      }

      user.adminNotes = adminNotes;
      users[userIndex] = user;
      saveUsersSafe(users);

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 🛠 ${action} for ${email} by ${req.user.email}\n`,
      );

      aggregateAllUsersData();

      res.json({
        success: true,
        message: `Action ${action} applied`,
        user,
        extra,
      });
    } catch (error) {
      console.error("Error performing user admin action:", error);
      res
        .status(500)
        .json({ error: "Failed to perform action", details: error.message });
    }
  });

  app.put("/api/admin/update-purchase", verifyToken, isAdmin, (req, res) => {
    try {
      const { transactionId, updatedData } = req.body;
      if (!transactionId || !updatedData) {
        return res
          .status(400)
          .json({ error: "Transaction ID and updated data are required" });
      }

      let purchases = getPurchasesSafe();
      const purchaseIndex = purchases.findIndex(
        (p) => p.transactionId === transactionId,
      );

      if (purchaseIndex === -1) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      purchases[purchaseIndex] = {
        ...purchases[purchaseIndex],
        ...updatedData,
      };
      savePurchasesSafe(purchases);

      res.json({
        success: true,
        message: "Purchase updated successfully",
        purchase: purchases[purchaseIndex],
      });
    } catch (error) {
      console.error("Error updating purchase:", error);
      res
        .status(500)
        .json({ error: "Failed to update purchase", details: error.message });
    }
  });

  app.put("/api/admin/update-proof", verifyToken, isAdmin, (req, res) => {
    try {
      const { transactionId, updatedData } = req.body;
      if (!transactionId || !updatedData) {
        return res
          .status(400)
          .json({ error: "Transaction ID and updated data are required" });
      }

      let proofs = getProofsSafe();
      const proofIndex = proofs.findIndex(
        (p) => p.transactionId === transactionId,
      );

      if (proofIndex === -1) {
        return res.status(404).json({ error: "Proof not found" });
      }

      proofs[proofIndex] = { ...proofs[proofIndex], ...updatedData };
      saveProofsSafe(proofs);

      res.json({
        success: true,
        message: "Proof updated successfully",
        proof: proofs[proofIndex],
      });
    } catch (error) {
      console.error("Error updating proof:", error);
      res
        .status(500)
        .json({ error: "Failed to update proof", details: error.message });
    }
  });

  // Toggle proof verification
  app.post(
    "/api/admin/toggle-proof-verification",
    verifyToken,
    isAdmin,
    async (req, res) => {
      try {
        const { email, proofId, verified } = req.body;
        if (!proofId || typeof verified !== "boolean") {
          return res
            .status(400)
            .json({ error: "ProofId and verified status are required" });
        }

        let proofs = getProofsSafe();

        // Find proof by _id or proofId, and optionally filter by email if provided
        const proofIndex = proofs.findIndex((p) => {
          const idMatches =
            p._id === proofId || p.id === proofId || p.proofId === proofId;
          const emailMatches =
            !email ||
            p.email === email ||
            p.userEmail === email ||
            p.self?.email === email;
          return idMatches && emailMatches;
        });

        if (proofIndex === -1) {
          return res.status(404).json({ error: "Proof not found" });
        }

        const proofEmail =
          proofs[proofIndex].email ||
          proofs[proofIndex].userEmail ||
          email ||
          "Unknown";
        const status = verified ? "approved" : "rejected";

        let coinDebitResult = null;
        if (verified && status === "approved") {
          const source = String(
            proofs[proofIndex]?.discountSource || "",
          ).toLowerCase();
          const alreadyDeducted =
            !!proofs[proofIndex]?.coinsDeductedAt ||
            !!proofs[proofIndex]?.coinsTransactionId;
          const rupeesFromCoinsField = Number(
            proofs[proofIndex]?.coinsDiscount || 0,
          );
          const discountRupees = Math.floor(
            rupeesFromCoinsField > 0
              ? rupeesFromCoinsField
              : Number(proofs[proofIndex]?.discount || 0),
          );
          const hasCoinsDiscount =
            source === "coins" || rupeesFromCoinsField > 0;

          if (hasCoinsDiscount && discountRupees > 0 && !alreadyDeducted) {
            let debitUid = proofs[proofIndex]?.uid || null;

            if (!debitUid) {
              const users = getUsersSafe();
              const targetEmail = normalizeEmail(proofEmail || "");
              const byEmail = users.find(
                (u) => normalizeEmail(u?.email || "") === targetEmail,
              );
              if (byEmail?.uid) {
                debitUid = byEmail.uid;
                proofs[proofIndex].uid = byEmail.uid;
              }
            }

            if (!debitUid) {
              return res.status(400).json({
                success: false,
                error:
                  "Cannot approve: user UID missing for cloud coins deduction.",
              });
            }

            const coinsToDebit = discountRupees * COINS_PER_RUPEE;
            coinDebitResult = debitUserCoins(
              debitUid,
              coinsToDebit,
              "Cloud Coins used for plan discount",
              {
                proofId: proofs[proofIndex]._id,
                plan: proofs[proofIndex].plan,
                rupeeDiscount: discountRupees,
                source: "admin-toggle-proof-verification",
              },
            );

            if (!coinDebitResult.success) {
              if (coinDebitResult.code === "insufficient_balance") {
                return res.status(400).json({
                  success: false,
                  error: `Cannot approve: user needs ${coinsToDebit} coins but has ${coinDebitResult.balance}.`,
                });
              }
              if (coinDebitResult.code === "wallet_not_found") {
                return res.status(400).json({
                  success: false,
                  error: "Cannot approve: user cloud coins wallet not found.",
                });
              }
              return res.status(400).json({
                success: false,
                error: "Cannot approve: cloud coins deduction failed.",
              });
            }
          }
        }

        proofs[proofIndex].verified = verified;
        proofs[proofIndex].status = status;
        proofs[proofIndex].verifiedAt = verified
          ? new Date().toISOString()
          : null;
        proofs[proofIndex].verifiedBy = verified ? req.user.email : null;
        if (coinDebitResult?.success) {
          proofs[proofIndex].coinsSpent = coinDebitResult.spent;
          proofs[proofIndex].coinsTransactionId = coinDebitResult.transactionId;
          proofs[proofIndex].coinsDeductedAt = coinDebitResult.timestamp;
          proofs[proofIndex].coinsBalanceAfter = coinDebitResult.balanceAfter;
        }

        saveProofsSafe(proofs);

        // If approved, activate the user's plan
        if (verified && status === "approved") {
          try {
            const users = getUsersSafe();
            let userIdx = users.findIndex(
              (u) => u.uid === proofs[proofIndex].uid,
            );
            if (userIdx === -1) {
              const proofEmail = (
                proofs[proofIndex].email ||
                proofs[proofIndex].userEmail ||
                ""
              ).toLowerCase();
              if (proofEmail) {
                userIdx = users.findIndex(
                  (u) => (u.email || "").toLowerCase() === proofEmail,
                );
                if (userIdx !== -1) {
                  const updatedUid = users[userIdx].uid;
                  proofs[proofIndex].uid = updatedUid;
                  saveProofsSafe(proofs);
                  console.log(
                    `✅ Proof UID updated via email match: ${updatedUid}`,
                  );
                }
              }
            }

            if (userIdx !== -1) {
              // Load PLANS from plan-price.json
              const PLANS = loadPlans();

              // Get plan details
              let selected = PLANS[proofs[proofIndex].plan];
              if (!selected) {
                const tb =
                  proofs[proofIndex].requestedStorageTB ||
                  proofs[proofIndex].storageTB ||
                  0;
                const duration = proofs[proofIndex].durationDays || 30;
                const label =
                  proofs[proofIndex].plan === "custom"
                    ? `Custom ${tb || ""} TB`
                    : proofs[proofIndex].plan || "Plan";
                selected = {
                  name: label.trim(),
                  storageTB: tb,
                  durationDays: duration,
                };
              }
              let userMutated = false;

              // Update user access level for ultra and platinum plans
              if (proofs[proofIndex].plan === "ultra") {
                users[userIdx].uiAccess = "ultra";
                userMutated = true;
              } else if (proofs[proofIndex].plan === "platinum") {
                users[userIdx].uiAccess = "platinum";
                userMutated = true;
              }

              // Create platinum token for premium plans (use current UID)
              if (
                proofs[proofIndex].plan === "platinum" ||
                proofs[proofIndex].plan === "ultra"
              ) {
                createPlatinumToken(
                  users[userIdx].uid,
                  proofs[proofIndex].plan,
                  users[userIdx]?.email || proofs[proofIndex].email || null,
                  null,
                  selected.durationMinutes
                    ? selected.durationMinutes / 1440
                    : selected.durationDays || 180,
                );
              }

              // Update or create purchase record
              try {
                let purchases = getPurchasesSafe();
                const purchaseIdx = purchases.findIndex(
                  (p) =>
                    p._id === proofs[proofIndex]._id ||
                    p.proofId === proofs[proofIndex]._id,
                );

                const allowExtend = !!proofs[proofIndex].extend;
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
                      proofId: proofs[proofIndex]._id,
                      transactionId: proofs[proofIndex]._id,
                      expiresAt: newExpiry,
                      notes: existing.notes || proofs[proofIndex].notes || "",
                      renewalAttempts: (existing.renewalAttempts || 0) + 1,
                      lastRenewalAttempt: new Date().toISOString(),
                      amount: proofs[proofIndex].amount,
                      amountDiscount: proofs[proofIndex].discount,
                      discountApplied: proofs[proofIndex].discountPercent,
                      finalAmount: proofs[proofIndex].finalAmount,
                    };
                  } else {
                    purchases[purchaseIdx].status = "completed";
                    purchases[purchaseIdx].activatedAt =
                      new Date().toISOString();
                    purchases[purchaseIdx].isActive = true;
                    purchases[purchaseIdx].proofId = proofs[proofIndex]._id;
                  }
                  savePurchasesSafe(purchases);
                  generatePlanActiveData();
                  // Trigger referral reward if this is a paid purchase
                  if (Number(proofs[proofIndex].finalAmount || 0) > 0) {
                    registerSuccessfulReferralPurchaseInAdmin(
                      proofs[proofIndex].uid,
                      {
                        plan: proofs[proofIndex].plan,
                        transactionId: proofs[proofIndex]._id,
                        source: "admin-proof-approval",
                      },
                    );
                  }
                } else {
                  // Create new purchase record
                  logPurchase(
                    users[userIdx],
                    proofs[proofIndex].plan,
                    proofs[proofIndex].amount,
                    proofs[proofIndex].discount,
                    proofs[proofIndex].discountPercent,
                    proofs[proofIndex].finalAmount,
                    proofs[proofIndex].method || "qr",
                    proofs[proofIndex]._id,
                    proofs[proofIndex]._id,
                    proofs[proofIndex].card?.last4 || null,
                    `${proofs[proofIndex].method === "card" ? "Card" : "QR/UPI"} payment proof approved - ${proofs[proofIndex].notes}`,
                    proofs[proofIndex].plan === "custom" ? selected : null,
                    { allowExtend },
                  );
                  // Trigger referral reward for new purchase
                  if (Number(proofs[proofIndex].finalAmount || 0) > 0) {
                    registerSuccessfulReferralPurchaseInAdmin(
                      proofs[proofIndex].uid,
                      {
                        plan: proofs[proofIndex].plan,
                        transactionId: proofs[proofIndex]._id,
                        source: "admin-proof-approval-new",
                      },
                    );
                  }
                }
              } catch (purchaseErr) {
                console.error(
                  "⚠️ Error updating purchase record:",
                  purchaseErr,
                );
              }

              // Save user mutations if any
              if (userMutated) {
                saveUsersSafe(users);
              }

              // Send activation email
              const durationLabel =
                selected.durationDays === 365
                  ? "1 Year"
                  : selected.durationMinutes
                    ? `${selected.durationMinutes} Minutes`
                    : `${selected.durationDays || 30} Days`;

              let platinumUILink = "";
              const isPremiumPlan =
                proofs[proofIndex].plan === "platinum" ||
                proofs[proofIndex].plan === "ultra";
              if (isPremiumPlan) {
                try {
                  const targetUid =
                    users[userIdx]?.uid || proofs[proofIndex].uid;
                  const tokenEntry = getTokenByUID(
                    targetUid,
                    proofs[proofIndex].plan,
                  );
                  if (tokenEntry && tokenEntry.token) {
                    // Dynamic plan detection
                    const targetPage =
                      proofs[proofIndex].plan === "ultra"
                        ? "ultra-upload.html"
                        : "platinum-ui-upload.html";
                    const planTitle =
                      proofs[proofIndex].plan === "ultra"
                        ? "Ultra"
                        : "Platinum";
                    const planColor =
                      proofs[proofIndex].plan === "ultra"
                        ? "#ff1493"
                        : "#00ffc8";
                    const planBg =
                      proofs[proofIndex].plan === "ultra"
                        ? "#2a001a"
                        : "#001f3f";
                    const gradientEnd =
                      proofs[proofIndex].plan === "ultra"
                        ? "#ff99ff"
                        : "#0099ff";

                    const baseUrl = MAIL_BASE_URL;
                    const platinumUrl = `${baseUrl}/${targetPage}?uid=${encodeURIComponent(
                      targetUid,
                    )}&token=${tokenEntry.token}`;

                    console.log(
                      `\n📧 ADMIN APPROVAL EMAIL - Plan: ${proofs[proofIndex].plan}`,
                    );
                    console.log(`   Target Page: ${targetPage}`);
                    console.log(`   Plan Title: ${planTitle}`);
                    console.log(`   Plan Color: ${planColor}\n`);

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
                      `✅ ${planTitle} access link included in email for ${proofs[proofIndex].uid}`,
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

              try {
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
                proofs[proofIndex].uid,
              );
            }
          } catch (userErr) {
            console.error("❌ Error updating user after approval:", userErr);
          }
        }

        // Regenerate aggregated data
        aggregateAllUsersData();

        fs.appendFileSync(
          flagsLog,
          `${new Date().toISOString()} | ${verified ? "✅" : "❌"} Proof ${proofId} ${verified ? "verified" : "unverified"} for ${proofEmail} by ${req.user.email}\n`,
        );

        res.json({
          success: true,
          message: `Proof ${verified ? "verified" : "unverified"} successfully`,
          proof: proofs[proofIndex],
        });
      } catch (error) {
        console.error("Error toggling proof verification:", error);
        res.status(500).json({
          error: "Failed to update proof verification",
          details: error.message,
        });
      }
    },
  );

  // Toggle purchase status
  app.post(
    "/api/admin/toggle-purchase-status",
    verifyToken,
    isAdmin,
    (req, res) => {
      try {
        const { email, recordId, isActive } = req.body;
        if (!email || !recordId || typeof isActive !== "boolean") {
          return res.status(400).json({
            error: "Email, recordId, and isActive status are required",
          });
        }

        const normalizedRecordId = String(recordId || "").trim();
        const sameId = (value) =>
          String(value || "").trim() === normalizedRecordId;
        const matchesPlanRecord = (plan) =>
          sameId(plan?.recordId) ||
          sameId(plan?._id) ||
          sameId(plan?.id) ||
          sameId(plan?.transaction?.transactionId) ||
          sameId(plan?.transaction?.upi_txn_id);
        const matchesPurchaseRecord = (purchase) =>
          sameId(purchase?._id) ||
          sameId(purchase?.recordId) ||
          sameId(purchase?.purchaseId) ||
          sameId(purchase?.transactionId) ||
          sameId(purchase?.upi_txn_id);

        let planActive = getPlanActiveSafe();
        const targetEmail = normalizeEmail(email);
        const userPlan = planActive.find(
          (p) =>
            normalizeEmail(p.email || "") === targetEmail ||
            (p.self && normalizeEmail(p.self.email || "") === targetEmail),
        );

        if (!userPlan) {
          return res.status(404).json({ error: "User plan not found" });
        }

        // Try to locate in plan-active first
        let purchaseIndex = userPlan.plans.findIndex((plan) =>
          matchesPlanRecord(plan),
        );

        // If missing in plan-active, attempt to rebuild from purchases.json
        if (purchaseIndex === -1) {
          try {
            const purchases = getPurchasesSafe();
            const purchase = purchases.find(
              (p) =>
                matchesPurchaseRecord(p) &&
                normalizeEmail(p.email || "") === targetEmail,
            );
            if (purchase) {
              const planDetails = {
                storage: purchase.storageTB || 0,
                storageTB: purchase.storageTB || 0,
                durationDays: purchase.durationDays || 30,
                maxUploadSize: "10GB",
                features: [],
              };
              const rebuilt = {
                plan: purchase.plan,
                planDisplay:
                  purchase.plan?.charAt(0).toUpperCase() +
                  purchase.plan?.slice(1) +
                  " Plan",
                planDetails,
                transaction: {
                  transactionId: purchase.transactionId || purchase._id,
                  paymentMethod: purchase.paymentMethod || "admin-manual",
                  currency: purchase.currency || "INR",
                  amount: purchase.amount || 0,
                  amountDiscount: purchase.amountDiscount || 0,
                  discountApplied: purchase.discountApplied || 0,
                  finalAmount: purchase.finalAmount || 0,
                  purchasedAt: purchase.purchasedAt || new Date().toISOString(),
                  activatedAt: purchase.activatedAt || new Date().toISOString(),
                  expiresAt: purchase.expiresAt || null,
                  status: purchase.status || "completed",
                  notes: purchase.notes || "",
                },
                status: {
                  isActive: purchase.isActive ?? isActive,
                  isBlocked: purchase.isBlocked || false,
                  blockedReason: purchase.blockedReason || null,
                  blockedAt: purchase.blockedAt || null,
                  planActive: purchase.isActive ?? isActive,
                },
                recordId: purchase._id || recordId,
                accessToken: purchase.accessToken || null,
              };
              userPlan.plans.push(rebuilt);
              purchaseIndex = userPlan.plans.length - 1;
            }
          } catch (err) {
            console.error(
              "❌ Failed to rebuild purchase from purchases.json:",
              err,
            );
          }
        }

        if (purchaseIndex === -1) {
          return res.status(404).json({ error: "Purchase not found" });
        }

        // Update all matching plan entries for this user in plan-active data.
        const matchedPlanIndices = [];
        userPlan.plans.forEach((plan, idx) => {
          if (matchesPlanRecord(plan)) matchedPlanIndices.push(idx);
        });
        if (!matchedPlanIndices.includes(purchaseIndex)) {
          matchedPlanIndices.push(purchaseIndex);
        }

        const affectedPlans = new Set();
        const affectedAccessTokens = new Set();
        matchedPlanIndices.forEach((idx) => {
          const planEntry = userPlan.plans[idx];
          if (!planEntry) return;
          planEntry.status = {
            ...(planEntry.status || {}),
            isActive,
            planActive: isActive,
            isBlocked: !isActive,
          };
          planEntry.isActive = isActive;
          planEntry.isBlocked = !isActive;
          if (planEntry.plan)
            affectedPlans.add(String(planEntry.plan).toLowerCase());
          if (planEntry.accessToken)
            affectedAccessTokens.add(planEntry.accessToken);
        });

        // Keep summary.currentPlan aligned with currently active entries.
        const activeEntries = userPlan.plans.filter(
          (plan) =>
            plan?.status?.isActive === true && plan?.status?.isBlocked !== true,
        );
        const pickTs = (plan) =>
          new Date(
            plan?.transaction?.activatedAt ||
              plan?.transaction?.purchasedAt ||
              0,
          ).getTime();
        const latestActive =
          activeEntries.sort((a, b) => pickTs(b) - pickTs(a))[0] || null;
        userPlan.summary = {
          ...(userPlan.summary || {}),
          currentPlan: latestActive?.plan || "free",
          lastUpdate: new Date().toISOString(),
        };

        savePlanActiveSafe(planActive);

        // Also persist to purchases.json for consistency
        try {
          const purchases = getPurchasesSafe();
          let purchasesUpdated = 0;
          purchases.forEach((purchase) => {
            const sameOwner =
              normalizeEmail(purchase.email || "") === targetEmail ||
              String(purchase.uid || "") ===
                String(userPlan.uid || userPlan.self?.uid || "");
            if (!sameOwner) return;
            if (!matchesPurchaseRecord(purchase)) return;

            purchase.isActive = isActive;
            purchase.isBlocked = !isActive;
            if (typeof purchase.status === "string") {
              purchase.status = isActive ? "completed" : "inactive";
            }
            purchase.accessToken =
              purchase.accessToken ||
              userPlan.plans[purchaseIndex].accessToken ||
              null;
            if (purchase.plan)
              affectedPlans.add(String(purchase.plan).toLowerCase());
            if (purchase.accessToken)
              affectedAccessTokens.add(purchase.accessToken);
            purchasesUpdated += 1;
          });

          if (purchasesUpdated > 0) {
            savePurchasesSafe(purchases);
          }
        } catch (err) {
          console.error(
            "❌ Failed to persist purchase status to purchases.json:",
            err,
          );
        }

        // Sync matching token active flags too.
        try {
          const tokenData = getTokensSafe();
          const tokenArr = Array.isArray(tokenData?.tokens)
            ? tokenData.tokens
            : [];
          let tokensUpdated = 0;
          tokenArr.forEach((token) => {
            const sameOwner =
              normalizeEmail(token.email || "") === targetEmail ||
              String(token.uid || "") ===
                String(userPlan.uid || userPlan.self?.uid || "");
            if (!sameOwner) return;

            const planMatch = affectedPlans.has(
              String(token.plan || "").toLowerCase(),
            );
            const tokenMatch = affectedAccessTokens.has(token.token);
            if (!planMatch && !tokenMatch) return;

            token.active = isActive;
            tokensUpdated += 1;
          });

          if (tokensUpdated > 0) {
            saveTokensSafe({ tokens: tokenArr });
          }
        } catch (err) {
          console.error("❌ Failed to persist token active status:", err);
        }

        // Regenerate aggregated data
        aggregateAllUsersData();

        fs.appendFileSync(
          flagsLog,
          `${new Date().toISOString()} | ${isActive ? "✅" : "🚫"} Purchase ${recordId} ${isActive ? "activated" : "deactivated"} for ${email} by ${req.user.email}\n`,
        );

        res.json({
          success: true,
          message: `Purchase ${isActive ? "activated" : "deactivated"} successfully`,
        });
      } catch (error) {
        console.error("Error toggling purchase status:", error);
        res.status(500).json({
          error: "Failed to update purchase status",
          details: error.message,
        });
      }
    },
  );

  // Delete user plan/purchase
  app.post("/api/admin/delete-user-plan", verifyToken, isAdmin, (req, res) => {
    try {
      const { email, recordId } = req.body;
      if (!email || !recordId) {
        return res
          .status(400)
          .json({ error: "Email and recordId are required" });
      }

      const targetEmail = normalizeEmail(email);
      const matchesRecord = (item, idSet) => {
        if (!item || typeof item !== "object") return false;
        const values = [
          item?.recordId,
          item?._id,
          item?.id,
          item?.purchaseId,
          item?.proofId,
          item?.transactionId,
          item?.upi_txn_id,
          item?.accessToken,
          item?.token,
          item?.transaction?.transactionId,
          item?.transaction?.proofId,
          item?.transaction?.id,
        ].filter(Boolean);
        return values.some((v) => idSet.has(String(v)));
      };

      const kundli = readKundli();
      const matchedUser = (kundli || []).find(
        (u) => normalizeEmail(u?.email || "") === targetEmail,
      );
      const uid = matchedUser?.uid || null;
      const idSet = new Set([String(recordId)]);
      const tokenSet = new Set();

      const belongsToTargetUser = (entry) => {
        if (!entry || typeof entry !== "object") return false;
        const emailMatch =
          normalizeEmail(entry?.email || "") === targetEmail ||
          normalizeEmail(entry?.userEmail || "") === targetEmail;
        const uidMatch =
          !!uid && String(entry?.uid || entry?.userUID || "") === String(uid);
        return emailMatch || uidMatch;
      };

      // First pass: collect all linked IDs/tokens from matching records globally.
      (kundli || []).forEach((u) => {
        [
          u?.purchases || [],
          u?.activePlans || [],
          u?.proofs || [],
          u?.paymentLogs || [],
          u?.tokens || [],
        ].forEach((arr) => {
          (arr || []).forEach((item) => {
            if (matchesRecord(item, idSet)) {
              [
                item?.purchaseId,
                item?.proofId,
                item?.transactionId,
                item?.id,
                item?._id,
                item?.recordId,
                item?.accessToken,
                item?.token,
                item?.upi_txn_id,
                item?.transaction?.transactionId,
                item?.transaction?.proofId,
                item?.transaction?.id,
              ]
                .filter(Boolean)
                .forEach((v) => idSet.add(String(v)));

              if (item?.accessToken) tokenSet.add(String(item.accessToken));
              if (item?.token) tokenSet.add(String(item.token));
            }
          });
        });
      });

      // Second pass: remove linked records across all relevant kundli entries.
      const cleanedKundli = (kundli || [])
        .map((u) => {
          const user = { ...(u || {}) };

          const shouldCleanThisEntry =
            belongsToTargetUser(user) ||
            [
              user?.purchases || [],
              user?.activePlans || [],
              user?.proofs || [],
              user?.paymentLogs || [],
              user?.tokens || [],
            ].some((arr) =>
              (arr || []).some((item) => matchesRecord(item, idSet)),
            );

          if (!shouldCleanThisEntry) return user;

          user.purchases = (user.purchases || []).filter(
            (p) => !matchesRecord(p, idSet),
          );
          user.activePlans = (user.activePlans || []).filter(
            (p) => !matchesRecord(p, idSet),
          );
          user.proofs = (user.proofs || []).filter(
            (p) => !matchesRecord(p, idSet),
          );
          user.paymentLogs = (user.paymentLogs || []).filter(
            (p) => !matchesRecord(p, idSet),
          );
          user.tokens = (user.tokens || []).filter(
            (t) =>
              !matchesRecord(t, idSet) &&
              !tokenSet.has(String(t?.token || t?.accessToken || "")),
          );

          return user;
        })
        .filter((u) => {
          // Prune ghost entries that have no identity and no data blocks.
          const hasIdentity = !!(u?.uid || u?.email || u?.username);
          const hasData =
            (u?.purchases || []).length > 0 ||
            (u?.activePlans || []).length > 0 ||
            (u?.proofs || []).length > 0 ||
            (u?.paymentLogs || []).length > 0 ||
            (u?.tokens || []).length > 0;
          return hasIdentity || hasData;
        });

      // Reset uiAccess for the affected user based on remaining active purchases.
      const targetIdx = cleanedKundli.findIndex(
        (u) =>
          normalizeEmail(u?.email || "") === targetEmail ||
          (uid && String(u?.uid || "") === String(uid)),
      );
      if (targetIdx !== -1) {
        const remaining = cleanedKundli[targetIdx];
        const now = Date.now();
        const activePurchases = (remaining.purchases || []).filter((p) => {
          if (!p.isActive) return false;
          if (p.expiresAt && new Date(p.expiresAt).getTime() < now)
            return false;
          return true;
        });
        const activeTokens = (remaining.tokens || []).filter((t) => {
          if (!t.active) return false;
          if (t.expiresAt && new Date(t.expiresAt).getTime() < now)
            return false;
          return true;
        });
        const allActive = [...activePurchases, ...activeTokens];
        let newUiAccess = null;
        if (allActive.some((p) => (p.plan || "").toLowerCase() === "ultra")) {
          newUiAccess = "ultra";
        } else if (
          allActive.some((p) => (p.plan || "").toLowerCase() === "platinum")
        ) {
          newUiAccess = "platinum";
        } else if (allActive.length > 0) {
          // Keep whatever the highest remaining plan is
          newUiAccess = allActive[0].plan || null;
        }
        cleanedKundli[targetIdx] = { ...remaining, uiAccess: newUiAccess };
      }

      writeKundli(cleanedKundli);

      // Also remove matching records from any other JSON under support/.
      const removeMatchingFromNode = (node) => {
        if (Array.isArray(node)) {
          return node
            .map((item) => removeMatchingFromNode(item))
            .filter((item) => item !== undefined);
        }
        if (!node || typeof node !== "object") return node;

        const emailHit =
          normalizeEmail(node.email || "") === targetEmail ||
          normalizeEmail(node.userEmail || "") === targetEmail ||
          normalizeEmail(node.uploadedBy || "") === targetEmail;
        const uidHit =
          !!uid && String(node.uid || node.userUID || "") === String(uid);
        const recordHit = matchesRecord(node, idSet);
        const tokenHit = tokenSet.has(
          String(node.token || node.accessToken || ""),
        );

        if (
          recordHit &&
          (emailHit || uidHit || (!("email" in node) && !("uid" in node)))
        ) {
          return undefined;
        }
        if (
          tokenHit &&
          (emailHit || uidHit || (!("email" in node) && !("uid" in node)))
        ) {
          return undefined;
        }

        const next = {};
        Object.entries(node).forEach(([k, v]) => {
          const cleaned = removeMatchingFromNode(v);
          if (cleaned !== undefined) next[k] = cleaned;
        });
        return next;
      };

      const walkJsonFiles = (dir) => {
        if (!fs.existsSync(dir)) return [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        return entries.flatMap((entry) => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) return walkJsonFiles(fullPath);
          return /\.json$/i.test(entry.name) ? [fullPath] : [];
        });
      };

      const jsonFiles = walkJsonFiles(supportDir);
      jsonFiles.forEach((filePath) => {
        try {
          const raw = fs.readFileSync(filePath, "utf8").trim();
          if (!raw) return;
          const parsed = JSON.parse(raw);
          const cleaned = removeMatchingFromNode(parsed);
          const finalData =
            cleaned === undefined ? (Array.isArray(parsed) ? [] : {}) : cleaned;
          if (JSON.stringify(parsed) !== JSON.stringify(finalData)) {
            fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
          }
        } catch (err) {
          console.error(`Failed to clean plan record from ${filePath}:`, err);
        }
      });

      aggregateAllUsersData();

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 🗑 Plan ${recordId} removed across JSON stores for ${email} by ${req.user.email}\n`,
      );

      res.json({ success: true, message: "Plan deleted from all JSON files" });
    } catch (error) {
      console.error("Error deleting user plan:", error);
      res
        .status(500)
        .json({ error: "Failed to delete plan", details: error.message });
    }
  });

  app.put("/api/admin/update-plan-active", verifyToken, isAdmin, (req, res) => {
    try {
      const { uid, updatedData } = req.body;
      if (!uid || !updatedData) {
        return res
          .status(400)
          .json({ error: "UID and updated data are required" });
      }

      let planActive = getPlanActiveSafe();
      const userIndex = planActive.findIndex((u) => u.self?.uid === uid);

      if (userIndex === -1) {
        return res.status(404).json({ error: "User plan not found" });
      }

      planActive[userIndex] = { ...planActive[userIndex], ...updatedData };
      savePlanActiveSafe(planActive);

      res.json({
        success: true,
        message: "Plan active updated successfully",
        data: planActive[userIndex],
      });
    } catch (error) {
      console.error("Error updating plan active:", error);
      res.status(500).json({
        error: "Failed to update plan active",
        details: error.message,
      });
    }
  });

  app.put("/api/admin/update-plan-price", verifyToken, isAdmin, (req, res) => {
    try {
      const { updatedData } = req.body;
      if (!updatedData) {
        return res.status(400).json({ error: "Updated data is required" });
      }

      fs.writeFileSync(planPriceFile, JSON.stringify(updatedData, null, 2));

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 📝 Plan pricing updated by ${req.user.email}\n`,
      );

      res.json({
        success: true,
        message: "Plan pricing updated successfully",
        data: updatedData,
      });
    } catch (error) {
      console.error("Error updating plan price:", error);
      res
        .status(500)
        .json({ error: "Failed to update plan price", details: error.message });
    }
  });

  app.delete("/api/admin/delete-user", verifyToken, isAdmin, (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const targetEmail = normalizeEmail(email);

      let users = getUsersSafe();
      const userIndex = users.findIndex(
        (u) => normalizeEmail(u.email || "") === targetEmail,
      );

      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      if (users[userIndex].role === "superadmin") {
        return res.status(403).json({ error: "Cannot delete super admin" });
      }

      const targetUser = users[userIndex] || {};
      const targetUID = targetUser.uid || null;
      const deletedUsersFile = path.join(supportDir, "deleted-users.json");

      const matchesUser = (obj) => {
        if (!obj || typeof obj !== "object") return false;
        const emailKeys = ["email", "userEmail", "uploadedBy", "targetEmail"];
        const uidKeys = ["uid", "userUID", "userId", "ownerUID"];

        const emailHit = emailKeys.some(
          (k) => normalizeEmail(obj?.[k] || "") === targetEmail,
        );
        const uidHit =
          !!targetUID &&
          uidKeys.some((k) => String(obj?.[k] || "") === String(targetUID));

        return emailHit || uidHit;
      };

      const stripUserFromValue = (value) => {
        if (Array.isArray(value)) {
          return value
            .map((item) => stripUserFromValue(item))
            .filter((item) => item !== undefined);
        }

        if (!value || typeof value !== "object") {
          return value;
        }

        if (matchesUser(value)) {
          return undefined;
        }

        const out = {};
        Object.entries(value).forEach(([k, v]) => {
          const next = stripUserFromValue(v);
          if (next !== undefined) {
            out[k] = next;
          }
        });
        return out;
      };

      const deepCleanJsonFile = (filePath) => {
        if (!fs.existsSync(filePath)) return false;
        const raw = fs.readFileSync(filePath, "utf8").trim();
        if (!raw) return false;

        let json;
        try {
          json = JSON.parse(raw);
        } catch (_) {
          return false;
        }

        const cleaned = stripUserFromValue(json);
        const finalPayload =
          cleaned === undefined ? (Array.isArray(json) ? [] : {}) : cleaned;

        const before = JSON.stringify(json);
        const after = JSON.stringify(finalPayload);
        if (before === after) return false;

        fs.writeFileSync(filePath, JSON.stringify(finalPayload, null, 2));
        return true;
      };

      users.splice(userIndex, 1);
      saveUsersSafe(users);

      // Persist deleted account marker so login/me can show explicit removal message.
      try {
        let deletedUsers = [];
        if (fs.existsSync(deletedUsersFile)) {
          const rawDeleted = fs.readFileSync(deletedUsersFile, "utf8").trim();
          if (rawDeleted) {
            const parsedDeleted = JSON.parse(rawDeleted);
            deletedUsers = Array.isArray(parsedDeleted) ? parsedDeleted : [];
          }
        }

        deletedUsers = deletedUsers.filter(
          (d) => normalizeEmail(d?.email || "") !== targetEmail,
        );
        deletedUsers.push({
          email: targetEmail,
          uid: targetUID,
          username: targetUser.username || null,
          deletedAt: new Date().toISOString(),
          deletedBy: req.user.email,
        });

        fs.writeFileSync(
          deletedUsersFile,
          JSON.stringify(deletedUsers, null, 2),
        );
      } catch (err) {
        console.error("Failed to persist deleted user marker:", err);
      }

      // Remove from plan-active.
      try {
        const planActive = getPlanActiveSafe();
        const filteredPlanActive = planActive.filter(
          (entry) =>
            normalizeEmail(entry?.email || "") !== targetEmail &&
            normalizeEmail(entry?.self?.email || "") !== targetEmail &&
            String(entry?.self?.uid || "") !== String(targetUID || ""),
        );
        savePlanActiveSafe(filteredPlanActive);
      } catch (err) {
        console.error("Failed to clean plan-active for deleted user:", err);
      }

      // Remove from purchases.
      try {
        const purchases = getPurchasesSafe();
        const filteredPurchases = purchases.filter(
          (p) =>
            normalizeEmail(p?.email || "") !== targetEmail &&
            String(p?.uid || "") !== String(targetUID || ""),
        );
        savePurchasesSafe(filteredPurchases);
      } catch (err) {
        console.error("Failed to clean purchases for deleted user:", err);
      }

      // Remove from proofs.
      try {
        const proofs = getProofsSafe();
        const filteredProofs = proofs.filter(
          (p) =>
            normalizeEmail(p?.email || "") !== targetEmail &&
            normalizeEmail(p?.userEmail || "") !== targetEmail &&
            String(p?.uid || "") !== String(targetUID || ""),
        );
        saveProofsSafe(filteredProofs);
      } catch (err) {
        console.error("Failed to clean proofs for deleted user:", err);
      }

      // Remove tokens for this user.
      try {
        const tokenData = getTokensSafe();
        if (!Array.isArray(tokenData.tokens)) tokenData.tokens = [];
        tokenData.tokens = tokenData.tokens.filter(
          (t) =>
            normalizeEmail(t?.email || "") !== targetEmail &&
            String(t?.uid || "") !== String(targetUID || ""),
        );
        saveTokensSafe(tokenData);
      } catch (err) {
        console.error("Failed to clean tokens for deleted user:", err);
      }

      // Deep-clean all JSON files under support directory.
      try {
        const walk = (dir) => {
          if (!fs.existsSync(dir)) return [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          return entries.flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(full);
            return /\.json$/i.test(entry.name) ? [full] : [];
          });
        };

        const supportJsonFiles = walk(supportDir);
        supportJsonFiles.forEach((filePath) => {
          try {
            deepCleanJsonFile(filePath);
          } catch (err) {
            console.error(`Failed to deep-clean file ${filePath}:`, err);
          }
        });
      } catch (err) {
        console.error("Failed to deep-clean support JSON files:", err);
      }

      // Refresh aggregate snapshot.
      aggregateAllUsersData();

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ❌ User ${email} deleted from all JSON stores by ${req.user.email}\n`,
      );

      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res
        .status(500)
        .json({ error: "Failed to delete user", details: error.message });
    }
  });

  app.delete("/api/admin/delete-purchase", verifyToken, isAdmin, (req, res) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
      }

      let purchases = getPurchasesSafe();
      const purchaseIndex = purchases.findIndex(
        (p) => p.transactionId === transactionId,
      );

      if (purchaseIndex === -1) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      purchases.splice(purchaseIndex, 1);
      savePurchasesSafe(purchases);

      res.json({ success: true, message: "Purchase deleted successfully" });
    } catch (error) {
      console.error("Error deleting purchase:", error);
      res
        .status(500)
        .json({ error: "Failed to delete purchase", details: error.message });
    }
  });

  app.delete("/api/admin/delete-proof", verifyToken, isAdmin, (req, res) => {
    try {
      const { transactionId, id, _id, upi_txn_id, proofId } = req.body;
      const idCandidates = [transactionId, id, _id, upi_txn_id, proofId].filter(
        Boolean,
      );

      if (!idCandidates.length) {
        return res
          .status(400)
          .json({ error: "Transaction or proof ID is required" });
      }

      let proofs = getProofsSafe();
      const proofIndex = proofs.findIndex((p) => {
        const candidates = [
          p.transactionId,
          p._id,
          p.id,
          p.upi_txn_id,
          p.proofId,
        ].filter(Boolean);
        return candidates.some((value) => idCandidates.includes(value));
      });

      if (proofIndex === -1) {
        return res.status(404).json({ error: "Proof not found" });
      }

      const targetProof = proofs[proofIndex];
      const targetUid = targetProof.uid || null;
      const targetEmail = normalizeEmail(
        targetProof.email || targetProof.userEmail || "",
      );
      const targetPlan = (targetProof.plan || "").toLowerCase();
      const proofIdCandidates = [
        targetProof._id,
        targetProof.id,
        targetProof.proofId,
        targetProof.transactionId,
        targetProof.upi_txn_id,
      ].filter(Boolean);

      proofs.splice(proofIndex, 1);
      saveProofsSafe(proofs);

      // Cascade: remove linked purchases so plan-active is updated as well
      let removedPurchasesCount = 0;
      try {
        const purchases = getPurchasesSafe();
        const linkedPurchases = purchases.filter((purchase) => {
          const sameUser =
            (targetUid && purchase.uid === targetUid) ||
            (targetEmail &&
              normalizeEmail(purchase.email || "") === targetEmail);
          if (!sameUser) return false;

          const purchaseIds = [
            purchase._id,
            purchase.id,
            purchase.recordId,
            purchase.proofId,
            purchase.transactionId,
          ].filter(Boolean);
          const idMatch = purchaseIds.some((value) =>
            proofIdCandidates.includes(value),
          );

          return idMatch;
        });

        removedPurchasesCount = linkedPurchases.length;
        if (linkedPurchases.length > 0) {
          const linkedIds = new Set(
            linkedPurchases.flatMap((purchase) =>
              [
                purchase._id,
                purchase.id,
                purchase.recordId,
                purchase.proofId,
                purchase.transactionId,
              ].filter(Boolean),
            ),
          );

          const remainingPurchases = purchases.filter((purchase) => {
            const purchaseIds = [
              purchase._id,
              purchase.id,
              purchase.recordId,
              purchase.proofId,
              purchase.transactionId,
            ].filter(Boolean);
            return !purchaseIds.some((value) => linkedIds.has(value));
          });

          savePurchasesSafe(remainingPurchases);

          // Remove linked premium tokens (if any)
          try {
            const tokenData = getTokensSafe();
            if (!Array.isArray(tokenData.tokens)) tokenData.tokens = [];

            const removedPlans = new Set(
              linkedPurchases
                .map((purchase) => (purchase.plan || "").toLowerCase())
                .filter((plan) => ["platinum", "ultra"].includes(plan)),
            );

            if (removedPlans.size > 0 && (targetUid || targetEmail)) {
              tokenData.tokens = tokenData.tokens.filter((token) => {
                const sameUser =
                  (targetUid && token.uid === targetUid) ||
                  (targetEmail &&
                    normalizeEmail(token.email || "") === targetEmail);
                const samePlan = removedPlans.has(
                  (token.plan || "").toLowerCase(),
                );
                return !(sameUser && samePlan);
              });
              saveTokensSafe(tokenData);
            }
          } catch (tokenErr) {
            console.error(
              "❌ Failed to cleanup tokens while deleting proof:",
              tokenErr,
            );
          }
        }
      } catch (purchaseErr) {
        console.error(
          "❌ Failed to cleanup purchases while deleting proof:",
          purchaseErr,
        );
      }

      // Rebuild plan-active from current purchases
      generatePlanActiveData();

      // Cleanup uiAccess for premium plans if user no longer has active premium purchase
      if (targetUid || targetEmail) {
        try {
          const users = getUsersSafe();
          const userIndex = users.findIndex(
            (user) =>
              (targetUid && user.uid === targetUid) ||
              (targetEmail && normalizeEmail(user.email || "") === targetEmail),
          );

          if (userIndex !== -1) {
            const user = users[userIndex];
            const userPurchases = getPurchasesSafe().filter((purchase) => {
              const sameUser =
                (user.uid && purchase.uid === user.uid) ||
                (user.email &&
                  normalizeEmail(purchase.email || "") ===
                    normalizeEmail(user.email || ""));
              return sameUser && purchase.isActive;
            });

            const hasUltra = userPurchases.some(
              (purchase) => (purchase.plan || "").toLowerCase() === "ultra",
            );
            const hasPlatinum = userPurchases.some(
              (purchase) => (purchase.plan || "").toLowerCase() === "platinum",
            );

            const previousUiAccess = (user.uiAccess || "").toLowerCase();
            if (["ultra", "platinum"].includes(previousUiAccess)) {
              const nextUiAccess = hasUltra
                ? "ultra"
                : hasPlatinum
                  ? "platinum"
                  : null;
              if ((nextUiAccess || null) !== (user.uiAccess || null)) {
                users[userIndex].uiAccess = nextUiAccess;
                saveUsersSafe(users);
              }
            }
          }
        } catch (userErr) {
          console.error(
            "❌ Failed to cleanup uiAccess while deleting proof:",
            userErr,
          );
        }
      }

      aggregateAllUsersData();

      res.json({
        success: true,
        message: "Proof and linked plan data deleted successfully",
        removedPurchases: removedPurchasesCount,
        plan: targetPlan || null,
      });
    } catch (error) {
      console.error("Error deleting proof:", error);
      res
        .status(500)
        .json({ error: "Failed to delete proof", details: error.message });
    }
  });

  app.get("/admin/users", verifyToken, isAdmin, (req, res) => {
    let users = getUsersSafe();
    res.json(users.map(({ password, ...rest }) => rest));
  });

  // Live all-users-data endpoint - fetches fresh data on demand
  app.get("/admin/all-users-data", verifyToken, isAdmin, (req, res) => {
    try {
      // Read all JSON files fresh
      const users = getUsersSafe();
      const files = JSON.parse(fs.readFileSync(filesMetaFile, "utf8") || "[]");
      const planActive = getPlanActiveSafe();
      const planPrice = JSON.parse(
        fs.readFileSync(planPriceFile, "utf8") || "{}",
      );

      // Payment files
      let proofs = [];
      let purchases = [];
      try {
        proofs = getProofsSafe();
      } catch (e) {
        console.warn(
          "Could not read proofs from USER-pay-kundli.JSON:",
          e.message,
        );
      }
      try {
        purchases = getPurchasesSafe();
      } catch (e) {
        console.warn(
          "Could not read purchases from USER-pay-kundli.JSON:",
          e.message,
        );
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
          feedbacks = JSON.parse(
            fs.readFileSync(feedbacksFile, "utf8") || "[]",
          );
        }
      } catch (e) {
        console.warn("Could not read feedbacks.json:", e.message);
      }

      // Tokens file
      let tokens = [];
      try {
        const tokensData = getTokensSafe();
        tokens = tokensData.tokens || [];
      } catch (e) {
        console.warn(
          "Could not read tokens from USER-pay-kundli.JSON:",
          e.message,
        );
      }

      // Aggregate data for each user on the spot
      const aggregatedData = users.map((user) => {
        const userEmail = user.email;
        const normalizedEmail = normalizeEmail(userEmail);

        // Include ALL user fields including password
        const fullUser = { ...user };

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

        // Find user's tokens
        const userTokens = tokens.filter((t) => {
          const tokenEmail = normalizeEmail(t.email || "");
          const tokenUid = t.uid || "";
          return tokenEmail === normalizedEmail || tokenUid === user.uid;
        });

        return {
          user: fullUser,
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
                fullPlanData: userPlan,
              }
            : {
                currentPlan: "free",
                planHistory: [],
                summary: {},
                fullPlanData: null,
              },
          payments: {
            proofs: userProofs,
            purchases: userPurchases,
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
            loginHistory: userLogins,
            signupHistory: userSignups,
          },
          feedbacks: userFeedbacks,
          tokens: userTokens,
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

      res.json({
        generatedAt: new Date().toISOString(),
        totalUsers: users.length,
        planPricing: planPrice,
        users: aggregatedData,
      });
    } catch (error) {
      console.error("Error fetching all-users-data:", error);
      res.status(500).json({ error: "Failed to fetch aggregated data" });
    }
  });

  app.post("/admin/block-user", verifyToken, isAdmin, (req, res) => {
    const { targetEmail, durationMinutes, durationHours } = req.body;
    const email = normalizeEmail(targetEmail);
    let users = getUsersSafe();
    const u = users.find((u) => u.email === email);

    if (!u) return res.status(404).json({ error: "User not found" });

    if (u.role === "superadmin") {
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ❌ Attempt to BLOCK Super Admin (${u.email}) by ${req.user.email}\n`,
      );
      return res
        .status(403)
        .json({ error: "❌ Super Admin cannot be blocked." });
    }

    if (
      u.role === "admin" &&
      req.user.email !== process.env.SUPER_ADMIN_EMAIL
    ) {
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ❌ ${req.user.email} tried to BLOCK another ADMIN (${u.email})\n`,
      );
      return res
        .status(403)
        .json({ error: "🚫 Only Owner can block other admins." });
    }

    if (
      (durationMinutes && durationMinutes > 0) ||
      (durationHours && durationHours > 0)
    ) {
      let durationMs = 0;
      if (durationMinutes) durationMs += durationMinutes * 60 * 1000;
      if (durationHours) durationMs += durationHours * 60 * 60 * 1000;

      const until = Date.now() + durationMs;
      u.blocked = true;
      u.blockUntil = until;
      u.blockedBy =
        req.user.email === process.env.SUPER_ADMIN_EMAIL ? "owner" : "admin";

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 🚫 ${u.email} TIMED BLOCK until ${new Date(until).toISOString()} by ${req.user.email}\n`,
      );

      saveUsersSafe(users);
      return res.json({
        message: `${u.email} is BLOCKED until ${new Date(until).toLocaleString()}`,
      });
    }

    u.blocked = !u.blocked;

    if (u.blocked) {
      u.blockUntil = null;
      u.blockedBy =
        req.user.email === process.env.SUPER_ADMIN_EMAIL ? "owner" : "admin";
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 🚫 ${u.email} was PERMANENTLY BLOCKED by ${req.user.email}\n`,
      );
    } else {
      delete u.blockUntil;
      delete u.blockedBy;
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ✅ ${u.email} was UNBLOCKED by ${req.user.email}\n`,
      );
    }

    saveUsersSafe(users);
    res.json({
      message: `${u.email} is now ${u.blocked ? "BLOCKED" : "ACTIVE"}`,
    });
  });

  app.get("/admin/stats", verifyToken, isAdmin, (req, res) => {
    try {
      let users = [];
      let filesMeta = [];

      // Safely read and parse users file
      users = getUsersSafe();

      // Safely read and parse files meta
      if (fs.existsSync(filesMetaFile)) {
        const filesData = fs.readFileSync(filesMetaFile, "utf8") || "[]";
        filesMeta = filesData.trim() ? JSON.parse(filesData) : [];
      }

      const totalUsers = users.length;
      const blockedUsers = users.filter((u) => u.blocked).length;
      const activeUsers = totalUsers - blockedUsers;
      const totalFiles = filesMeta.length;
      const totalStorage =
        (filesMeta.reduce((sum, f) => sum + f.bytes, 0) / 1024 / 1024).toFixed(
          2,
        ) + " MB";

      res.json({
        totalUsers,
        activeUsers,
        blockedUsers,
        totalFiles,
        totalStorage,
      });
    } catch (err) {
      console.error("Error getting admin stats:", err);
      res.status(500).json({ error: "Failed to retrieve statistics" });
    }
  });

  app.get("/admin/files", verifyToken, isAdmin, (req, res) => {
    try {
      let filesMeta = [];

      if (fs.existsSync(filesMetaFile)) {
        const filesData = fs.readFileSync(filesMetaFile, "utf8") || "[]";
        filesMeta = filesData.trim() ? JSON.parse(filesData) : [];
      }

      res.json(filesMeta);
    } catch (err) {
      console.error("Error getting admin files:", err);
      res.status(500).json({ error: "Failed to retrieve files" });
    }
  });

  app.post("/admin/delete-file", verifyToken, isAdmin, (req, res) => {
    const { filename, uploadedBy } = req.body;
    if (!filename || !uploadedBy) {
      return res.status(400).json({ error: "Missing filename or uploadedBy" });
    }

    let filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));
    const idx = filesMeta.findIndex(
      (f) => f.filename === filename && f.uploadedBy === uploadedBy,
    );
    if (idx === -1) return res.status(404).json({ error: "File not found" });

    const filePath = path.join(uploadsDir, uploadedBy, "files", filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    filesMeta.splice(idx, 1);
    fs.writeFileSync(filesMetaFile, JSON.stringify(filesMeta, null, 2));

    res.json({ message: "✅ File deleted" });
  });

  app.post("/admin/delete-user-files", verifyToken, isAdmin, (req, res) => {
    const targetEmail = normalizeEmail(req.body.targetEmail);
    if (!targetEmail) {
      return res.status(400).json({ error: "Missing targetEmail" });
    }

    const safeEmail = safeName(targetEmail);
    const userDir = path.join(uploadsDir, safeEmail, "files");

    let filesMeta = JSON.parse(fs.readFileSync(filesMetaFile, "utf8"));
    const beforeCount = filesMeta.length;
    filesMeta = filesMeta.filter((f) => f.uploadedBy !== safeEmail);
    fs.writeFileSync(filesMetaFile, JSON.stringify(filesMeta, null, 2));

    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }

    const deletedCount = beforeCount - filesMeta.length;
    res.json({
      message: `❌ Deleted ${deletedCount} file(s) of ${targetEmail}`,
    });
  });

  app.post("/admin/toggle-admin", verifyToken, isAdmin, (req, res) => {
    const { targetEmail, makeSuper, demoteSuper } = req.body;
    let users = getUsersSafe();
    const u = users.find((u) => u.email === targetEmail);

    if (!u) return res.status(404).json({ error: "User not found" });

    const DEFAULT_SUPER =
      process.env.SUPER_ADMIN_EMAIL || "owner@cloudspace.com";

    if (u.email === DEFAULT_SUPER) {
      return res
        .status(403)
        .json({ error: "❌ Default Super Admin cannot be modified." });
    }

    if (
      u.role === "superadmin" &&
      req.user.email !== DEFAULT_SUPER &&
      demoteSuper
    ) {
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ❌ ${req.user.email} tried to DEMOTE SUPERADMIN (${u.email})\n`,
      );
      return res.status(403).json({
        error: "🚫 Only Default Super Admin can demote Super Admins.",
      });
    }

    if (
      u.role === "admin" &&
      req.user.email !== DEFAULT_SUPER &&
      !makeSuper &&
      demoteSuper
    ) {
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ❌ ${req.user.email} tried to DEMOTE ADMIN (${u.email})\n`,
      );
      return res
        .status(403)
        .json({ error: "🚫 Only Super Admin can demote other admins." });
    }

    if (u.blocked) {
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ⚠️ Attempt to PROMOTE blocked user (${u.email}) by ${req.user.email}\n`,
      );
      return res
        .status(403)
        .json({ error: "🚫 Blocked users cannot be promoted. Unblock first." });
    }

    if (makeSuper) {
      if (req.user.email !== DEFAULT_SUPER) {
        return res.status(403).json({
          error:
            "🚫 Only Default Super Admin can promote users to Super Admin.",
        });
      }
      u.role = "superadmin";
    } else if (demoteSuper) {
      if (req.user.email !== DEFAULT_SUPER) {
        return res.status(403).json({
          error: "🚫 Only Default Super Admin can demote Super Admins.",
        });
      }
      if (u.role !== "superadmin") {
        return res.status(400).json({ error: "User is not a Super Admin." });
      }
      u.role = "admin";
    } else {
      u.role = u.role === "admin" ? "user" : "admin";
    }

    saveUsersSafe(users);

    fs.appendFileSync(
      flagsLog,
      `${new Date().toISOString()} | 🔼 ${u.email} role changed to ${u.role.toUpperCase()} by ${req.user.email}\n`,
    );

    res.json({ message: `${u.email} is now ${u.role.toUpperCase()}` });
  });

  const flagsLogs = path.join(logsDir, "flags.log");
  if (!fs.existsSync(flagsLogs)) fs.writeFileSync(flagsLogs, "");

  app.get("/admin/logs", verifyToken, isAdmin, (req, res) => {
    const resetLog = fs.readFileSync(resetRequestsLog, "utf8");
    const passLog = fs.readFileSync(passwordChangesLog, "utf8");
    const loginLog = fs.readFileSync(loginAttemptsLog, "utf8");
    const uploadLog = fs.readFileSync(uploadsLog, "utf8");
    const mailLogs = fs.readFileSync(mailLog, "utf8");
    const flagLogs = fs.readFileSync(flagsLog, "utf8");

    let passLogJson = [];
    if (fs.existsSync(passwordChangesJsonFile)) {
      passLogJson = JSON.parse(
        fs.readFileSync(passwordChangesJsonFile, "utf8"),
      );
    }

    res.json({
      resetLog,
      passLog,
      passLogJson,
      loginLog,
      uploadLog,
      mailLogs,
      flagLogs,
    });
  });

  app.post("/admin/send-mail", verifyToken, isAdmin, async (req, res) => {
    const { to, subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message required" });
    }

    let users = getUsersSafe();
    let recipients = [];

    if (!to || to === "all") {
      recipients = users.map((u) => u.email);
    } else if (to === "admins") {
      recipients = users.filter((u) => u.role === "admin").map((u) => u.email);
    } else if (to === "users") {
      recipients = users.filter((u) => u.role !== "admin").map((u) => u.email);
    } else if (to === "active") {
      recipients = users.filter((u) => !u.blocked).map((u) => u.email);
    } else if (to === "blocked") {
      recipients = users.filter((u) => u.blocked).map((u) => u.email);
    } else if (Array.isArray(to)) {
      recipients = users
        .filter((u) => to.includes(u.email))
        .map((u) => u.email);
    } else {
      const user = users.find((u) => u.email === to.trim());
      if (!user) return res.status(404).json({ error: "User not found" });
      recipients = [user.email];
    }

    if (!recipients.length) {
      return res.status(400).json({ error: "No recipients found" });
    }

    try {
      await sendStyledMail(
        recipients.join(","),
        subject,
        `
            <h2 style="color:#00ffcc;text-align:center;">📢 Cloud Space Notification</h2>
            <p style="font-size:15px;line-height:1.6;color:#ddd;">
                ${message.replace(/\n/g, "<br>")}
            </p>
            <hr style="border:none;border-top:1px solid #333;margin:20px 0;" />
            <p style="text-align:center;color:#888;font-size:12px;">
                🚀 Sent securely from <b>Cloud Space Admin Panel</b>
            </p>
            `,
      );

      fs.appendFileSync(
        mailLog,
        `${new Date().toISOString()} | Sent to: ${recipients.join(", ")} | Subject: ${subject}\n`,
      );

      res.json({ message: `✅ Mail sent to ${recipients.length} user(s)` });
    } catch (err) {
      console.error("❌ Mail error:", err);
      res.status(500).json({ error: "❌ Failed to send email" });
    }
  });

  app.post("/admin/auto-block", verifyToken, isAdmin, (req, res) => {
    let users = getUsersSafe();
    const now = Date.now();
    let blockedCount = 0;

    users.forEach((u) => {
      if (
        !u.verified &&
        new Date(u.created_at).getTime() < now - 10 * 60 * 1000
      ) {
        u.blocked = true;
        blockedCount++;
      }
    });

    saveUsersSafe(users);
    res.json({
      message: `🚫 ${blockedCount} users auto-blocked (older than 10 min).`,
    });
  });

  app.get("/api/support/reasons", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(supportFiles.reasons, "utf8")));
  });

  app.get("/api/support/priorities", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(supportFiles.priorities, "utf8")));
  });

  app.get("/api/support/socials", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(supportFiles.socials, "utf8")));
  });

  // 💰 GET ALL CLOUD COINS DATA
  app.get("/api/admin/coins", verifyToken, isAdmin, (req, res) => {
    try {
      const cloudCoinsFile = path.join(
        paths.supportDir,
        "coins",
        "cloud-coins.json",
      );
      let coins = [];

      if (fs.existsSync(cloudCoinsFile)) {
        const coinData = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
        coins = coinData.trim() ? JSON.parse(coinData) : [];
      }

      res.json(coins);
    } catch (err) {
      console.error("Error fetching coins:", err);
      res.status(500).json({ error: "Failed to fetch coins data" });
    }
  });

  // 💰 ADD OR DEDUCT COINS
  app.post("/api/admin/coins/adjust", verifyToken, isAdmin, (req, res) => {
    try {
      const { userUID, amount, reason } = req.body;
      const amountValue = Number(amount);

      const coinColors = {
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        magenta: "\x1b[35m",
        white: "\x1b[37m",
        red: "\x1b[31m",
        blue: "\x1b[34m",
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        dim: "\x1b[2m",
      };

      console.log(
        `\n${coinColors.bright}${coinColors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${coinColors.reset}`,
      );
      console.log(
        `${coinColors.bright}${coinColors.yellow}💰 ADMIN COINS ADJUSTMENT${coinColors.reset}`,
      );
      console.log(
        `${coinColors.bright}${coinColors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${coinColors.reset}\n`,
      );
      console.log(
        `${coinColors.cyan}👤 User UID:  ${coinColors.bright}${coinColors.white}${userUID}${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}💵 Amount:    ${amountValue >= 0 ? coinColors.green : coinColors.red}${coinColors.bright}${amountValue >= 0 ? "+" : ""}${amountValue}${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}📝 Reason:    ${coinColors.magenta}${reason || "No reason provided"}${coinColors.reset}`,
      );

      if (!userUID || amount === undefined || amount === null) {
        return res.status(400).json({ error: "userUID and amount required" });
      }

      if (!Number.isFinite(amountValue) || amountValue === 0) {
        return res
          .status(400)
          .json({ error: "amount must be a valid non-zero number" });
      }

      const cloudCoinsFile = path.join(
        paths.supportDir,
        "coins",
        "cloud-coins.json",
      );
      let coins = [];

      if (fs.existsSync(cloudCoinsFile)) {
        const coinData = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
        coins = coinData.trim() ? JSON.parse(coinData) : [];
      }

      console.log(
        `\n${coinColors.dim}${coinColors.cyan}📖 Loaded ${coinColors.bright}${coins.length}${coinColors.reset}${coinColors.dim}${coinColors.cyan} coin records${coinColors.reset}`,
      );
      console.log(
        `${coinColors.dim}${coinColors.cyan}📋 Available UIDs: ${coinColors.white}${coins.map((c) => c.userUID).join(", ") || "None"}${coinColors.reset}`,
      );

      let userCoins = coins.find((c) => c.userUID === userUID);

      if (!userCoins) {
        console.log(
          `\n${coinColors.yellow}⚠️  User coins not found for UID: ${coinColors.bright}${userUID}${coinColors.reset}`,
        );
        console.log(
          `${coinColors.cyan}🆕 Creating new coins entry...${coinColors.reset}`,
        );
        // Create new coins entry if doesn't exist
        userCoins = {
          userUID: userUID,
          email: "Unknown",
          username: "Unknown",
          balance: 0,
          createdAt: new Date().toISOString(),
          transactions: [],
        };
        coins.push(userCoins);
        console.log(
          `${coinColors.bright}${coinColors.green}✅ Created new coins entry for ${coinColors.white}${userUID}${coinColors.reset}`,
        );
      }

      const oldBalance = Number(userCoins.balance) || 0;
      userCoins.balance = oldBalance + amountValue;

      userCoins.transactions.push({
        id:
          "ADMIN-" + Math.random().toString(36).substring(2, 12).toUpperCase(),
        type: "admin_adjustment",
        amount: amountValue,
        reason: reason || "Admin adjustment",
        timestamp: new Date().toISOString(),
      });

      // Ensure directory exists
      const coinDir = path.dirname(cloudCoinsFile);
      if (!fs.existsSync(coinDir)) {
        fs.mkdirSync(coinDir, { recursive: true });
      }

      fs.writeFileSync(cloudCoinsFile, JSON.stringify(coins, null, 2));
      syncCoinsLedgerFromWallets(paths.supportDir, coins);

      console.log(
        `\n${coinColors.bright}${coinColors.green}✅ COINS ADJUSTMENT SUCCESSFUL${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}👤 User:        ${coinColors.white}${userUID}${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}📊 Old Balance: ${coinColors.yellow}${oldBalance} coins${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}📊 New Balance: ${coinColors.bright}${coinColors.green}${userCoins.balance} coins${coinColors.reset}`,
      );
      console.log(
        `${coinColors.cyan}💫 Change:      ${amountValue >= 0 ? coinColors.green + "+" : coinColors.red}${amountValue} coins${coinColors.reset}`,
      );
      console.log(
        `${coinColors.bright}${coinColors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${coinColors.reset}\n`,
      );

      res.json({
        success: true,
        message: `Coins adjusted: ${oldBalance} → ${userCoins.balance}`,
        oldBalance,
        newBalance: userCoins.balance,
        user: userCoins,
      });
    } catch (err) {
      console.error("Error adjusting coins:", err);
      res.status(500).json({ error: "Failed to adjust coins: " + err.message });
    }
  });

  app.get("/admin/json-files", verifyToken, isAdmin, (req, res) => {
    console.log("📄 /admin/json-files endpoint called");
    try {
      const jsonFiles = [];
      const searchDirs = [
        supportDir,
        path.join(supportDir, "payments"),
        path.join(supportDir, "logs"),
        path.join(supportDir, "data"),
      ];

      const walkDir = (dir) => {
        try {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir);
          files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (file.endsWith(".json")) {
              jsonFiles.push({
                name: file,
                path: filePath,
                relativePath: path.relative(paths.__dirname, filePath),
                size: stat.size,
                modified: stat.mtime,
              });
            } else if (stat.isDirectory() && !file.startsWith(".")) {
              walkDir(filePath);
            }
          });
        } catch (err) {
          console.error("Error walking directory:", dir, err);
        }
      };

      searchDirs.forEach(walkDir);
      res.json({ success: true, files: jsonFiles });
    } catch (err) {
      console.error("❌ Error listing JSON files:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/admin/json-file", verifyToken, isAdmin, (req, res) => {
    try {
      const { path: filePath } = req.query;
      if (!filePath)
        return res
          .status(400)
          .json({ success: false, message: "path required" });

      const resolvedPath = path.resolve(paths.__dirname, filePath);
      if (!resolvedPath.startsWith(paths.__dirname)) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
      if (!fs.existsSync(resolvedPath)) {
        return res
          .status(404)
          .json({ success: false, message: "File not found" });
      }
      if (!resolvedPath.endsWith(".json")) {
        return res
          .status(400)
          .json({ success: false, message: "Only JSON files allowed" });
      }

      const content = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(content);
      res.json({ success: true, content: parsed, filePath });
    } catch (err) {
      console.error("Error reading JSON file:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/admin/json-file", verifyToken, isAdmin, (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath || !content) {
        return res
          .status(400)
          .json({ success: false, message: "path and content required" });
      }

      const resolvedPath = path.resolve(paths.__dirname, filePath);
      if (!resolvedPath.startsWith(paths.__dirname)) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
      if (!resolvedPath.endsWith(".json")) {
        return res
          .status(400)
          .json({ success: false, message: "Only JSON files allowed" });
      }

      let parsed;
      if (typeof content === "string") {
        parsed = JSON.parse(content);
      } else {
        parsed = content;
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const backupPath = resolvedPath.replace(
        ".json",
        `.backup-${timestamp}.json`,
      );
      if (fs.existsSync(resolvedPath)) {
        fs.copyFileSync(resolvedPath, backupPath);
      }

      fs.writeFileSync(resolvedPath, JSON.stringify(parsed, null, 2));

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | 📝 JSON file edited by ${req.user.email}: ${filePath}\n`,
      );

      res.json({
        success: true,
        message: "File saved successfully",
        backupPath,
      });
    } catch (err) {
      console.error("Error saving JSON file:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ✅ JWT Verification Stats API
  app.get("/api/admin/verification-stats", verifyToken, isAdmin, (req, res) => {
    try {
      const stats = getVerificationStats();
      res.json({
        success: true,
        stats,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ✅ Get Recent Verification Attempts
  app.get(
    "/api/admin/verification-recent",
    verifyToken,
    isAdmin,
    (req, res) => {
      try {
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const recent = getRecentVerifications(limit);
        res.json({
          success: true,
          count: recent.length,
          verifications: recent,
        });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ✅ Clear Verification Store (Admin only)
  app.post(
    "/api/admin/verification-clear",
    verifyToken,
    isAdmin,
    (req, res) => {
      try {
        const cleared = clearVerificationStore();
        if (!cleared) {
          return res
            .status(500)
            .json({ success: false, error: "Failed to clear verification store file" });
        }
        res.json({ success: true, message: "Verification store cleared" });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );
}

export default registerAdminRoutes;
