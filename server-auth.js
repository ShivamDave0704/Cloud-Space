import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { syncCoinsLedgerFromWallets } from "./utils/coins-ledger.js";
import { logLoginPlanCheck, logLoginResponse } from "./utils/cool-logger.js";
import * as Kundli from "./utils/pay-kundli-manager.js";

// Attach authentication and user-profile routes
export function registerAuthRoutes(core) {
  const {
    app,
    paths,
    helpers,
    mail,
    magicLinks,
    config,
    aggregateAllUsersData,
  } = core;
  const {
    usersFile,
    filesMetaFile,
    planActiveFile,
    loginOutFile,
    logsDir,
    passwordChangesLog,
    resetRequestsLog,
    flagsLog,
  } = paths;
  const {
    safeName,
    normalizeEmail,
    generateUID,
    generateStrongPassword,
    resolveUserContext,
    resolveUploadedBy,
    ensureUserDirs,
    signToken,
    verifyToken,
  } = helpers;
  const { sendStyledMail } = mail;
  const {
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
  } = config;

  function getUsersSafe() {
    return Kundli.getUsersList();
  }

  function normalizeReferralUID(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    if (!raw) return "";
    return raw.startsWith("USR-") ? raw : `USR-${raw}`;
  }

  function saveUsersSafe(users) {
    Kundli.updateUsersFromList(users);
  }

  function getPlanActiveSafe() {
    return Kundli.getPlanActiveList();
  }

  function getTokensSafe() {
    return Kundli.getTokensList();
  }

  // ANSI Color codes - DEFINED FIRST
  const colors = {
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
  };

  // =============== Login-Signup Tracking Files =================
  const loginSignupDir = path.join(paths.supportDir, "login-signup");
  const loginFile = path.join(loginSignupDir, "login.json");
  const signupFile = path.join(loginSignupDir, "signup.json");
  const deletedUsersFile = path.join(paths.supportDir, "deleted-users.json");

  function getDeletedUsersSafe() {
    try {
      if (!fs.existsSync(deletedUsersFile)) return [];
      const raw = fs.readFileSync(deletedUsersFile, "utf8").trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function ensureLoginSignupFiles() {
    if (!fs.existsSync(loginSignupDir)) {
      fs.mkdirSync(loginSignupDir, { recursive: true });
      console.log(
        `${colors.cyan}📁 Directory: ${colors.white}login-signup/${colors.reset}`,
      );
    }

    if (!fs.existsSync(loginFile)) {
      fs.writeFileSync(loginFile, JSON.stringify([], null, 2));
      console.log(
        `${colors.cyan}📝 File: ${colors.white}login.json${colors.reset}`,
      );
    }

    if (!fs.existsSync(signupFile)) {
      fs.writeFileSync(signupFile, JSON.stringify([], null, 2));
      console.log(
        `${colors.cyan}📝 File: ${colors.white}signup.json${colors.reset}`,
      );
    }
  }

  function logLoginActivity(user, success = true, reason = null, req = null) {
    try {
      const logins = JSON.parse(fs.readFileSync(loginFile, "utf8") || "[]");

      // Extract IP from request
      let ip = null;
      if (req) {
        ip =
          req.headers["x-forwarded-for"] ||
          req.headers["x-real-ip"] ||
          req.connection?.remoteAddress ||
          req.socket?.remoteAddress ||
          req.ip ||
          "unknown";
        // Clean up IPv6 localhost
        if (ip === "::1" || ip === "::ffff:127.0.0.1") {
          ip = "127.0.0.1";
        }
      }

      logins.push({
        timestamp: new Date().toISOString(),
        uid: user.uid || null,
        email: user.email || null,
        username: user.username || null,
        role: user.role || "user",
        success,
        reason,
        ip: ip,
      });
      fs.writeFileSync(loginFile, JSON.stringify(logins, null, 2));
    } catch (err) {
      console.error("Error logging login activity:", err);
    }
  }

  function logSignupActivity(user, verified = false) {
    try {
      const signups = JSON.parse(fs.readFileSync(signupFile, "utf8") || "[]");
      signups.push({
        timestamp: new Date().toISOString(),
        uid: user.uid || null,
        email: user.email || null,
        username: user.username || null,
        phone: user.phone || null,
        verified,
        role: user.role || "user",
      });
      fs.writeFileSync(signupFile, JSON.stringify(signups, null, 2));
    } catch (err) {
      console.error("Error logging signup activity:", err);
    }
  }

  function readLoginOut() {
    try {
      const data = JSON.parse(fs.readFileSync(loginOutFile, "utf8") || "[]");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function setLoginState(uid, login) {
    try {
      const list = readLoginOut();
      const idx = list.findIndex((x) => x.uid === uid);
      if (idx === -1) {
        list.push({ uid, login: !!login });
      } else {
        list[idx].login = !!login;
      }
      fs.writeFileSync(loginOutFile, JSON.stringify(list, null, 2));
    } catch (err) {
      console.error("Error updating login-out.json:", err);
    }
  }

  ensureLoginSignupFiles();

  // =============== Default Admins =================
  function ensureDefaultAdmins() {
    console.log(
      `\n${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
    );
    console.log(
      `${colors.yellow}${colors.bright}👥 ADMIN ACCOUNTS${colors.reset}\n`,
    );

    let users = Kundli.getAllUsers();

    if (!users.some((u) => u.role === "superadmin")) {
      const superAdmin = {
        uid: "SUPER-001",
        username: "Owner of CloudSpace",
        email: SUPER_ADMIN_EMAIL,
        phone: "NULL",
        password: SUPER_ADMIN_PASSWORD,
        role: "superadmin",
        profilePic: "/images/default-avatar.png",
        created_at: new Date().toISOString(),
        verified: true,
        blocked: false,
      };
      Kundli.saveUser(superAdmin);
      ensureUserDirs(superAdmin.email);
      console.log(
        `${colors.yellow}${colors.bright}👑 Super Admin: ${colors.cyan}${SUPER_ADMIN_EMAIL} ${colors.white}/ ${colors.green}${SUPER_ADMIN_PASSWORD}${colors.reset}`,
      );
    }

    const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || ADMIN_EMAIL;
    const DEFAULT_ADMIN_PASSWORD =
      process.env.DEFAULT_ADMIN_PASSWORD || ADMIN_PASSWORD;

    if (!users.some((u) => u.email === DEFAULT_ADMIN_EMAIL)) {
      const defaultAdmin = {
        uid: "ADMIN-001",
        username: "Admin",
        email: DEFAULT_ADMIN_EMAIL,
        phone: "NULL",
        password: DEFAULT_ADMIN_PASSWORD,
        role: "admin",
        profilePic: "/images/default-avatar.png",
        created_at: new Date().toISOString(),
        verified: true,
        blocked: false,
      };
      Kundli.saveUser(defaultAdmin);
      ensureUserDirs(defaultAdmin.email);
      console.log(
        `${colors.bright}${colors.blue}👨‍💼 Default Admin: ${colors.cyan}${DEFAULT_ADMIN_EMAIL} ${colors.white}/ ${colors.green}${DEFAULT_ADMIN_PASSWORD}${colors.reset}`,
      );
    }
  }

  ensureDefaultAdmins();
  console.log(
    `${colors.bright}${colors.green}✅ Admin Setup: ${colors.cyan}Complete${colors.reset}`,
  );

  // =============== Multer: profile pics =================
  const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Note: req.body might not be populated yet when multer calls this
      // We'll use a temporary directory and move it in the route handler if needed
      let email = req.body.email;

      if (!email && req.body.uid) {
        try {
          const found = Kundli.getUserByUID(req.body.uid);
          if (found) email = found.email;
        } catch (err) {
          console.error("⚠️ UID lookup failed:", err);
        }
      }

      // If email still not found, try to get from query params or headers as fallback
      if (!email) {
        email = req.query.email || req.headers["x-user-email"];
      }

      if (!email) {
        console.error("❌ No email found in req.body, req.query, or headers");
        return cb(new Error("Email or UID required for profile pic"), null);
      }

      const userFolder = ensureUserDirs(email);
      cb(null, userFolder.profile);
    },
    filename: (req, file, cb) => {
      cb(null, "profile-" + Date.now() + path.extname(file.originalname));
    },
  });

  const uploadProfile = multer({ storage: profileStorage });

  // =============== Routes =================
  app.post(
    "/update-profile",
    uploadProfile.single("profilePic"),
    (req, res) => {
      let email = normalizeEmail(req.body.email);
      const uid = req.body.uid;
      if (!email && uid) {
        try {
          const found = Kundli.getUserByUID(uid);
          if (found && found.email) email = normalizeEmail(found.email);
        } catch (e) {
          console.error("UID lookup failed in update-profile", e);
        }
      }
      const username = req.body.username;
      const phone = req.body.phone;
      if (!email) return res.status(400).json({ error: "Email required" });

      const user =
        Kundli.getUserByEmail(email) ||
        (req.body.uid && Kundli.getUserByUID(req.body.uid));
      if (!user) return res.status(404).json({ error: "User not found" });

      const updates = {};
      if (username) updates.username = username;
      if (phone) updates.phone = phone;

      if (req.file) {
        updates.profilePic = `/uploads/${safeName(email)}/profile/${req.file.filename}`;
      }

      Kundli.updateUserProfile(user.uid, updates);
      const currentUser = Kundli.getUserByUID(user.uid) || {
        ...user,
        ...updates,
      };

      // 💰 Add 200 coins for first profile update only
      let profileBonusAwarded = false;
      try {
        const coinsDir = path.join(paths.supportDir, "coins");
        const cloudCoinsFile = path.join(coinsDir, "cloud-coins.json");
        if (!fs.existsSync(coinsDir))
          fs.mkdirSync(coinsDir, { recursive: true });

        let coinData = "[]";
        if (fs.existsSync(cloudCoinsFile)) {
          coinData = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
        }
        const coins = JSON.parse(coinData);
        const normalizedEmail = normalizeEmail(email);
        let userCoins = coins.find((c) => c.userUID === currentUser.uid);
        if (!userCoins && normalizedEmail) {
          userCoins = coins.find(
            (c) => normalizeEmail(c.email) === normalizedEmail,
          );
        }

        // Create coins entry if it doesn't exist
        if (!userCoins) {
          userCoins = {
            userUID: currentUser.uid,
            email: email,
            username: currentUser.username || "Unknown",
            balance: 0,
            createdAt: new Date().toISOString(),
            transactions: [],
          };
          coins.push(userCoins);
        } else {
          if (currentUser.uid && userCoins.userUID !== currentUser.uid)
            userCoins.userUID = currentUser.uid;
          if (email && userCoins.email !== email) userCoins.email = email;
          if (
            currentUser.username &&
            userCoins.username !== currentUser.username
          )
            userCoins.username = currentUser.username;
        }

        const alreadyAwarded = userCoins.transactions?.some(
          (t) => t.type === "profile_update_bonus",
        );
        if (!alreadyAwarded) {
          userCoins.balance += 200;
          userCoins.transactions.push({
            id:
              "PROF-" +
              Math.random().toString(36).substring(2, 12).toUpperCase(),
            type: "profile_update_bonus",
            amount: 200,
            reason: "Profile update bonus",
            timestamp: new Date().toISOString(),
          });
          profileBonusAwarded = true;
          console.log(
            `${colors.bright}${colors.green}✅ Added ${colors.yellow}200 coins ${colors.magenta}💰 ${colors.cyan}to ${colors.yellow}${email} ${colors.green}for ${colors.cyan}first profile update${colors.reset}`,
          );
        }

        fs.writeFileSync(cloudCoinsFile, JSON.stringify(coins, null, 2));
        syncCoinsLedgerFromWallets(paths.supportDir, coins);
      } catch (err) {
        console.error("Error adding profile update coins:", err);
      }

      const { password, ...safeUser } = currentUser;
      res.json({
        message:
          "✅ Profile updated" +
          (profileBonusAwarded ? " + 200 coins earned!" : ""),
        user: safeUser,
      });
    },
  );

  app.get("/user-by-email/:email", (req, res) => {
    try {
      const email = normalizeEmail(req.params.email);
      const u = Kundli.getUserByEmail(email);
      if (!u)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      const { password, ...safe } = u;
      return res.json({ success: true, user: safe });
    } catch (err) {
      console.error("Error fetching user by email", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  app.get("/user-by-uid/:uid", (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      const u = Kundli.getUserByUID(uid);
      if (!u)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      const { password, ...safe } = u;
      return res.json({ success: true, user: safe });
    } catch (err) {
      console.error("Error fetching user by uid", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  app.get("/api/users/status/:uid", verifyToken, (req, res) => {
    try {
      const uid = (req.params.uid || "").trim();
      const list = readLoginOut();
      const entry = list.find((x) => x.uid === uid);
      if (!entry) {
        return res.json({ success: true, isOnline: false, lastActive: null });
      }

      return res.json({
        success: true,
        isOnline: !!entry.login,
        lastActive: null,
      });
    } catch (err) {
      console.error("Error fetching user status", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  app.post("/api/auth/presence", verifyToken, (req, res) => {
    try {
      const uid = req.user?.uid;
      const status = (req.body?.status || "online").toLowerCase();
      if (!uid)
        return res.status(400).json({ success: false, error: "UID required" });

      setLoginState(uid, status !== "offline");
      return res.json({
        success: true,
        isOnline: status !== "offline",
        lastActive: null,
      });
    } catch (err) {
      console.error("Error updating presence", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  app.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    const deletedUsers = getDeletedUsersSafe();
    const deletedEntry = deletedUsers.find(
      (d) => normalizeEmail(d?.email || "") === email,
    );
    if (deletedEntry) {
      return res.status(403).json({
        error:
          "🚫 Your account has been removed by admin. You are no longer allowed to use this facility.",
        reason: "removed",
        forceLogout: true,
      });
    }

    const user = Kundli.getUserByEmail(email);

    if (!user || user.password !== password) {
      logLoginActivity({ email }, false, "Invalid credentials", req);
      return res.status(401).json({ error: "❌ Invalid credentials" });
    }

    if (user.permanentBan) {
      logLoginActivity(user, false, "Permanent ban", req);
      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ${email} | ❌ Tried login (permanent ban)\n`,
      );
      return res.status(403).json({
        error: "❌ Account permanently banned. Contact Admin for support.",
        reason: "permanent",
        contact: SUPER_ADMIN_EMAIL || "owner@cloudspace.com",
      });
    }

    if (user.blocked) {
      if (user.blockUntil && Date.now() >= user.blockUntil) {
        Kundli.updateUserProfile(user.uid, {
          blocked: false,
          blockUntil: null,
          blockedBy: null,
        });
        console.log(`✅ Auto-unblocked ${user.email} after timer expired`);
      } else {
        logLoginActivity(user, false, "Account blocked", req);
        return res.status(403).json({
          error: "🚫 Account blocked.",
          reason: user.blockedBy || "system",
          retryUntil: user.blockUntil || null,
        });
      }
    }

    if (user.locked) {
      logLoginActivity(user, false, "Account locked", req);
      return res.status(403).json({
        error: "🔒 Account locked by admin.",
        reason: user.lockReason || "Locked by admin",
        forceLogout: true,
      });
    }

    const normalizedLoginEmail = normalizeEmail(email);
    const previousRole = String(user.role || "")
      .trim()
      .toLowerCase();

    let normalizedRole = previousRole;

    // Keep default owner permanently as superadmin.
    if (
      normalizedLoginEmail === String(SUPER_ADMIN_EMAIL || "").toLowerCase()
    ) {
      normalizedRole = "superadmin";
    } else if (
      normalizedRole !== "admin" &&
      normalizedRole !== "superadmin" &&
      normalizedRole !== "user"
    ) {
      // For legacy/invalid role values, repair to user.
      normalizedRole = "user";
    }

    if (normalizedRole !== previousRole) {
      user.role = normalizedRole;
      Kundli.updateUserProfile(user.uid, { role: normalizedRole });
    }

    // Clear any admin-forced logout token on successful login
    if (user.forceLogoutToken || user.forceLogoutAt) {
      Kundli.updateUserProfile(user.uid, {
        forceLogoutToken: null,
        forceLogoutAt: null,
      });
      if (typeof aggregateAllUsersData === "function") {
        aggregateAllUsersData();
      }
    }

    if (!user.verified) {
      logLoginActivity(user, false, "Not verified", req);
      const verifyToken = uuidv4();
      magicLinks[verifyToken] = {
        email,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      const verifyLink = `${req.headers.host ? `http://${req.headers.host}` : `http://localhost:${config.PORT}`}/magic-login?token=${verifyToken}`;

      await sendStyledMail(
        email,
        "⚠️ Verify Your Cloud Space Account",
        `
            <h2 style="color:#ffcc00;">Hello Cloud Space User,</h2>
            <p>Please verify your account within <b>10 minutes</b>.</p>
            <p>Otherwise, your account May be <b>Suspended for 24 hours</b>.</p>
            <div style="text-align:center;margin:20px 0;">
                <a href="${verifyLink}" style="display:inline-block;padding:12px 25px;
                   background:linear-gradient(135deg,#00ffcc,#0099ff);
                   color:#111;text-decoration:none;border-radius:8px;
                   font-weight:bold;box-shadow:0 0 15px #00e0ff;">
                   ✅ Verify Now
                </a>
            </div>
            <p style="text-align:center;color:#ccefff;font-size:13px;margin:6px 0 0;">
                If the button does not work, paste this link into your browser:<br>
                <a href="${verifyLink}" style="color:#00ffcc;word-break:break-all;">${verifyLink}</a>
            </p>
            <p style="text-align:center;color:#9bd7ff;font-size:12px;margin-top:4px;">
                After verification, the CloudSpace+ switch will unlock on your upload page for Platinum/Ultra users.
            </p>
            `,
      );

      fs.appendFileSync(
        flagsLog,
        `${new Date().toISOString()} | ${email} | 📧 Sent verification mail\n`,
      );

      setTimeout(
        async () => {
          let freshUsers = getUsersSafe();
          const idx = freshUsers.findIndex((u) => u.email === email);
          if (
            idx !== -1 &&
            !freshUsers[idx].verified &&
            !freshUsers[idx].blocked
          ) {
            freshUsers[idx].blocked = true;
            freshUsers[idx].blockUntil = Date.now() + 24 * 60 * 60 * 1000;
            freshUsers[idx].blockedBy = "system";
            saveUsersSafe(freshUsers);

            fs.appendFileSync(
              flagsLog,
              `${new Date().toISOString()} | ${email} | ⚠️ Auto-blocked 24h (unverified)\n`,
            );

            setTimeout(
              async () => {
                let u2 = getUsersSafe();
                const i2 = u2.findIndex((u) => u.email === email);
                if (i2 !== -1 && !u2[i2].verified) {
                  await sendStyledMail(
                    email,
                    "🚫 Verify Now or Face 30-Day Block",
                    `
                            <h2 style="color:#ff4444;">Final Reminder</h2>
                            <p>Your account is blocked for <b>24 hours</b>.</p>
                            <p>If not verified within this time, you will be <b>blocked for 30 days</b>.</p>
                            <div style="text-align:center;margin:20px 0;">
                                <a href="${verifyLink}" style="display:inline-block;padding:12px 25px;
                                   background:linear-gradient(135deg,#ff4d4d,#ff9900);
                                   color:#111;text-decoration:none;border-radius:8px;
                                   font-weight:bold;box-shadow:0 0 15px #ff4444;">
                                   ✅ Verify Now
                                </a>
                            </div>
                            `,
                  );

                  fs.appendFileSync(
                    flagsLog,
                    `${new Date().toISOString()} | ${email} | 📧 Sent 24h final reminder mail\n`,
                  );

                  setTimeout(
                    () => {
                      let u3 = getUsersSafe();
                      const i3 = u3.findIndex((u) => u.email === email);
                      if (i3 !== -1 && !u3[i3].verified) {
                        u3[i3].blocked = true;
                        u3[i3].permanentBan = true;
                        u3[i3].blockedBy = "system";
                        saveUsersSafe(u3);

                        fs.appendFileSync(
                          flagsLog,
                          `${new Date().toISOString()} | ${email} | ❌ Permanently banned (never verified)\n`,
                        );

                        sendStyledMail(
                          email,
                          "❌ Account Permanently Banned",
                          `<p>Sorry, your account has been permanently banned due to non-verification.</p>`,
                        );
                      }
                    },
                    30 * 24 * 60 * 60 * 1000,
                  );
                }
              },
              24 * 60 * 60 * 1000,
            );
          }
        },
        10 * 60 * 1000,
      );

      return res.status(423).json({
        error:
          "⚠️ Please verify your account. A verification mail has been sent.",
        reason: "unverified",
      });
    }

    ensureUserDirs(user.email);

    // 💰 Initialize coins on first login
    try {
      const coinsDir = path.join(paths.supportDir, "coins");
      const cloudCoinsFile = path.join(coinsDir, "cloud-coins.json");
      if (!fs.existsSync(coinsDir)) fs.mkdirSync(coinsDir, { recursive: true });

      let coinData = "[]";
      if (fs.existsSync(cloudCoinsFile)) {
        coinData = fs.readFileSync(cloudCoinsFile, "utf8") || "[]";
      }
      const coins = JSON.parse(coinData);
      const existingCoins = coins.find((c) => c.userUID === user.uid);

      if (!existingCoins) {
        coins.push({
          userUID: user.uid,
          email: user.email,
          username: user.username,
          balance: 100,
          createdAt: new Date().toISOString(),
          transactions: [
            {
              id:
                "INIT-" +
                Math.random().toString(36).substring(2, 12).toUpperCase(),
              type: "first_login_bonus",
              amount: 100,
              reason: "Welcome bonus - First login",
              timestamp: new Date().toISOString(),
            },
          ],
        });
        fs.writeFileSync(cloudCoinsFile, JSON.stringify(coins, null, 2));
        syncCoinsLedgerFromWallets(paths.supportDir, coins);
        console.log(
          `${colors.bright}${colors.green}✅ Initialized ${colors.yellow}100 coins ${colors.cyan}for ${colors.magenta}${user.email}${colors.reset}`,
        );
      }
    } catch (err) {
      console.error("Error initializing coins:", err);
    }

    // No JWT: use only reference token system
    const token = null;

    logLoginActivity(user, true, null, req);

    // Check for active plans
    let activePlan = null;
    let planDetails = null;
    let redirectPage = null;
    let premiumToken = null;

    logLoginPlanCheck(user.email, user.uid);

    try {
      const planActiveData = getPlanActiveSafe();
      if (planActiveData && planActiveData.length > 0) {
        const userPlanData = planActiveData.find((p) => p.email === user.email);

        if (
          userPlanData &&
          userPlanData.plans &&
          userPlanData.plans.length > 0
        ) {
          console.log(
            `${colors.bright}${colors.cyan}   📋 Found ${colors.yellow}${userPlanData.plans.length} plan(s) ${colors.cyan}in ${colors.magenta}plan-active.json${colors.reset}`,
          );

          const isPlanCurrentlyActive = (plan) => {
            if (!plan || typeof plan !== "object") return false;

            const status = plan.status || {};
            const tx = plan.transaction || {};
            const now = Date.now();

            const expiresAt =
              plan.expiresAt || tx.expiresAt || status.expiresAt || null;
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

          // Find active plans using explicit status + blocking + expiry rules
          const activePlans = userPlanData.plans.filter((p) =>
            isPlanCurrentlyActive(p),
          );

          if (activePlans.length > 0) {
            console.log(
              `${colors.bright}${colors.green}   ✅ ${colors.yellow}${activePlans.length} ${colors.cyan}active plan(s) found${colors.reset}`,
            );

            // Get the most valuable plan (in order: ultra > platinum > gold > silver > custom)
            const planPriority = {
              ultra: 5,
              platinum: 4,
              gold: 3,
              silver: 2,
              custom: 1,
            };
            const bestPlan = activePlans.reduce((best, current) => {
              const currentPriority = planPriority[current.plan] || 0;
              const bestPriority = planPriority[best.plan] || 0;
              return currentPriority > bestPriority ? current : best;
            });

            activePlan = bestPlan.plan;
            planDetails = {
              plan: bestPlan.plan,
              storage:
                bestPlan.planDetails?.storage ||
                bestPlan.planDetails?.storageTB ||
                0,
              expiresAt: bestPlan.expiresAt || null,
              isLifetime: false,
            };

            console.log(
              `${colors.bright}${colors.magenta}   🎯 Best plan selected: ${colors.yellow}${activePlan} ${colors.cyan}(${colors.green}${bestPlan.planDetails?.storageTB || 0} TB${colors.cyan})${colors.reset}`,
            );

            // Fetch token for any purchased plan.
            if (activePlan && activePlan !== "free") {
              try {
                const tokensData = getTokensSafe();
                const tokenEntry = tokensData.tokens?.find(
                  (t) =>
                    t.uid === user.uid && t.plan === activePlan && t.active,
                );
                if (tokenEntry) {
                  premiumToken = tokenEntry.token;
                  console.log(
                    `${colors.bright}${colors.green}   🔐 Plan token found: ${colors.yellow}${tokenEntry.token}${colors.reset}`,
                  );
                } else {
                  console.log(
                    `${colors.bright}${colors.yellow}   ⚠️ No active token found in ${colors.cyan}tokens.json ${colors.white}for ${colors.yellow}${user.uid} / ${activePlan}${colors.reset}`,
                  );
                }
              } catch (tokenErr) {
                console.warn("⚠️ Could not fetch plan token:", tokenErr);
              }
            }

            // Determine redirect page based on plan
            if (activePlan === "ultra") {
              redirectPage = "/ultra-upload.html"; // Ultra users get their own page
              console.log(
                `${colors.bright}${colors.magenta}   🚀 Redirect page: ${colors.cyan}/ultra-upload.html${colors.reset}`,
              );
            } else if (activePlan === "platinum") {
              redirectPage = "/platinum-ui-upload.html";
              console.log(
                `${colors.bright}${colors.magenta}   🚀 Redirect page: ${colors.cyan}/platinum-ui-upload.html${colors.reset}`,
              );
            } else if (activePlan === "gold" || activePlan === "silver") {
              redirectPage = "/upload.html";
              console.log(
                `${colors.bright}${colors.magenta}   🚀 Redirect page: ${colors.cyan}/upload.html${colors.reset}`,
              );
            } else if (activePlan === "custom") {
              redirectPage = "/upload.html";
              console.log(
                `${colors.bright}${colors.magenta}   🚀 Redirect page: ${colors.cyan}/upload.html${colors.reset}`,
              );
            }
          } else {
            console.log(
              `${colors.bright}${colors.blue}   ℹ️ ${colors.white}No active plans found ${colors.dim}(all expired)${colors.reset}`,
            );
          }
        } else {
          console.log(
            `${colors.bright}${colors.blue}   ℹ️ ${colors.white}No plan data found in ${colors.cyan}plan-active.json${colors.reset}`,
          );
        }
      } else {
        console.log(
          `${colors.bright}${colors.yellow}   ⚠️ ${colors.cyan}plan-active.json ${colors.white}not found${colors.reset}`,
        );
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch active plans:", err);
    }

    // Mark user as online in login-out.json
    setLoginState(user.uid, true);

    // Issue JWT for regular users
    const jwtToken = signToken(user);

    logLoginResponse(
      user.email,
      Boolean(jwtToken),
      activePlan,
      premiumToken,
      redirectPage || "upload.html",
    );

    res.json({
      message: "✅ Login successful",
      token: premiumToken,
      jwt: jwtToken,
      uid: user.uid,
      username: user.username,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic || null,
      plan: planDetails ? planDetails.plan : user.plan || "free",
      storageTB: user.storageTB || 0.5,
      planExpiry: user.planExpiry || null,
      uiAccess: user.uiAccess || null,
      cloudplusUI: user.cloudplusUI || null,
      activePlan,
      planDetails,
      redirectPage,
      premiumToken,
    });
    // JWT-protected route example
    app.get("/me", verifyToken, (req, res) => {
      res.json({ user: req.user });
    });
  });

  app.post("/forgot-password", (req, res) => {
    const email = normalizeEmail(req.body.email);
    const phone = req.body.phone;
    const uid = req.body.uid;
    if (!email || !phone || !uid) {
      return res
        .status(400)
        .json({ error: "❌ Email, phone and UID are required" });
    }

    let users = getUsersSafe();
    const user = users.find(
      (u) => u.email === email && u.uid === uid && u.phone === phone,
    );

    if (!user) {
      return res
        .status(404)
        .json({ error: "❌ User not found or details do not match" });
    }

    fs.appendFileSync(
      resetRequestsLog,
      `${new Date().toISOString()} | ${email} | Password reset verified\n`,
    );
    res.json({
      verified: true,
      message: "✅ User verified. You may reset your password.",
    });
  });

  app.post("/reset-password-forgot", (req, res) => {
    const email = normalizeEmail(req.body.email);
    const newPassword = req.body.newPassword;
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ error: "❌ Email and new password required" });
    }

    let users = getUsersSafe();
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) return res.status(404).json({ error: "❌ User not found" });

    const oldPassword = users[idx].password;
    users[idx].password = newPassword;
    saveUsersSafe(users);

    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
    const device = req.headers["user-agent"] || "Unknown Device";
    const timestamp = new Date().toISOString();

    fs.appendFileSync(
      passwordChangesLog,
      `${timestamp} | ${email} | Password Reset (Forgot)\nold: ${oldPassword} → new: ${newPassword}\nIP: ${ip} | Device: ${device}\n\n`,
    );

    res.json({ message: "✅ Password reset successfully" });
  });

  // JWT system removed: /me endpoint should use reference token validation only if needed
  app.get("/me", verifyToken, (req, res) => {
    let users = getUsersSafe();
    const u = users.find((x) => x.email === req.user.email);

    if (!u) {
      return res.status(403).json({
        error:
          "🚫 Your account has been removed by admin. You are no longer allowed to use this facility.",
        reason: "removed",
        forceLogout: true,
      });
    }

    if (u.permanentBan) {
      return res.status(403).json({
        error: "❌ Account permanently banned.",
        reason: "permanent",
        forceLogout: true,
      });
    }

    if (u.blocked) {
      if (u.blockUntil && Date.now() >= u.blockUntil) {
        u.blocked = false;
        delete u.blockUntil;
        delete u.blockedBy;
        saveUsersSafe(users);
        const { password, ...safeUser } = u;
        return res.json(safeUser);
      } else {
        return res.status(403).json({
          error: "🚫 Your account is blocked.",
          reason: u.blockedBy || "system",
          unblockAt: u.blockUntil || null,
          forceLogout: true,
        });
      }
    }

    if (u.locked) {
      return res.status(403).json({
        error: "🔒 Your account is locked by admin.",
        reason: u.lockReason || "Locked by admin",
        forceLogout: true,
      });
    }

    if (u.forceLogoutToken || u.forceLogoutAt) {
      return res.status(403).json({
        error: "🚪 You were logged out by admin. Please login again.",
        forceLogout: true,
      });
    }

    const { password, ...safeUser } = u;
    res.json(safeUser);
  });

  // Get user's plan information (non-admin endpoint)
  // JWT system removed: /api/user-plan endpoint should use reference token validation only if needed
  app.get("/api/user-plan", verifyToken, (req, res) => {
    try {
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
          ["active", "completed"].includes(statusText);

        if (explicitActive) return true;

        return (
          typeof expiryTs === "number" &&
          !Number.isNaN(expiryTs) &&
          expiryTs > now
        );
      };

      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({
          error: "Unauthorized",
          plan: "free",
          plans: [],
          userName: "User",
          userEmail: "",
        });
      }

      // Read users.json to get user details
      let users = [];
      try {
        users = getUsersSafe();
      } catch (e) {
        console.warn(
          "Could not read users from USER-pay-kundli.JSON:",
          e.message,
        );
      }

      const user = users.find((u) => u.email === userEmail);
      const userName = user
        ? user.name || user.username || userEmail.split("@")[0]
        : userEmail.split("@")[0];

      // Read plan-active.json
      let planActive = [];
      try {
        planActive = getPlanActiveSafe();
      } catch (e) {
        console.warn(
          "Could not read plan-active from USER-pay-kundli.JSON:",
          e.message,
        );
        return res.json({
          plan: "free",
          plans: [],
          userName: userName,
          userEmail: userEmail,
        });
      }

      // Find user's plan - check both direct email and self.email structure
      const userPlanData = planActive.find(
        (p) => p.email === userEmail || (p.self && p.self.email === userEmail),
      );

      if (userPlanData && userPlanData.plans && userPlanData.plans.length > 0) {
        const activePlans = userPlanData.plans.filter((p) =>
          isPlanCurrentlyActive(p),
        );
        const latestPlan = activePlans.length
          ? activePlans[activePlans.length - 1]
          : null;

        if (!latestPlan) {
          return res.json({
            plan: "free",
            plans: userPlanData.plans,
            userName: userName,
            userEmail: userEmail,
            uid: user ? user.uid : null,
          });
        }

        res.json({
          plan: latestPlan.plan || "free",
          plans: userPlanData.plans,
          currentPlan: latestPlan,
          userName: userName,
          userEmail: userEmail,
          uid: user ? user.uid : null,
        });
      } else {
        res.json({
          plan: "free",
          plans: [],
          userName: userName,
          userEmail: userEmail,
          uid: user ? user.uid : null,
        });
      }
    } catch (error) {
      console.error("Error fetching user plan:", error);
      res.json({
        plan: "free",
        plans: [],
        userName: "User",
        userEmail: req.user ? req.user.email : "",
      });
    }
  });

  app.post("/reset-password", (req, res) => {
    const email = normalizeEmail(req.body.email);
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;
    if (!email || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    let users = getUsersSafe();
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) return res.status(404).json({ error: "User not found" });

    const user = users[idx];
    if (user.password !== oldPassword) {
      return res.status(403).json({ error: "Old password is incorrect" });
    }

    users[idx].password = newPassword;
    saveUsersSafe(users);

    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
    const device = req.headers["user-agent"] || "Unknown Device";
    const timestamp = new Date().toISOString();

    fs.appendFileSync(
      passwordChangesLog,
      `${timestamp} | ${email} | Password Changed\nold: ${oldPassword} → new: ${newPassword}\nIP: ${ip} | Device: ${device}\n\n`,
    );

    const passwordChangesJsonFile = path.join(logsDir, "password_changes.json");
    if (!fs.existsSync(passwordChangesJsonFile))
      fs.writeFileSync(passwordChangesJsonFile, "[]");

    const existingJsonLogs = JSON.parse(
      fs.readFileSync(passwordChangesJsonFile, "utf8"),
    );
    existingJsonLogs.push({
      timestamp,
      email,
      action: "Password Changed",
      oldPassword,
      newPassword,
      ip,
      device,
    });
    fs.writeFileSync(
      passwordChangesJsonFile,
      JSON.stringify(existingJsonLogs, null, 2),
    );

    res.json({ message: "✅ Password updated successfully" });
  });

  app.post("/user-details", (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = Kundli.getUserByEmail(email);
    if (!user) return res.json({ exists: false });

    const { password, ...safeUser } = user;
    res.json({ exists: true, user: safeUser });
  });

  app.post("/request-magic-link", async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const username = req.body.username;
    const phone = req.body.phone;
    const referralUidRaw = req.body.referralUid;
    if (!email) return res.status(400).json({ error: "Email required" });

    let user = Kundli.getUserByEmail(email);

    const tempPass = generateStrongPassword();
    const isNewUser = !user;
    const normalizedReferralUid = normalizeReferralUID(referralUidRaw);
    const referralUid =
      normalizedReferralUid && normalizedReferralUid !== user?.uid
        ? normalizedReferralUid
        : "";

    if (!user) {
      user = {
        uid: generateUID(),
        username: username || email.split("@")[0],
        email,
        phone: phone || "",
        password: tempPass,
        role: "user",
        blocked: false,
        profilePic: "/images/default-avatar.png",
        created_at: new Date().toISOString(),
        verified: false,
        referral: {
          referredByUID: referralUid || null,
          referredBySetAt: referralUid ? new Date().toISOString() : null,
          successfulReferredUsers: [],
          awardedMilestones: 0,
        },
      };
      Kundli.saveUser(user);
      logSignupActivity(user, false);
    } else {
      const existingReferral =
        user.referral && typeof user.referral === "object" ? user.referral : {};
      const nextReferralBy =
        existingReferral.referredByUID || referralUid || null;
      Kundli.updateUserProfile(user.uid, {
        username: username || user.username,
        phone: phone || user.phone,
        password: tempPass,
        verified: false,
        referral: {
          ...existingReferral,
          referredByUID: nextReferralBy,
          referredBySetAt:
            existingReferral.referredBySetAt ||
            (nextReferralBy ? new Date().toISOString() : null),
          successfulReferredUsers: Array.isArray(
            existingReferral.successfulReferredUsers,
          )
            ? existingReferral.successfulReferredUsers
            : [],
          awardedMilestones: Number.isFinite(
            Number(existingReferral.awardedMilestones),
          )
            ? Number(existingReferral.awardedMilestones)
            : 0,
        },
      });
      user.password = tempPass;
      user.username = username || user.username;
      user.phone = phone || user.phone;
      user.referral = {
        ...existingReferral,
        referredByUID: nextReferralBy,
        referredBySetAt:
          existingReferral.referredBySetAt ||
          (nextReferralBy ? new Date().toISOString() : null),
      };
    }

    const token = uuidv4();
    magicLinks[token] = {
      email,
      expiresAt: Date.now() + 15 * 60 * 1000,
      tempPassword: String(user.password || ""),
    };

    const magicUrl = `${req.headers.host ? `http://${req.headers.host}` : `http://localhost:${config.PORT}`}/magic-login?token=${token}`;

    try {
      await sendStyledMail(
        email,
        "🚀 Verify Your Cloud Space Account",
        `
            <h2 style="text-align:center;color:#00ffcc;">✨ Welcome to Cloud Space ✨</h2>
            <p style="text-align:center;color:#bbb;">Your futuristic <b>personal vault</b> is almost ready.</p>

            <div style="margin:25px 0;padding:18px;border-radius:12px;
                        background:linear-gradient(135deg,#00ffcc,#0099ff);
                        color:#111;text-align:center;font-size:16px;font-weight:bold;
                        box-shadow:0 0 20px rgba(0,255,200,0.4),0 0 30px rgba(0,153,255,0.3);">
                🆔 UID: <span style="color:#000;">${user.uid}</span><br/>
                📧 Email: <span style="color:#000;">${user.email}</span><br/>
                🔑 Temp Password: <span style="color:#000;font-weight:600;">${user.password}</span>
            </div>

            <div style="text-align:center;margin:30px 0;">
                <a href="${magicUrl}" target="_blank"
                   style="display:inline-block;padding:14px 28px;
                          background:linear-gradient(135deg,#00ffcc,#0099ff);
                          color:#111;text-decoration:none;border-radius:10px;
                          font-size:16px;font-weight:bold;letter-spacing:1px;
                          box-shadow:0 0 25px #00ffcc,0 0 45px #0099ff;">
                   ✅ Verify My Account
                </a>
            </div>

            <p style="text-align:center;color:#ccefff;font-size:13px;margin:8px 0 0;">
                If the button does not work, copy and paste this link:<br>
                <a href="${magicUrl}" style="color:#00ffcc;word-break:break-all;">${magicUrl}</a>
            </p>

            <p style="text-align:center;color:#9bd7ff;font-size:12px;margin-top:6px;">
                After you verify, the Switch to CloudSpace+ button will appear on your upload page if you have Platinum or Ultra access.
            </p>

            <p style="text-align:center;color:#aaa;font-size:13px;margin-top:15px;">
                ⏳ Link valid for <b>15 minutes</b>. Ignore if you didn’t request this.
            </p>
            `,
      );

      res.json({
        message: "✅ Magic link sent. Check your inbox/spam.",
        magicUrl,
      });
    } catch (err) {
      console.error("❌ Email error:", err);
      // Still allow signup/login even if email fails - user can proceed
      res.json({
        message:
          "⚠️ Signup successful but email failed. You can login with your temp password or request another link.",
        magicUrl,
        emailWarning: true,
      });
    }
  });

  app.get("/magic-login", (req, res) => {
    const { token } = req.query;
    const record = magicLinks[token];
    if (!record) return res.status(400).send("❌ Invalid or expired link");
    if (Date.now() > record.expiresAt) {
      delete magicLinks[token];
      return res.status(400).send("❌ Link expired");
    }

    // Use Kundli manager to get and update user
    const user = Kundli.getUserByEmail(normalizeEmail(record.email));
    if (!user) return res.status(404).send("❌ User not found");

    // Update user verification status using Kundli manager
    Kundli.updateUserProfile(user.uid, { verified: true });
    ensureUserDirs(user.email);

    // Log verified signup
    logSignupActivity(user, true);

    delete magicLinks[token];

    const email = user.email;
    const uid = user.uid;
    const tempPassword = String(record.tempPassword || user.password || "");
    const loginUrl = `/login.html?email=${encodeURIComponent(email)}&uid=${encodeURIComponent(uid)}&verified=true`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cloud Space Verification</title>
  <style>
    :root {
      --bg-1: #070b16;
      --bg-2: #0f1a33;
      --card: rgba(22, 39, 74, 0.92);
      --accent-a: #13f1d9;
      --accent-b: #17a2ff;
      --text: #e9f8ff;
      --muted: #a5c8da;
      --ok: #17d481;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 15% 10%, rgba(19, 241, 217, 0.12), transparent 40%),
        radial-gradient(circle at 80% 20%, rgba(23, 162, 255, 0.16), transparent 45%),
        linear-gradient(145deg, var(--bg-1), var(--bg-2));
      display: grid;
      place-items: center;
      padding: 20px;
    }
    .card {
      width: min(560px, 94vw);
      background: var(--card);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      box-shadow: 0 20px 70px rgba(4, 13, 34, 0.6);
      padding: 28px 24px;
      text-align: center;
      backdrop-filter: blur(6px);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.55rem;
      line-height: 1.2;
      color: var(--accent-a);
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 0.98rem;
      line-height: 1.5;
    }
    .pwd {
      margin: 18px 0 14px;
      padding: 12px 14px;
      border-radius: 12px;
      color: #041424;
      font-weight: 700;
      letter-spacing: 0.2px;
      background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
      word-break: break-all;
    }
    .hint { font-size: 0.9rem; margin-top: 6px; }
    .btn {
      margin-top: 18px;
      display: inline-block;
      border: 0;
      border-radius: 10px;
      padding: 12px 18px;
      text-decoration: none;
      font-weight: 700;
      color: #051822;
      background: linear-gradient(135deg, var(--accent-a), var(--accent-b));
      box-shadow: 0 10px 25px rgba(19, 241, 217, 0.28);
    }
    .toast {
      position: fixed;
      top: 18px;
      right: 18px;
      padding: 12px 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, #28d485, #0cb3ff);
      color: #061623;
      font-weight: 700;
      box-shadow: 0 16px 30px rgba(12, 179, 255, 0.28);
      transform: translateY(-15px);
      opacity: 0;
      transition: opacity 240ms ease, transform 240ms ease;
      z-index: 20;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="toast" id="toast">Copied: Temp password</div>
  <main class="card">
    <h1>✅ Account Verified</h1>
    <p>Your temporary password is copied automatically when possible.</p>
    <div class="pwd" id="pwdBox"></div>
    <p class="hint">You will be redirected to login shortly.</p>
    <a class="btn" href="${loginUrl}">Continue to Login</a>
  </main>

  <script>
    (function() {
      const tempPassword = ${JSON.stringify(tempPassword)};
      const loginUrl = ${JSON.stringify(loginUrl)};
      const pwdBox = document.getElementById("pwdBox");
      const toast = document.getElementById("toast");
      pwdBox.textContent = tempPassword ? ("🔑 Temp Password: " + tempPassword) : "No temporary password found";

      function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1800);
      }

      async function copyTempPassword() {
        if (!tempPassword) return;

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(tempPassword);
            showToast("✅ Copied: Temp password");
            return;
          }
        } catch (_) {}

        try {
          const ta = document.createElement("textarea");
          ta.value = tempPassword;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (ok) {
            showToast("✅ Copied: Temp password");
          }
        } catch (_) {}
      }

      copyTempPassword();
      setTimeout(() => {
        window.location.href = loginUrl;
      }, 2600);
    })();
  </script>
</body>
</html>`);
  });

  // Check if user has access to a specific plan
  app.post("/api/check-plan-access", (req, res) => {
    try {
      const { plan, uid } = req.body;

      if (!plan || !uid) {
        return res.status(400).json({
          authorized: false,
          msg: "Plan and UID required",
        });
      }

      // Get user from USER-pay-kundli.JSON
      let users = [];
      try {
        users = getUsersSafe();
      } catch (e) {
        console.warn("Could not read users:", e.message);
        return res.json({ authorized: false, msg: "User data unavailable" });
      }

      const user = users.find((u) => u.uid === uid);
      if (!user) {
        return res.json({ authorized: false, msg: "User not found" });
      }

      // Check if user has active plan of requested type
      const targetPlan = String(plan).toLowerCase();
      const activePlan = (user.activePlans || []).find((p) => {
        const planObj = typeof p === "string" ? JSON.parse(p) : p;
        if (!planObj || typeof planObj !== "object") return false;

        // Check if plan name matches
        const planName = String(planObj.plan || "").toLowerCase();
        if (planName !== targetPlan) return false;

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
          ["inactive", "blocked", "expired", "deactivated", "deleted"].includes(
            statusText,
          ) ||
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
      });

      if (!activePlan) {
        return res.json({
          authorized: false,
          msg: `User does not have active ${plan} plan`,
        });
      }

      // User has active plan - return authorization success
      const planObj =
        typeof activePlan === "string" ? JSON.parse(activePlan) : activePlan;
      const token = planObj.accessToken || null;

      return res.json({
        authorized: true,
        plan: targetPlan,
        token: token,
        msg: `User authorized for ${plan} plan`,
      });
    } catch (err) {
      console.error("Error checking plan access:", err);
      return res.status(500).json({
        authorized: false,
        msg: "Server error checking plan access",
      });
    }
  });

  // Validate premium token session (prevent multi-session token reuse)
  app.post("/validate-token-session", (req, res) => {
    try {
      const { token, sessionId, uid } = req.body;

      if (!token || !uid) {
        return res.status(400).json({
          success: false,
          error: "Token and UID required",
        });
      }

      // Get user and verify token matches
      let users = [];
      try {
        users = getUsersSafe();
      } catch (e) {
        console.warn("Could not read users:", e.message);
        return res.json({
          success: false,
          error: "User data unavailable",
        });
      }

      const user = users.find((u) => u.uid === uid);
      if (!user) {
        return res.json({
          success: false,
          error: "User not found",
        });
      }

      // Check if user has active plan with matching token
      const hasMatchingToken = (user.activePlans || []).some((p) => {
        try {
          const planObj = typeof p === "string" ? JSON.parse(p) : p;
          return planObj && planObj.accessToken === token;
        } catch (e) {
          return false;
        }
      });

      if (!hasMatchingToken) {
        return res.json({
          success: false,
          error: "Token does not match user's active plans",
        });
      }

      // Token is valid for this user
      return res.json({
        success: true,
        msg: "Token session validated",
      });
    } catch (err) {
      console.error("Error validating token session:", err);
      return res.status(500).json({
        success: false,
        error: "Server error validating token session",
      });
    }
  });

  app.get("/api/referrals/my-referred", verifyToken, (req, res) => {
    try {
      const myUid = String(req.user?.uid || "").trim();
      if (!myUid) {
        return res.status(400).json({ success: false, error: "UID required" });
      }

      const users = Kundli.getAllUsers();
      const now = new Date();
      let needsWrite = false;

      const referrerIdx = users.findIndex(
        (u) => String(u?.uid || "") === myUid,
      );
      if (referrerIdx !== -1) {
        if (
          !users[referrerIdx].referral ||
          typeof users[referrerIdx].referral !== "object"
        ) {
          users[referrerIdx].referral = {};
          needsWrite = true;
        }
        if (
          !Array.isArray(users[referrerIdx].referral.successfulReferredUsers)
        ) {
          users[referrerIdx].referral.successfulReferredUsers = [];
          needsWrite = true;
        }
      }

      const referredUsers = users
        .filter((u) => {
          const referredBy = String(u?.referral?.referredByUID || "").trim();
          return !!u?.uid && String(u.uid) !== myUid && referredBy === myUid;
        })
        .map((u) => {
          const purchases = Array.isArray(u?.purchases) ? u.purchases : [];
          const proofs = Array.isArray(u?.proofs) ? u.proofs : [];
          const activePlans = Array.isArray(u?.activePlans)
            ? u.activePlans
            : [];

          const hasCompletedPurchase = purchases.some((p) => {
            const status = String(p?.status || "").toLowerCase();
            return (
              p?.isActive === true ||
              status === "completed" ||
              status === "approved"
            );
          });
          const hasApprovedProof = proofs.some((p) => {
            const status = String(p?.status || "").toLowerCase();
            return status === "approved" || p?.verified === true;
          });
          const hasActivePlan = activePlans.some((p) => {
            if (p?.isActive === true) return true;
            const status = String(p?.status || "").toLowerCase();
            if (status === "active" || status === "completed") return true;
            const expiresAt = p?.expiresAt ? new Date(p.expiresAt) : null;
            return !!(
              expiresAt &&
              !Number.isNaN(expiresAt.getTime()) &&
              expiresAt > now
            );
          });

          const inferredSuccess =
            hasCompletedPurchase || hasApprovedProof || hasActivePlan;
          const successfulPurchaseCounted =
            !!u?.referral?.successfulPurchaseCounted || inferredSuccess;

          if (successfulPurchaseCounted) {
            if (!u.referral || typeof u.referral !== "object") {
              u.referral = {};
              needsWrite = true;
            }
            if (u.referral.successfulPurchaseCounted !== true) {
              u.referral.successfulPurchaseCounted = true;
              needsWrite = true;
            }

            const inferredSuccessfulAt =
              u?.referral?.successfulPurchaseAt ||
              purchases.find((p) => p?.activatedAt)?.activatedAt ||
              purchases.find((p) => p?.purchasedAt)?.purchasedAt ||
              proofs.find((p) => p?.verifiedAt)?.verifiedAt ||
              null;

            if (!u.referral.successfulPurchaseAt && inferredSuccessfulAt) {
              u.referral.successfulPurchaseAt = inferredSuccessfulAt;
              needsWrite = true;
            }

            if (referrerIdx !== -1) {
              const list = users[referrerIdx].referral.successfulReferredUsers;
              if (!list.includes(String(u.uid))) {
                list.push(String(u.uid));
                needsWrite = true;
              }
            }
          }

          return {
            uid: u.uid,
            username: u.username || "Unknown",
            email: u.email || "",
            createdAt: u.created_at || null,
            verified: !!u.verified,
            successfulPurchaseCounted,
            successfulPurchaseAt: u?.referral?.successfulPurchaseAt || null,
          };
        })
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });

      const successfulCount = referredUsers.filter(
        (u) => u.successfulPurchaseCounted,
      ).length;

      if (referrerIdx !== -1) {
        const referrer = users[referrerIdx];
        if (
          Number(referrer?.referral?.successfulReferralsCount || 0) !==
          successfulCount
        ) {
          referrer.referral.successfulReferralsCount = successfulCount;
          needsWrite = true;
        }
      }

      if (needsWrite) {
        Kundli.writeKundli(users);
      }

      return res.json({
        success: true,
        referredUsers,
        totalReferred: referredUsers.length,
        successfulCount,
        pendingCount: referredUsers.length - successfulCount,
        milestoneTarget: 10,
      });
    } catch (err) {
      console.error("Error fetching referred users:", err);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  app.post("/user-context", (req, res) => {
    const ctx = resolveUserContext(req);
    res.json(ctx);
  });

  // =============== Auth Records API =================
  app.get("/api/auth/all-users", (req, res) => {
    try {
      const users = getUsersSafe();
      // Remove passwords from response for security
      const safeUsers = users.map((u) => {
        const { password, ...safe } = u;
        return safe;
      });
      res.json({ success: true, users: safeUsers, count: safeUsers.length });
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  });

  app.get("/api/auth/login-history", (req, res) => {
    try {
      const logins = JSON.parse(fs.readFileSync(loginFile, "utf8") || "[]");
      res.json({ success: true, logins, count: logins.length });
    } catch (error) {
      console.error("Error fetching login history:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch login history" });
    }
  });

  app.get("/api/auth/signup-history", (req, res) => {
    try {
      const signups = JSON.parse(fs.readFileSync(signupFile, "utf8") || "[]");
      res.json({ success: true, signups, count: signups.length });
    } catch (error) {
      console.error("Error fetching signup history:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch signup history" });
    }
  });

  // =================== OTP-BASED PASSWORD RESET ===================
  const otpStore = new Map(); // Store OTPs temporarily {email: {otp, token, expires}}
  const pendingEmailChanges = new Map(); // {token: {uid, currentEmail, newEmail, expires}}

  // Send OTP for password reset
  app.post("/send-otp-reset", (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const normalizedEmail = normalizeEmail(email);
      const users = getUsersSafe();
      const user = users.find(
        (u) => normalizeEmail(u.email) === normalizedEmail,
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const token = crypto.randomBytes(32).toString("hex");
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

      otpStore.set(normalizedEmail, { otp, token, expires });

      // Send OTP via email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "🔐 Password Reset OTP - CloudSpace",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 20px;">
            <div style="background: white; padding: 30px; border-radius: 15px; text-align: center;">
              <h1 style="color: #667eea; margin-bottom: 20px;">🔐 Password Reset OTP</h1>
              <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                You requested to reset your password. Use the OTP below to verify:
              </p>
              <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 10px; margin: 30px 0;">
                <h2 style="color: white; font-size: 36px; letter-spacing: 10px; margin: 0;">${otp}</h2>
              </div>
              <p style="color: #666; font-size: 14px;">
                This OTP is valid for <strong>10 minutes</strong> only.
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                If you didn't request this, please ignore this email.
              </p>
            </div>
          </div>
        `,
      };

      mail.transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error("❌ OTP email failed:", err.message);
          console.error(
            "📧 Make sure you're using Gmail App Password, not your regular password",
          );
          console.error("📧 Visit: https://myaccount.google.com/apppasswords");
          return res
            .status(500)
            .json({ error: "Failed to send OTP. Please contact support." });
        }
        console.log("✅ OTP email sent to:", user.email);
        res.json({ success: true, message: "OTP sent to email", token });
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Verify OTP
  app.post("/verify-otp-reset", (req, res) => {
    try {
      const { email, otp, token } = req.body;

      if (!email || !otp || !token) {
        return res
          .status(400)
          .json({ error: "Email, OTP, and token required" });
      }

      const normalizedEmail = normalizeEmail(email);
      const stored = otpStore.get(normalizedEmail);

      if (!stored) {
        return res
          .status(400)
          .json({ error: "No OTP found. Please request a new one." });
      }

      if (stored.token !== token) {
        return res.status(400).json({ error: "Invalid token" });
      }

      if (Date.now() > stored.expires) {
        otpStore.delete(normalizedEmail);
        return res
          .status(400)
          .json({ error: "OTP expired. Please request a new one." });
      }

      if (stored.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // OTP verified - keep it for password reset
      res.json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Reset password with verified OTP
  app.post("/reset-password-otp", (req, res) => {
    try {
      const { email, newPassword, token } = req.body;

      if (!email || !newPassword || !token) {
        return res
          .status(400)
          .json({ error: "Email, new password, and token required" });
      }

      const normalizedEmail = normalizeEmail(email);
      const stored = otpStore.get(normalizedEmail);

      if (!stored || stored.token !== token) {
        return res.status(400).json({ error: "Invalid or expired session" });
      }

      if (Date.now() > stored.expires) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Session expired" });
      }

      // Reset password
      let users = getUsersSafe();
      const userIndex = users.findIndex(
        (u) => normalizeEmail(u.email) === normalizedEmail,
      );

      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      users[userIndex].password = newPassword;
      saveUsersSafe(users);

      // Log the password change
      const changeLog = `${new Date().toISOString()} | 🔐 ${normalizedEmail} | Password reset via OTP\n`;
      fs.appendFileSync(passwordChangesLog, changeLog);

      // Clear OTP
      otpStore.delete(normalizedEmail);

      console.log(`✅ Password reset via OTP: ${normalizedEmail}`);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // =================== SUPPORT EMAIL REQUESTS ===================
  // Send support emails for account-related requests
  app.post("/api/send-support-email", async (req, res) => {
    try {
      const { type, uid, email, currentEmail, newEmail, reason, requestTime } =
        req.body;

      if (!type || !email) {
        return res.status(400).json({ error: "Type and email required" });
      }

      let subject = "";
      let htmlBody = "";

      const sendEmail = async (options) => {
        await mail.transporter.sendMail({
          from: process.env.EMAIL_USER,
          ...options,
        });
      };

      if (type === "email-change-request") {
        const normalizedCurrentEmail = normalizeEmail(currentEmail || "");
        const normalizedNewEmail = normalizeEmail(newEmail || "");

        if (!uid || !normalizedCurrentEmail || !normalizedNewEmail) {
          return res.status(400).json({
            error: "uid, currentEmail and newEmail are required",
          });
        }

        if (normalizedCurrentEmail === normalizedNewEmail) {
          return res
            .status(400)
            .json({ error: "New email must be different from current email" });
        }

        const users = getUsersSafe();
        const user = users.find(
          (u) => String(u.uid || "").trim() === String(uid),
        );
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (normalizeEmail(user.email || "") !== normalizedCurrentEmail) {
          return res.status(400).json({
            error: "Current email does not match account email",
          });
        }

        const emailAlreadyUsed = users.some(
          (u) =>
            String(u.uid || "").trim() !== String(uid) &&
            normalizeEmail(u.email || "") === normalizedNewEmail,
        );
        if (emailAlreadyUsed) {
          return res.status(409).json({
            error: "New email is already used by another account",
          });
        }

        const confirmToken = crypto.randomBytes(32).toString("hex");
        const expires = Date.now() + 30 * 60 * 1000; // 30 minutes
        pendingEmailChanges.set(confirmToken, {
          uid: String(uid),
          currentEmail: normalizedCurrentEmail,
          newEmail: normalizedNewEmail,
          expires,
        });

        const host = req.get("host");
        const protocol = req.protocol || "https";
        const confirmUrl = `${protocol}://${host}/api/email-change/confirm?token=${encodeURIComponent(confirmToken)}`;

        subject = `📧 Email Change Request - ${uid}`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 20px;">
            <div style="background: white; padding: 30px; border-radius: 15px;">
              <h2 style="color: #667eea;">📧 Email Change Request</h2>
              <p><strong>User ID:</strong> ${uid}</p>
              <p><strong>Current Email:</strong> ${normalizedCurrentEmail}</p>
              <p><strong>New Email:</strong> ${normalizedNewEmail}</p>
              <p><strong>Request Time:</strong> ${requestTime}</p>
              <p><strong>Confirm URL:</strong> <a href="${confirmUrl}">${confirmUrl}</a></p>
              <hr style="border: none; border-top: 2px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 14px;">The change is pending until user clicks the confirmation link.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: normalizedNewEmail,
          subject: "📧 Confirm Your CloudSpace Email Change",
          html: `
            <div style="margin:0;padding:28px;background:radial-gradient(circle at 10% 20%, #1b244a 0%, #11152c 55%, #0b0f21 100%);font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#e9f2ff;">
              <div style="max-width:640px;margin:0 auto;background:linear-gradient(145deg,#141b3a,#10162f);border:1px solid #2d3f8f;border-radius:20px;overflow:hidden;box-shadow:0 20px 45px rgba(0,0,0,0.35);">
                <div style="padding:24px 26px;background:linear-gradient(90deg,#2f6bff,#5b3bff,#a234d6);color:#ffffff;">
                  <div style="font-size:13px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.95;">CloudSpace Security</div>
                  <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;">Confirm Your New Email</h1>
                </div>
                <div style="padding:24px 26px 10px;">
                  <p style="margin:0 0 16px;font-size:15px;color:#d8e2ff;">A request was made to update your CloudSpace email. Please confirm this change to activate your new address.</p>
                  <div style="background:#0d1230;border:1px solid #2a356f;border-radius:14px;padding:14px 16px;margin-bottom:18px;">
                    <p style="margin:4px 0;font-size:14px;"><strong style="color:#8fb0ff;">UID:</strong> ${uid}</p>
                    <p style="margin:4px 0;font-size:14px;"><strong style="color:#8fb0ff;">Current email:</strong> ${normalizedCurrentEmail}</p>
                    <p style="margin:4px 0;font-size:14px;"><strong style="color:#8fb0ff;">New email:</strong> ${normalizedNewEmail}</p>
                    <p style="margin:4px 0;font-size:14px;"><strong style="color:#8fb0ff;">Link validity:</strong> 30 minutes</p>
                  </div>
                  <div style="margin:24px 0 20px;text-align:center;">
                    <a href="${confirmUrl}" style="display:inline-block;padding:13px 24px;border-radius:12px;background:linear-gradient(90deg,#16c2ff,#6b5cff);color:#ffffff;text-decoration:none;font-weight:700;letter-spacing:0.2px;box-shadow:0 12px 28px rgba(43,137,255,0.35);">Confirm Email Change</a>
                  </div>
                  <p style="margin:0 0 8px;font-size:12px;color:#9db0e5;">If the button does not work, copy and paste this URL:</p>
                  <p style="margin:0 0 16px;word-break:break-all;"><a href="${confirmUrl}" style="color:#86d7ff;font-size:12px;">${confirmUrl}</a></p>
                </div>
                <div style="padding:14px 26px 20px;border-top:1px solid #25356d;color:#9db0e5;font-size:12px;">
                  If you did not request this change, ignore this email and secure your account.
                </div>
              </div>
            </div>
          `,
        });
        console.log(
          "✅ Email change confirmation link sent to:",
          normalizedNewEmail,
        );

        await sendEmail({
          to: normalizedCurrentEmail,
          subject: "📧 CloudSpace Email Change Request Alert",
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px;">
            <h2>Email Change Request Alert</h2>
            <p>We received a request to change your CloudSpace email.</p>
            <p><strong>UID:</strong> ${uid || "N/A"}</p>
            <p><strong>Current email:</strong> ${normalizedCurrentEmail}</p>
            <p><strong>Requested new email:</strong> ${normalizedNewEmail}</p>
            <p><strong>Requested at:</strong> ${requestTime || new Date().toISOString()}</p>
            <p>No change is applied until the new email confirms the request.</p>
          </div>`,
        });
        console.log(
          "✅ Email change alert sent to current email:",
          normalizedCurrentEmail,
        );

        await sendEmail({
          to: ADMIN_EMAIL,
          subject,
          html: htmlBody,
        });
        console.log(`✅ Support email (${type}) sent to admin`);

        return res.json({
          success: true,
          message:
            "Email change confirmation sent. Please confirm from new email inbox.",
          pending: true,
          expiresAt: new Date(expires).toISOString(),
        });
      }

      if (type === "account-deletion-request") {
        subject = `🗑️ Account Deletion Request - ${uid}`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 40px; border-radius: 20px;">
            <div style="background: white; padding: 30px; border-radius: 15px;">
              <h2 style="color: #ff6b6b;">🗑️ Account Deletion Request</h2>
              <p><strong>User ID:</strong> ${uid}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Request Time:</strong> ${requestTime}</p>
              <p><strong>Reason:</strong> ${reason || "Not provided"}</p>
              <hr style="border: none; border-top: 2px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 14px;">Account will be deleted within 48 hours. A confirmation email has been sent to the user.</p>
            </div>
          </div>
        `;
        // Send user confirmation first
        await sendEmail({
          to: email,
          subject: "🗑️ Account Deletion Confirmation",
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
            <h2>Account Deletion Confirmed</h2>
            <p>We've received your account deletion request for ${email}.</p>
            <p>Your account will be permanently deleted within 48 hours.</p>
            <p>If you didn't request this, please contact support immediately at support@cloudspace.com</p>
          </div>`,
        });
        console.log("✅ Deletion confirmation sent to:", email);
      }

      // Send notification to admin
      if (htmlBody) {
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: subject,
          html: htmlBody,
        });
        console.log(`✅ Support email (${type}) sent to admin`);
      }

      res.json({ success: true, message: "Support email sent" });
    } catch (error) {
      console.error("Error sending support email:", error);
      res
        .status(500)
        .json({ error: error?.message || "Failed to send support email" });
    }
  });

  app.get("/api/email-change/confirm", async (req, res) => {
    try {
      const renderConfirmPage = (title, message, tone = "success") => {
        const palette =
          tone === "success"
            ? {
                glow: "rgba(56, 234, 144, 0.35)",
                accent: "#38ea90",
                badge: "#0d4f2f",
              }
            : {
                glow: "rgba(255, 108, 108, 0.35)",
                accent: "#ff6c6c",
                badge: "#5a1f1f",
              };

        return `
          <html>
            <head>
              <title>Email Update Status</title>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body style="margin:0;min-height:100vh;background:radial-gradient(circle at 10% 15%, #172554 0%, #0b1028 50%, #060913 100%);font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#e7efff;display:flex;align-items:center;justify-content:center;padding:20px;">
              <div style="width:100%;max-width:700px;background:linear-gradient(160deg,#111937,#0c1330);border:1px solid #2a3d83;border-radius:22px;box-shadow:0 25px 60px ${palette.glow}, 0 10px 20px rgba(0,0,0,0.35);overflow:hidden;">
                <div style="padding:18px 22px;background:linear-gradient(90deg,#3044a8,#334fbd,#3d68d4);font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">CloudSpace Account Center</div>
                <div style="padding:30px 24px 24px;">
                  <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${palette.badge};border:1px solid ${palette.accent};color:${palette.accent};font-size:12px;font-weight:700;letter-spacing:.6px;margin-bottom:16px;">Email Update</div>
                  <h1 style="margin:0 0 12px;font-size:31px;line-height:1.2;color:#f8fbff;">${title}</h1>
                  <p style="margin:0 0 20px;font-size:16px;color:#b7c8f5;line-height:1.65;">${message}</p>
                  <div style="background:#0a1232;border:1px solid #273b7b;border-radius:14px;padding:14px 16px;color:#9eb3e8;font-size:13px;line-height:1.6;">
                    You can close this tab and continue in CloudSpace settings.
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      };

      const token = String(req.query.token || "").trim();
      if (!token) {
        return res
          .status(400)
          .send(
            renderConfirmPage(
              "Invalid Confirmation Link",
              "This link is missing a valid token. Please request a fresh email-change link from Settings.",
              "error",
            ),
          );
      }

      const pending = pendingEmailChanges.get(token);
      if (!pending) {
        return res
          .status(400)
          .send(
            renderConfirmPage(
              "Link Is No Longer Valid",
              "This email-change link is invalid or already used. Start a new email-change request from Settings.",
              "error",
            ),
          );
      }

      if (Date.now() > pending.expires) {
        pendingEmailChanges.delete(token);
        return res
          .status(400)
          .send(
            renderConfirmPage(
              "Link Expired",
              "This confirmation link has expired. Please request a new email-change confirmation from Settings.",
              "error",
            ),
          );
      }

      const users = getUsersSafe();
      const idx = users.findIndex(
        (u) => String(u.uid || "").trim() === pending.uid,
      );
      if (idx === -1) {
        pendingEmailChanges.delete(token);
        return res
          .status(404)
          .send(
            renderConfirmPage(
              "User Not Found",
              "We could not find this account while processing the email change. Please try again from Settings.",
              "error",
            ),
          );
      }

      const exists = users.some(
        (u, i) =>
          i !== idx && normalizeEmail(u.email || "") === pending.newEmail,
      );
      if (exists) {
        pendingEmailChanges.delete(token);
        return res
          .status(409)
          .send(
            renderConfirmPage(
              "Email Already In Use",
              "This email address is already linked to another account. Try a different email.",
              "error",
            ),
          );
      }

      const currentStored = normalizeEmail(users[idx].email || "");
      if (currentStored !== pending.currentEmail) {
        pendingEmailChanges.delete(token);
        return res
          .status(400)
          .send(
            renderConfirmPage(
              "Request No Longer Current",
              "The account email changed before this confirmation was completed. Please request a fresh link.",
              "error",
            ),
          );
      }

      users[idx].email = pending.newEmail;
      users[idx].updated_at = new Date().toISOString();
      saveUsersSafe(users);
      aggregateAllUsersData();
      pendingEmailChanges.delete(token);

      try {
        await mail.transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: pending.newEmail,
          subject: "✅ CloudSpace Email Updated Successfully",
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2>Email Updated Successfully</h2>
            <p>Your CloudSpace account email has been updated.</p>
            <p><strong>UID:</strong> ${pending.uid}</p>
            <p><strong>New email:</strong> ${pending.newEmail}</p>
            <p><strong>Updated at:</strong> ${new Date().toISOString()}</p>
          </div>`,
        });
      } catch (notifyErr) {
        console.error(
          "Post-confirmation email notification failed:",
          notifyErr.message,
        );
      }

      return res.send(
        renderConfirmPage(
          "Email Changed Successfully",
          `Your CloudSpace account email is now <strong style="color:#9fe6ff;">${pending.newEmail}</strong>.`,
          "success",
        ),
      );
    } catch (err) {
      console.error("Email confirm endpoint error:", err);
      return res
        .status(500)
        .send(
          `<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#0b1028;color:#e7efff;padding:30px;"><h2>Could not confirm email change</h2><p>Please try again in a minute.</p></body></html>`,
        );
    }
  });
}

export default registerAuthRoutes;
