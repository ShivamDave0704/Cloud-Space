import fs from "fs";
import path from "path";
import {
  cloudCoinsFile,
  friendsFile,
  loadJSON,
  requestsFile,
  sharesFile,
} from "./server-friends.js";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import { getUsersList } from "./utils/pay-kundli-manager.js";

export function registerAdminFriendsMonitoring(core) {
  const { app, helpers } = core;

  // Use verifyToken from core helpers
  const verifyToken = helpers.verifyToken;
  const normalizeEmail = (value) =>
    (value || "").toString().trim().toLowerCase();

  // 🛡️ VERIFY TOKEN & ADMIN MIDDLEWARE
  const verifyTokenAndAdmin = (req, res, next) => {
    // First verify token
    verifyToken(req, res, () => {
      // Then check admin role
      if (
        req.user &&
        (req.user.role === "admin" || req.user.role === "superadmin")
      ) {
        next();
      } else {
        res.status(403).json({ error: "Admin access required" });
      }
    });
  };

  // 📊 GET ALL FRIEND REQUESTS (Admin Dashboard)
  app.get(
    "/api/admin/friends/requests/all",
    verifyTokenAndAdmin,
    (req, res) => {
      try {
        const requests = loadJSON(requestsFile);
        const stats = {
          total: requests.length,
          pending: requests.filter((r) => r.status === "pending").length,
          accepted: requests.filter((r) => r.status === "accepted").length,
          rejected: requests.filter((r) => r.status === "rejected").length,
          requests: requests,
        };
        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // 👥 GET ALL FRIENDSHIPS (Admin Dashboard)
  app.get("/api/admin/friends/all", verifyTokenAndAdmin, (req, res) => {
    try {
      const friends = loadJSON(friendsFile);
      const stats = {
        totalFriendships: friends.length,
        active: friends.filter((f) => f.status === "active").length,
        removed: friends.filter((f) => f.status === "removed").length,
        friendships: friends,
      };
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 💰 GET CLOUD COINS SYSTEM STATS (Admin Dashboard)
  app.get("/api/admin/coins/stats", verifyTokenAndAdmin, (req, res) => {
    try {
      const coins = loadJSON(cloudCoinsFile);
      const users = getUsersList();
      const usersByUid = new Map(users.map((u) => [u.uid, u]));
      const usersByEmail = new Map(
        users.filter((u) => u.email).map((u) => [normalizeEmail(u.email), u]),
      );

      const normalizeCoin = (coin) => {
        const byUid = usersByUid.get(coin.userUID);
        const byEmail = coin.email
          ? usersByEmail.get(normalizeEmail(coin.email))
          : null;
        const user = byUid || byEmail || null;
        return {
          ...coin,
          userUID: coin.userUID || user?.uid || null,
          email: coin.email || user?.email || null,
          username:
            coin.username ||
            user?.username ||
            user?.name ||
            user?.email ||
            "Unknown",
          balance: Number(coin.balance) || 0,
          transactions: Array.isArray(coin.transactions)
            ? coin.transactions
            : [],
        };
      };

      const normalizedCoins = coins.map(normalizeCoin);
      const totalBalance = normalizedCoins.reduce(
        (sum, c) => sum + (c.balance || 0),
        0,
      );
      const totalTransactions = normalizedCoins.reduce(
        (sum, c) => sum + (c.transactions?.length || 0),
        0,
      );

      const stats = {
        totalUsers: normalizedCoins.length,
        totalCoinsInCirculation: totalBalance,
        totalTransactions: totalTransactions,
        topHolders: [...normalizedCoins]
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 10),
        allCoins: normalizedCoins,
      };

      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 🔗 GET FILE SHARING STATS (Admin Dashboard)
  app.get(
    "/api/admin/friends/shares/stats",
    verifyTokenAndAdmin,
    (req, res) => {
      try {
        const shares = loadJSON(sharesFile);

        const stats = {
          totalShares: shares.length,
          active: shares.filter((s) => s.status === "active").length,
          revoked: shares.filter((s) => s.status === "revoked").length,
          shares: shares,
        };

        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // ⚠️ ADMIN - CANCEL FRIEND REQUEST
  app.post(
    "/api/admin/friends/request/cancel",
    verifyTokenAndAdmin,
    (req, res) => {
      try {
        const { requestId, reason } = req.body;
        const requests = loadJSON(requestsFile);
        const request = requests.find((r) => r.id === requestId);

        if (!request) {
          return res.status(404).json({ error: "Request not found" });
        }

        request.status = "cancelled_by_admin";
        request.cancelledAt = new Date().toISOString();
        request.adminReason = reason || "No reason provided";

        fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));

        res.json({
          success: true,
          message: "Request cancelled by admin",
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // ⚠️ ADMIN - REVOKE FRIENDSHIP
  app.post("/api/admin/friends/revoke", verifyTokenAndAdmin, (req, res) => {
    try {
      const { friendshipId, reason } = req.body;
      const friends = loadJSON(friendsFile);
      const friendship = friends.find((f) => f.id === friendshipId);

      if (!friendship) {
        return res.status(404).json({ error: "Friendship not found" });
      }

      friendship.status = "revoked_by_admin";
      friendship.revokedAt = new Date().toISOString();
      friendship.adminReason = reason || "Violates community guidelines";

      fs.writeFileSync(friendsFile, JSON.stringify(friends, null, 2));

      res.json({
        success: true,
        message: "Friendship revoked by admin",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 💸 ADMIN - ADJUST USER CLOUD COINS
  app.post("/api/admin/coins/adjust", verifyTokenAndAdmin, (req, res) => {
    try {
      const { userUID, amount, reason } = req.body;
      const coins = loadJSON(cloudCoinsFile);
      const users = getUsersList();
      const user = users.find((u) => u.uid === userUID) || null;
      const amountValue = Number(amount);

      if (!userUID) {
        return res.status(400).json({ error: "userUID is required" });
      }

      if (Number.isNaN(amountValue)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      if (!Number.isFinite(amountValue) || amountValue === 0) {
        return res
          .status(400)
          .json({ error: "Amount must be a valid non-zero number" });
      }

      let userCoins = coins.find((c) => c.userUID === userUID);
      if (!userCoins) {
        userCoins = {
          userUID,
          email: user?.email || null,
          username: user?.username || user?.name || user?.email || "Unknown",
          balance: 0,
          transactions: [],
        };
        coins.push(userCoins);
      }

      if (user && !userCoins.email)
        userCoins.email = user.email || userCoins.email;
      if (user && !userCoins.username)
        userCoins.username =
          user.username || user.name || user.email || userCoins.username;
      if (!Array.isArray(userCoins.transactions)) userCoins.transactions = [];
      userCoins.balance = Number(userCoins.balance) || 0;

      const oldBalance = userCoins.balance;
      userCoins.balance += amountValue;

      userCoins.transactions.push({
        id: "ADM-" + Math.random().toString(36).substring(2, 12).toUpperCase(),
        type: "admin_adjustment",
        amount: amountValue,
        reason: reason || "Admin adjustment",
        timestamp: new Date().toISOString(),
      });

      fs.writeFileSync(cloudCoinsFile, JSON.stringify(coins, null, 2));
      syncCoinsLedgerFromWallets(
        path.join(path.dirname(cloudCoinsFile), ".."),
        coins,
      );

      res.json({
        success: true,
        message: "Coins adjusted",
        oldBalance,
        newBalance: userCoins.balance,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 🔍 ADMIN - SEARCH USER ACTIVITY
  app.get(
    "/api/admin/friends/user/:userUID/activity",
    verifyTokenAndAdmin,
    (req, res) => {
      try {
        const { userUID } = req.params;
        const requests = loadJSON(requestsFile);
        const friends = loadJSON(friendsFile);
        const coins = loadJSON(cloudCoinsFile);
        const shares = loadJSON(sharesFile);
        const users = getUsersList();
        const user = users.find((u) => u.uid === userUID) || null;

        const byUid = coins.find((c) => c.userUID === userUID);
        const byEmail = user?.email
          ? coins.find(
              (c) => normalizeEmail(c.email) === normalizeEmail(user.email),
            )
          : null;
        const coinBalance = byUid ||
          byEmail || {
            userUID,
            email: user?.email || null,
            username: user?.username || user?.name || user?.email || "Unknown",
            balance: 0,
            transactions: [],
          };

        if (!Array.isArray(coinBalance.transactions))
          coinBalance.transactions = [];
        if (!coinBalance.username && user)
          coinBalance.username =
            user.username || user.name || user.email || "Unknown";
        if (!coinBalance.email && user) coinBalance.email = user.email || null;

        const activity = {
          sentRequests: requests.filter((r) => r.senderUID === userUID),
          receivedRequests: requests.filter(
            (r) =>
              r.receiverEmail &&
              requests.some((rq) => rq.id === r.id && rq.senderUID !== userUID),
          ),
          friendships: friends.filter(
            (f) => f.user1UID === userUID || f.user2UID === userUID,
          ),
          coinBalance: coinBalance,
          fileShares: shares.filter(
            (s) => s.senderUID === userUID || s.recipientUID === userUID,
          ),
        };

        res.json(activity);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // 📈 ADMIN - SYSTEM OVERVIEW
  app.get(
    "/api/admin/friends/system-overview",
    verifyTokenAndAdmin,
    (req, res) => {
      try {
        const requests = loadJSON(requestsFile);
        const friends = loadJSON(friendsFile);
        const coins = loadJSON(cloudCoinsFile);
        const shares = loadJSON(sharesFile);

        const overview = {
          friendRequests: {
            total: requests.length,
            pending: requests.filter((r) => r.status === "pending").length,
            accepted: requests.filter((r) => r.status === "accepted").length,
            rejected: requests.filter((r) => r.status === "rejected").length,
            recentRequests: requests.slice(-5),
          },
          friendships: {
            total: friends.length,
            active: friends.filter((f) => f.status === "active").length,
            recentFriendships: friends.slice(-5),
          },
          cloudCoins: {
            totalUsers: coins.length,
            totalCoinsInCirculation: coins.reduce(
              (sum, c) => sum + (c.balance || 0),
              0,
            ),
            totalTransactions: coins.reduce(
              (sum, c) => sum + (c.transactions?.length || 0),
              0,
            ),
          },
          fileSharing: {
            total: shares.length,
            active: shares.filter((s) => s.status === "active").length,
          },
          timestamp: new Date().toISOString(),
        };

        res.json(overview);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}
