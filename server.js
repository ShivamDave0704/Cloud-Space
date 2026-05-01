import ngrok from "@ngrok/ngrok";
import express from "express";
import path from "path";
import { registerAdminFriendsMonitoring } from "./server-admin-friends.js";
import registerAdminRoutes from "./server-admin.js";
import registerAuthRoutes from "./server-auth.js";
import {
  aggregateAllUsersData,
  app,
  config,
  helpers,
  magicLinks,
  mail,
  paths,
  startAggregationWatcher,
} from "./server-core.js";
import registerFriendRoutes, {
  registerChatRoutes,
  registerCloudCoinRoutes,
  registerFriendShareRoutes,
} from "./server-friends.js";
import registerPlanRoutes from "./server-plans.js";
import registerUploadRoutes from "./server-uploads.js";
import feedbackRoutes from "./server2.js";
import {
  logDataConsolidationStart,
  logNetworkConnected,
  logNetworkConnecting,
  logServerOnline,
} from "./utils/cool-logger.js";
import {
  consolidateUserData,
  setupAutoConsolidation,
} from "./utils/data-consolidator.js";
// Public URL for sharing
let publicUrl = `http://localhost:${process.env.PORT || 5000}`;

// Compose shared core context
const core = {
  app,
  config,
  paths,
  helpers,
  mail,
  magicLinks,
  aggregateAllUsersData,
  verifyToken: helpers.verifyToken,
};

// Auto-refresh all-users-data.json whenever any source JSON file changes
startAggregationWatcher();

// Feedback routes (existing server2.js)
app.use("/api", feedbackRoutes);

// Register modular route groups
registerAuthRoutes(core);
registerUploadRoutes(core);
registerPlanRoutes(core);
registerAdminRoutes(core);

// 👥 Register friend system routes (NEW)
registerFriendRoutes(core);
registerCloudCoinRoutes(core);
registerFriendShareRoutes(core);
registerChatRoutes(core);
registerAdminFriendsMonitoring(core);

// Aggregate users data after all routes are registered (so files are created)
aggregateAllUsersData();

// 🔄 Consolidate user payment data into USER-pay-kundli.JSON
logDataConsolidationStart();
consolidateUserData();
setupAutoConsolidation();

// Prevent stale HTML from being cached by browsers/proxies.
app.use((req, res, next) => {
  if (req.path.endsWith(".html")) {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

// Static assets
app.use("/uploads", express.static(paths.uploadsDir));
app.use("/support", express.static(path.join(paths.__dirname, "support")));
app.use(express.static(paths.publicDir));
app.use("/cloudplus", express.static(path.join(paths.__dirname, "public3")));

// Quiet favicon requests
app.get("/favicon.ico", (_req, res) => res.status(204).end());
// ANSI Color codes for neon effect
const colors = {
  neon_cyan: "\x1b[36m\x1b[1m",
  neon_magenta: "\x1b[35m\x1b[1m",
  neon_green: "\x1b[32m\x1b[1m",
  neon_yellow: "\x1b[33m\x1b[1m",
  neon_blue: "\x1b[34m\x1b[1m",
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
};

// Start server (no Socket.IO)
const server = app.listen(config.PORT, async () => {
  const friendsModule = await import("./server-friends.js");
  const registerFriendRoutes = friendsModule.default;
  const {
    registerCloudCoinRoutes,
    registerFriendShareRoutes,
    registerChatRoutes,
  } = friendsModule;

  // Check if ngrok is enabled in .env
  const enableNgrok = process.env.ENABLE_NGROK === "true";

  if (!enableNgrok) {
    publicUrl = `http://localhost:${config.PORT}`;
    console.log(`\n${colors.neon_magenta}${"━".repeat(70)}${colors.reset}`);
    console.log(
      `${colors.neon_blue}${colors.bright}🌐 NETWORK SETUP${colors.reset}\n`,
    );
    console.log(
      `${colors.neon_cyan}${colors.bright}ℹ️  Ngrok: ${colors.neon_yellow}Disabled in .env${colors.reset}`,
    );
    console.log(`\n${colors.neon_magenta}${"═".repeat(70)}${colors.reset}`);
    console.log(
      `${colors.neon_blue}${colors.bright}🌍 PUBLIC URL (Local Network)${colors.reset}`,
    );
    console.log(`${colors.neon_green}${publicUrl}${colors.reset}`);
    console.log(`${colors.neon_magenta}${"═".repeat(70)}${colors.reset}\n`);

    logServerOnline(
      `http://localhost:${config.PORT}`,
      null,
      "Local Development",
    );
    console.log(
      `${colors.dim}${colors.neon_yellow}💡 Tip: Set ENABLE_NGROK=true in .env to enable public access${colors.reset}\n`,
    );
    return;
  }

  if (!process.env.NGROK_AUTHTOKEN) {
    publicUrl = `http://localhost:${config.PORT}`;
    console.log(`\n${colors.neon_magenta}${"═".repeat(70)}${colors.reset}`);
    console.log(
      `${colors.neon_blue}🌍 PUBLIC URL (Local Network)${colors.reset}`,
    );
    console.log(`${colors.neon_green}${publicUrl}${colors.reset}`);
    console.log(`${colors.neon_magenta}${"═".repeat(70)}${colors.reset}\n`);
    console.warn(
      `${colors.neon_yellow}⚠️ NGROK_AUTHTOKEN missing. Add it to .env to enable public access.${colors.reset}`,
    );
    return;
  }

  try {
    logNetworkConnecting();
    const listener = await ngrok.connect({
      addr: config.PORT,
      authtoken: process.env.NGROK_AUTHTOKEN,
    });
    publicUrl = listener.url();
    logNetworkConnected(publicUrl);
    logServerOnline(`http://localhost:${config.PORT}`, publicUrl, "Production");
  } catch (err) {
    publicUrl = `http://localhost:${config.PORT}`;
    console.error(
      `${colors.neon_yellow}❌ Ngrok error: ${err.message}${colors.reset}`,
    );
    console.log(`\n${colors.neon_magenta}${"═".repeat(70)}${colors.reset}`);
    console.log(
      `${colors.neon_yellow}⚠️  NETWORK: ${colors.reset}Local Network Only (Ngrok Failed)`,
    );
    console.log(
      `${colors.neon_cyan}🔗 Local URL: ${colors.reset}${colors.bright}${publicUrl}${colors.reset}`,
    );
    console.log(`${colors.neon_magenta}${"═".repeat(70)}${colors.reset}\n`);

    logServerOnline(
      `http://localhost:${config.PORT}`,
      null,
      "Local Development",
    );
  }
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `\n❌ Port ${config.PORT} is already in use. Stop the existing process, then start server again.`,
    );
    console.error(
      `   PowerShell: $p = Get-NetTCPConnection -LocalPort ${config.PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess; if ($p) { Stop-Process -Id $p -Force }`,
    );
  } else {
    console.error("\n❌ Server startup error:", err);
  }
  process.exit(1);
});
