import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import { logFriendRequestDebug } from "./utils/cool-logger.js";
import { getUsersList } from "./utils/pay-kundli-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Data files
const supportDir = path.join(__dirname, "support");
const friendsDir = path.join(supportDir, "friends");
const coinsDir = path.join(supportDir, "coins");
const requestsFile = path.join(friendsDir, "requests.json");
const friendsFile = path.join(friendsDir, "friends.json");
const sharesFile = path.join(friendsDir, "shares.json");
const messagesFile = path.join(friendsDir, "messages.json");
const cloudCoinsFile = path.join(coinsDir, "cloud-coins.json");
const filesMetaFile = path.join(supportDir, "files.json");

// Ensure directories exist
[friendsDir, coinsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper functions
function loadJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "[]");
      return [];
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  if (path.resolve(file) === path.resolve(cloudCoinsFile)) {
    syncCoinsLedgerFromWallets(supportDir, data);
  }
}
function generateId() {
  return "FR-" + Math.random().toString(36).substring(2, 12).toUpperCase();
}

// ==================== FRIEND REQUEST ROUTES ====================
function registerFriendRoutes(core) {
  const { app, helpers } = core;
  const verifyToken =
    helpers && helpers.verifyToken ? helpers.verifyToken : null;
  const normalizeEmail =
    helpers && helpers.normalizeEmail ? helpers.normalizeEmail : (e) => e;

  // Send friend request
  app.post(
    "/api/friends/request/send",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { targetUID } = req.body;
        const senderUID = req.user?.uid;
        const senderEmail = req.user?.email;
        const senderUsername = req.user?.username;

        logFriendRequestDebug(targetUID, senderUID, senderEmail, !!req.user);

        if (!targetUID || !senderUID) {
          return res
            .status(400)
            .json({ error: "Target UID and authentication required" });
        }

        if (targetUID === senderUID) {
          return res
            .status(400)
            .json({ error: "Cannot send request to yourself" });
        }

        // Load users to find receiver email by UID
        const users = getUsersList();
        const targetUser = users.find((u) => u.uid === targetUID);

        if (!targetUser) {
          return res.status(404).json({ error: "User not found" });
        }

        const receiverEmail = normalizeEmail(targetUser.email);

        const requests = loadJSON(requestsFile);
        const friends = loadJSON(friendsFile);

        // Prevent duplicate requests
        if (
          requests.some(
            (r) =>
              normalizeEmail(r.senderEmail) === normalizeEmail(senderEmail) &&
              normalizeEmail(r.receiverEmail) === receiverEmail &&
              r.status === "pending",
          )
        ) {
          return res.status(400).json({ error: "Request already sent" });
        }

        // Prevent if already friends
        if (
          friends.some(
            (f) =>
              ((f.user1UID === senderUID && f.user2UID === targetUID) ||
                (f.user2UID === senderUID && f.user1UID === targetUID)) &&
              f.status === "active",
          )
        ) {
          return res.status(400).json({ error: "Already friends" });
        }

        const newRequest = {
          id: generateId(),
          senderUID,
          senderEmail,
          senderUsername,
          receiverUID: targetUID,
          receiverEmail,
          receiverUsername: targetUser.username,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        requests.push(newRequest);
        saveJSON(requestsFile, requests);
        res.json({ success: true, request: newRequest });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Get pending requests
  app.get(
    "/api/friends/requests/pending",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user.uid;
        const requests = loadJSON(requestsFile);
        const pending = requests.filter(
          (r) => r.receiverUID === userUID && r.status === "pending",
        );
        res.json(pending);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Accept friend request
  app.post(
    "/api/friends/request/accept",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { requestId } = req.body;
        const userUID = req.user.uid;
        const userEmail = req.user.email;
        const requests = loadJSON(requestsFile);
        const friends = loadJSON(friendsFile);
        const reqIndex = requests.findIndex(
          (r) =>
            r.id === requestId &&
            r.receiverUID === userUID &&
            r.status === "pending",
        );
        if (reqIndex === -1) {
          return res.status(404).json({ error: "Request not found" });
        }
        const request = requests[reqIndex];
        // Create friendship
        const newFriendship = {
          id: generateId(),
          user1UID: request.senderUID,
          user1Email: request.senderEmail,
          user1Username: request.senderUsername,
          user2UID: userUID,
          user2Email: userEmail,
          user2Username: req.user.username,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        friends.push(newFriendship);
        // Mark request as accepted
        requests[reqIndex].status = "accepted";
        saveJSON(friendsFile, friends);
        saveJSON(requestsFile, requests);
        res.json({ success: true, friendship: newFriendship });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Reject friend request
  app.post(
    "/api/friends/request/reject",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { requestId } = req.body;
        const userUID = req.user.uid;
        const requests = loadJSON(requestsFile);
        const reqIndex = requests.findIndex(
          (r) =>
            r.id === requestId &&
            r.receiverUID === userUID &&
            r.status === "pending",
        );
        if (reqIndex === -1) {
          return res.status(404).json({ error: "Request not found" });
        }
        requests[reqIndex].status = "rejected";
        saveJSON(requestsFile, requests);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Get friend list
  app.get(
    "/api/friends/list",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user.uid;
        const friends = loadJSON(friendsFile);
        const myFriends = friends.filter(
          (f) =>
            (f.user1UID === userUID || f.user2UID === userUID) &&
            f.status === "active",
        );
        res.json(myFriends);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Remove friend
  app.post(
    "/api/friends/remove",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { friendshipId } = req.body;
        const userUID = req.user.uid;
        const friends = loadJSON(friendsFile);
        const friendship = friends.find((f) => f.id === friendshipId);
        if (!friendship) {
          return res.status(404).json({ error: "Friendship not found" });
        }
        if (
          friendship.user1UID !== userUID &&
          friendship.user2UID !== userUID
        ) {
          return res.status(403).json({ error: "Not authorized" });
        }
        friendship.status = "removed";
        friendship.removedAt = new Date().toISOString();
        saveJSON(friendsFile, friends);
        res.json({ success: true, message: "Friend removed" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Update friend nickname
  app.post(
    "/api/friends/update-nickname",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { friendshipId, nickname } = req.body;
        const userUID = req.user.uid;
        const friends = loadJSON(friendsFile);
        const friendship = friends.find((f) => f.id === friendshipId);

        if (!friendship) {
          return res.status(404).json({ error: "Friendship not found" });
        }

        if (
          friendship.user1UID !== userUID &&
          friendship.user2UID !== userUID
        ) {
          return res.status(403).json({ error: "Not authorized" });
        }

        // Validate nickname length
        if (nickname && nickname.trim().length > 50) {
          return res
            .status(400)
            .json({ error: "Nickname too long (max 50 characters)" });
        }

        // Determine which field to update based on user
        const isUser1 = friendship.user1UID === userUID;
        const trimmedNickname = nickname ? nickname.trim() : null;

        if (isUser1) {
          friendship.bondname = trimmedNickname;
        } else {
          friendship.bondname = trimmedNickname;
        }

        // Update the friendship with timestamp
        friendship.updatedAt = new Date().toISOString();

        saveJSON(friendsFile, friends);
        console.log("✅ Bondname updated:", {
          friendshipId,
          bondname: trimmedNickname,
        });
        res.json({ success: true, message: "Nickname updated", friendship });
      } catch (err) {
        console.error("❌ Error updating bondname:", err);
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// ==================== CLOUD COIN ROUTES ====================
function registerCloudCoinRoutes(core) {
  const { app, helpers, config } = core;
  const verifyToken =
    helpers && helpers.verifyToken ? helpers.verifyToken : null;
  const normalizeEmail =
    helpers && helpers.normalizeEmail ? helpers.normalizeEmail : (e) => e;

  // Optional token verification - doesn't fail if auth is missing
  const optionalAuth = (req, res, next) => {
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

    if (token) {
      try {
        const JWT_SECRET =
          config.JWT_SECRET || process.env.JWT_SECRET || "supersecretkey";
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
      } catch (err) {
        // Token invalid or expired, but we continue without user
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  };

  // Get coin balance
  app.get("/api/coins/balance", optionalAuth, (req, res) => {
    try {
      // If no authenticated user, return 0 balance
      if (!req.user || !req.user.uid) {
        return res.json({ balance: 0 });
      }

      const userUID = req.user.uid;
      const userEmail = req.user.email;
      const normalizedEmail = userEmail ? normalizeEmail(userEmail) : null;
      const coins = loadJSON(cloudCoinsFile);
      let userCoins = coins.find((c) => c.userUID === userUID);
      if (!userCoins && normalizedEmail) {
        userCoins = coins.find(
          (c) => normalizeEmail(c.email) === normalizedEmail,
        );
      }
      if (!userCoins) {
        userCoins = {
          userUID: userUID,
          email: userEmail,
          username: req.user.username || "Unknown",
          balance: 0,
          createdAt: new Date().toISOString(),
          transactions: [],
        };
        coins.push(userCoins);
      } else {
        if (userUID && userCoins.userUID !== userUID)
          userCoins.userUID = userUID;
        if (userEmail && userCoins.email !== userEmail)
          userCoins.email = userEmail;
        if (req.user.username && userCoins.username !== req.user.username)
          userCoins.username = req.user.username;
      }
      saveJSON(cloudCoinsFile, coins);
      res.json(userCoins);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send coins to friend
  app.post(
    "/api/coins/send",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { recipientUID, amount } = req.body;
        const senderUID = req.user.uid;
        if (!recipientUID || !amount || isNaN(amount) || amount <= 0) {
          return res
            .status(400)
            .json({ error: "Recipient and valid amount required" });
        }
        const coins = loadJSON(cloudCoinsFile);
        let sender = coins.find((c) => c.userUID === senderUID);
        let recipient = coins.find((c) => c.userUID === recipientUID);
        if (!sender || sender.balance < amount) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
        if (!recipient) {
          recipient = {
            userUID: recipientUID,
            balance: 0,
            transactions: [],
          };
          coins.push(recipient);
        }
        sender.balance -= amount;
        recipient.balance += amount;
        const tx = {
          id: generateId(),
          from: senderUID,
          to: recipientUID,
          amount,
          type: "transfer",
          createdAt: new Date().toISOString(),
        };
        sender.transactions = sender.transactions || [];
        recipient.transactions = recipient.transactions || [];
        sender.transactions.push({ ...tx, amount: -amount });
        recipient.transactions.push({ ...tx });
        saveJSON(cloudCoinsFile, coins);
        res.json({ success: true, transaction: tx });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Get transaction history
  app.get(
    "/api/coins/transactions",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user.uid;
        const coins = loadJSON(cloudCoinsFile);
        const userCoins = coins.find((c) => c.userUID === userUID);
        const transactions = userCoins ? userCoins.transactions : [];
        res.json(transactions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// ==================== FRIEND SHARE ROUTES ====================
function registerFriendShareRoutes(core) {
  const { app, helpers } = core;
  const verifyToken =
    helpers && helpers.verifyToken ? helpers.verifyToken : null;

  // Share file with friend
  app.post(
    "/api/friends/share",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { fileId, friendUID } = req.body;
        const senderUID = req.user.uid;
        const senderEmail = req.user.email;
        const shares = loadJSON(sharesFile);
        const friends = loadJSON(friendsFile);
        if (!fileId || !friendUID) {
          return res
            .status(400)
            .json({ error: "File ID and friend UID required" });
        }
        // Check if friends
        const isFriend = friends.some(
          (f) =>
            (f.user1UID === senderUID &&
              f.user2UID === friendUID &&
              f.status === "active") ||
            (f.user2UID === senderUID &&
              f.user1UID === friendUID &&
              f.status === "active"),
        );
        if (!isFriend) {
          return res.status(400).json({ error: "Not friends" });
        }

        const filesMeta = loadJSON(filesMetaFile);
        const file = filesMeta.find(
          (f) =>
            f.filename === fileId ||
            f.secure_url === fileId ||
            f.originalname === fileId,
        );

        if (!file) {
          return res.status(404).json({ error: "File not found" });
        }

        const isOwner =
          (file.uploadedBy && file.uploadedBy === senderEmail) ||
          (file.ownerEmail && file.ownerEmail === senderEmail) ||
          (file.ownerUid && file.ownerUid === senderUID);

        if (!isOwner) {
          return res
            .status(403)
            .json({ error: "You can only share your own files" });
        }

        const newShare = {
          id:
            "SHARE-" +
            Math.random().toString(36).substring(2, 12).toUpperCase(),
          fileId: file.filename,
          fileName: file.originalname || file.filename,
          fileSize: file.bytes || file.size || null,
          fileType: file.fileType || file.format || null,
          fileUrl: file.secure_url || null,
          senderUID: senderUID,
          recipientUID: friendUID,
          status: "active",
          sharedAt: new Date().toISOString(),
        };
        shares.push(newShare);
        saveJSON(sharesFile, shares);
        res.json({ success: true, message: "File shared", share: newShare });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Get shared files
  app.get(
    "/api/friends/shared-files",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user.uid;
        const shares = loadJSON(sharesFile);
        const filesMeta = loadJSON(filesMetaFile);

        const sharedWithMe = shares
          .filter((s) => s.recipientUID === userUID && s.status === "active")
          .map((s) => {
            if (s.fileName || s.fileSize || s.fileUrl) return s;
            const file = filesMeta.find(
              (f) =>
                f.filename === s.fileId ||
                f.secure_url === s.fileId ||
                f.originalname === s.fileId,
            );
            if (!file) return s;
            return {
              ...s,
              fileId: s.fileId || file.filename,
              fileName: s.fileName || file.originalname || file.filename,
              fileSize: s.fileSize || file.bytes || file.size || null,
              fileType: s.fileType || file.fileType || file.format || null,
              fileUrl: s.fileUrl || file.secure_url || null,
            };
          });

        res.json(sharedWithMe);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Revoke file share
  app.post(
    "/api/friends/share/revoke",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const { shareId } = req.body;
        const userUID = req.user.uid;
        const shares = loadJSON(sharesFile);
        const share = shares.find((s) => s.id === shareId);
        if (!share) {
          return res.status(404).json({ error: "Share not found" });
        }
        if (share.senderUID !== userUID) {
          return res.status(403).json({ error: "Not authorized" });
        }
        share.status = "revoked";
        share.revokedAt = new Date().toISOString();
        saveJSON(sharesFile, shares);
        res.json({ success: true, message: "Share revoked" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// ==================== FRIEND CHAT ROUTES ====================
function registerChatRoutes(core) {
  const { app, helpers } = core;
  const verifyToken =
    helpers && helpers.verifyToken ? helpers.verifyToken : null;

  // Get chat messages with a friend
  app.get(
    "/api/friends/chat/:friendUID",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user?.uid;
        const { friendUID } = req.params;

        if (!userUID || !friendUID) {
          return res.status(400).json({ error: "User not authenticated" });
        }

        const messages = loadJSON(messagesFile);
        // Get all messages between these two users (both directions)
        const chatMessages = messages.filter(
          (m) =>
            (m.senderUID === userUID && m.recipientUID === friendUID) ||
            (m.senderUID === friendUID && m.recipientUID === userUID),
        );

        res.json(chatMessages);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Send chat message to friend
  app.post(
    "/api/friends/chat/send",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const senderUID = req.user?.uid;
        const { friendUID, message, replyToId } = req.body;

        if (!senderUID || !friendUID || !message) {
          return res
            .status(400)
            .json({ error: "Friend UID and message required" });
        }

        if (!message.trim()) {
          return res.status(400).json({ error: "Message cannot be empty" });
        }

        const messages = loadJSON(messagesFile);
        const friends = loadJSON(friendsFile);

        // Check if they are friends
        const isFriend = friends.some(
          (f) =>
            (f.user1UID === senderUID &&
              f.user2UID === friendUID &&
              f.status === "active") ||
            (f.user2UID === senderUID &&
              f.user1UID === friendUID &&
              f.status === "active"),
        );

        if (!isFriend) {
          return res.status(403).json({ error: "Not friends with this user" });
        }

        const newMessage = {
          id: generateId(),
          senderUID,
          recipientUID: friendUID,
          message: message.trim(),
          replyTo: replyToId || null,
          reactions: [],
          createdAt: new Date().toISOString(),
        };

        messages.push(newMessage);
        saveJSON(messagesFile, messages);

        res.json({ success: true, message: newMessage });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Add reaction to message
  app.post(
    "/api/friends/chat/react",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user?.uid;
        const { messageId, emoji } = req.body;

        if (!userUID || !messageId || !emoji) {
          return res
            .status(400)
            .json({ error: "Message ID and emoji required" });
        }

        const messages = loadJSON(messagesFile);
        const message = messages.find((m) => m.id === messageId);

        if (!message) {
          return res.status(404).json({ error: "Message not found" });
        }

        // Initialize reactions array if not exists
        if (!message.reactions) {
          message.reactions = [];
        }

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(
          (r) => r.userUID === userUID && r.emoji === emoji,
        );

        if (existingReaction) {
          // Remove reaction
          message.reactions = message.reactions.filter(
            (r) => !(r.userUID === userUID && r.emoji === emoji),
          );
        } else {
          // Add reaction
          message.reactions.push({
            userUID,
            emoji,
            createdAt: new Date().toISOString(),
          });
        }

        saveJSON(messagesFile, messages);
        res.json({ success: true, message });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Mark messages as seen
  app.post(
    "/api/friends/chat/mark-seen",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user?.uid;
        const { messageIds } = req.body;

        if (!userUID || !messageIds || !Array.isArray(messageIds)) {
          return res.status(400).json({ error: "Message IDs array required" });
        }

        const messages = loadJSON(messagesFile);
        let updated = 0;

        messageIds.forEach((msgId) => {
          const message = messages.find((m) => m.id === msgId);
          if (message && message.recipientUID === userUID && !message.seenAt) {
            message.seenAt = new Date().toISOString();
            updated++;
          }
        });

        if (updated > 0) {
          saveJSON(messagesFile, messages);
        }

        res.json({ success: true, updated });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  // Get admin messages
  app.get(
    "/api/chat/admin-messages",
    verifyToken || ((req, res, next) => next()),
    (req, res) => {
      try {
        const userUID = req.user?.uid;

        if (!userUID) {
          return res.status(400).json({ error: "User not authenticated" });
        }

        const messages = loadJSON(messagesFile);
        // Get all admin messages (messages from admin users)
        const adminMessages = messages.filter(
          (m) =>
            m.senderUID &&
            (m.senderUID.includes("ADMIN") || m.senderUID.includes("SUPER")) &&
            (m.recipientUID === userUID || !m.recipientUID), // For this user or broadcast to all
        );

        res.json(adminMessages);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );
}

// ==================== CLOUD COIN ROUTES ====================

// ==================== FRIEND SHARE ROUTES ====================

export default registerFriendRoutes;
export {
  cloudCoinsFile,
  friendsFile,
  loadJSON,
  registerChatRoutes,
  registerCloudCoinRoutes,
  registerFriendShareRoutes,
  requestsFile,
  saveJSON,
  sharesFile,
};
