/**
 * Cool Console Logger with ANSI Colors and Styling
 * Makes server logs beautiful and readable
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
};

/**
 * Log token generation with cool formatting
 */
export function logTokenGenerated(uid, plan, email, token) {
  console.log(
    `${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}\n` +
      `${colors.bright}${colors.cyan}║${colors.reset} ${colors.bright}${colors.green}🎫  TOKEN GENERATED${colors.reset}${colors.bright}${colors.cyan}                                 ║${colors.reset}\n` +
      `${colors.bright}${colors.cyan}║${colors.reset}  ${colors.brightCyan}UID:${colors.reset}   ${uid}\n` +
      `${colors.bright}${colors.cyan}║${colors.reset}  ${colors.brightCyan}Plan:${colors.reset}  ${colors.brightYellow}${plan.toUpperCase()}${colors.reset}\n` +
      `${colors.bright}${colors.cyan}║${colors.reset}  ${colors.brightCyan}Email:${colors.reset}  ${email || "N/A"}\n` +
      `${colors.bright}${colors.cyan}║${colors.reset}  ${colors.brightCyan}Token:${colors.reset}  ${colors.dim}${token.substring(0, 40)}...${colors.reset}\n` +
      `${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}`,
  );
}

/**
 * Log UI access found
 */
export function logUIAccessFound(uid, plan) {
  console.log(
    `${colors.brightGreen}✨ UI ACCESS DETECTED${colors.reset}\n` +
      `   ${colors.brightCyan}👤 User:${colors.reset} ${uid}\n` +
      `   ${colors.brightGreen}🔓 Access:${colors.reset} ${colors.brightYellow}${plan.toUpperCase()}${colors.reset}`,
  );
}

/**
 * Log payment proof saved with cool formatting
 */
export function logPaymentProofSaved(
  uid,
  email,
  originalAmount,
  finalAmount,
  coinDiscount,
  coupon,
) {
  const discountDisplay =
    coinDiscount > 0
      ? `${colors.brightGreen}₹${coinDiscount}${colors.reset}`
      : `₹0`;
  const couponDisplay = coupon
    ? ` ${colors.yellow}Coupon: ${coupon}${colors.reset}`
    : "";

  console.log(
    `${colors.bright}${colors.magenta}╔═══════════════════════════════════════════════════════╗${colors.reset}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset} ${colors.bright}${colors.green}🧾  PAYMENT PROOF SAVED${colors.reset}${colors.bright}${colors.magenta}                          ║${colors.reset}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset}  ${colors.brightCyan}UID:${colors.reset} ${uid}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset}  ${colors.brightCyan}Email:${colors.reset} ${email}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset}  ${colors.brightRed}Original:${colors.reset} ₹${originalAmount}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset}  ${colors.brightGreen}Final:${colors.reset} ₹${finalAmount}\n` +
      `${colors.bright}${colors.magenta}║${colors.reset}  ${colors.brightYellow}💰 Cloud Coins Discount:${colors.reset} ${discountDisplay}${couponDisplay}\n` +
      `${colors.bright}${colors.magenta}╚═══════════════════════════════════════════════════════╝${colors.reset}`,
  );
}

/**
 * Log platinum UI access
 */
export function logPlatinumUIAccess(uid, accessType) {
  const type = accessType === "token" ? "🎫 Premium Token" : "🔓 UI Access";
  console.log(
    `${colors.bright}${colors.cyan}⚡ PLATINUM UI ACCESS${colors.reset}\n` +
      `   ${colors.brightMagenta}${type}${colors.reset} granted for ${colors.brightYellow}${uid}${colors.reset}`,
  );
}

/**
 * Log plan active data generated
 */
export function logPlanActiveGenerated(count) {
  console.log(
    `${colors.bright}${colors.green}✅ Plan Active Data Generated${colors.reset}\n` +
      `   ${colors.brightCyan}📊 Users:${colors.reset} ${colors.brightGreen}${count}${colors.reset}`,
  );
}

/**
 * Log purchase recorded
 */
export function logPurchaseRecorded(email, plan) {
  console.log(
    `${colors.bright}${colors.green}💳 PURCHASE LOGGED${colors.reset}\n` +
      `   ${colors.brightCyan}Email:${colors.reset} ${email}\n` +
      `   ${colors.brightYellow}Plan:${colors.reset} ${plan.toUpperCase()}`,
  );
}

/**
 * Log plan activation email sent
 */
export function logPlanEmailSent(email, uid, plan) {
  console.log(
    `${colors.bright}${colors.yellow}📧 PLAN ACTIVATION EMAIL SENT${colors.reset}\n` +
      `   ${colors.brightCyan}To:${colors.reset} ${email}\n` +
      `   ${colors.brightMagenta}UID:${colors.reset} ${uid}\n` +
      `   ${colors.brightGreen}Plan:${colors.reset} ${plan.toUpperCase()}`,
  );
}

/**
 * Log user authorization
 */
export function logUserAuthorized(uid, plan, method) {
  const methodDisplay =
    method === "uiAccess" ? "🔓 UI Access Field" : "🎫 Premium Token";
  console.log(
    `${colors.bright}${colors.green}✅ USER AUTHORIZED${colors.reset}\n` +
      `   ${colors.brightCyan}User:${colors.reset} ${uid}\n` +
      `   ${colors.brightYellow}Plan:${colors.reset} ${plan.toUpperCase()}\n` +
      `   ${colors.brightMagenta}Method:${colors.reset} ${methodDisplay}`,
  );
}

/**
 * Log verification stats update
 */
export function logVerificationStats(totalAttempts, successCount, successRate) {
  console.log(
    `${colors.bright}${colors.cyan}📊 VERIFICATION STATS${colors.reset}\n` +
      `   ${colors.brightGreen}Total:${colors.reset} ${totalAttempts}\n` +
      `   ${colors.brightGreen}Success:${colors.reset} ${successCount}\n` +
      `   ${colors.brightCyan}Rate:${colors.reset} ${colors.brightGreen}${successRate}${colors.reset}`,
  );
}

/**
 * Log data consolidation
 */
export function logDataConsolidation(userCount) {
  console.log(
    `${colors.bright}${colors.green}✅ DATA CONSOLIDATED${colors.reset}\n` +
      `   ${colors.brightCyan}Source:${colors.reset} USER-pay-kundli.JSON\n` +
      `   ${colors.brightCyan}Users:${colors.reset} ${colors.brightGreen}${userCount}${colors.reset}`,
  );
}

function divider(color = colors.brightCyan, width = 66, char = "━") {
  return `${color}${char.repeat(width)}${colors.reset}`;
}

export function logPlanConfigurationLoaded(
  fileName,
  planCount,
  pricePerTB,
  wasUpdated,
) {
  const statusLine = wasUpdated
    ? `${colors.brightGreen}✅ Plans updated${colors.reset}`
    : `${colors.brightMagenta}💫 Plans up to date${colors.reset}`;

  console.log(
    `\n${divider(colors.brightMagenta)}\n` +
      `${colors.brightBlue}${colors.bright}📦 PLAN CONFIGURATION${colors.reset}\n\n` +
      `${colors.brightGreen}✅ Loaded:${colors.reset} ${colors.brightCyan}${fileName}${colors.reset}\n` +
      `${colors.brightMagenta}💎 Plans Available:${colors.reset} ${colors.brightYellow}${planCount}${colors.reset}\n` +
      `${statusLine} ${colors.brightYellow}(PRICE_PER_TB=${colors.brightCyan}${pricePerTB}${colors.brightYellow})${colors.reset}\n` +
      `${divider(colors.brightMagenta)}`,
  );
}

export function logPaymentMethodsLoaded(paymentMethods = {}) {
  console.log(`\n${divider(colors.brightCyan)}`);
  console.log(
    `${colors.brightMagenta}${colors.bright}💳 PAYMENT METHODS LOADED${colors.reset}\n`,
  );

  Object.entries(paymentMethods).forEach(([key, method]) => {
    const statusIcon = method?.enabled ? "✅" : "🔒";
    const statusText = method?.enabled
      ? `${colors.brightGreen}ENABLED${colors.reset}`
      : `${colors.brightYellow}DISABLED${colors.reset}`;
    const methodName = `${colors.brightWhite}${method?.name || key}${colors.reset}`;
    console.log(`   ${statusIcon} ${methodName.padEnd(30)} ${statusText}`);
  });

  console.log(`${divider(colors.brightCyan)}\n`);
}

export function logDataConsolidationStart() {
  console.log(
    `\n${colors.brightCyan}${colors.bright}🔄 Initializing data consolidation...${colors.reset}`,
  );
}

export function logDataConsolidationDetails(userCount) {
  console.log(
    `${colors.brightGreen}✅ USER-pay-kundli.JSON is the only source of truth${colors.reset}\n` +
      `${colors.brightCyan}📊 Total users:${colors.reset} ${colors.brightYellow}${userCount}${colors.reset}`,
  );
}

export function logAutoConsolidationDisabled() {
  console.log(
    `${colors.brightYellow}👀 Auto-consolidation disabled ${colors.dim}(single-source USER-pay-kundli.JSON)${colors.reset}`,
  );
}

export function logNetworkConnecting() {
  console.log(`\n${divider(colors.brightBlue)}`);
  console.log(
    `${colors.brightBlue}${colors.bright}🌐 NETWORK SETUP${colors.reset}\n`,
  );
  console.log(
    `${colors.brightYellow}${colors.bright}⏳ Connecting to Ngrok...${colors.reset}`,
  );
}

export function logNetworkConnected(publicUrl) {
  console.log(
    `\n${colors.brightGreen}${colors.bright}${"═".repeat(70)}${colors.reset}`,
  );
  console.log(
    `${colors.brightGreen}${colors.bright}✅ CONNECTION ESTABLISHED${colors.reset}`,
  );
  console.log(
    `${colors.brightCyan}${colors.bright}🔗 Public URL: ${colors.brightYellow}${publicUrl}${colors.reset}`,
  );
  console.log(
    `${colors.brightGreen}${colors.bright}${"═".repeat(70)}${colors.reset}\n`,
  );
}

export function logServerOnline(localUrl, publicUrl, mode) {
  console.log(
    `${colors.brightMagenta}${colors.bright}${"━".repeat(66)}${colors.reset}`,
  );
  console.log(
    `${colors.brightCyan}${colors.bright}   ✨ SERVER STATUS: ${colors.brightGreen}ONLINE ${colors.brightCyan}✨${colors.reset}`,
  );
  console.log(
    `${colors.brightMagenta}${colors.bright}${"━".repeat(66)}${colors.reset}\n`,
  );
  console.log(
    `${colors.brightBlue}${colors.bright}📱 Local Access:${colors.reset}   ${colors.brightCyan}${localUrl}${colors.reset}`,
  );
  if (publicUrl) {
    console.log(
      `${colors.brightMagenta}${colors.bright}🌐 Public Access:${colors.reset}  ${colors.brightYellow}${publicUrl}${colors.reset}`,
    );
  }
  console.log(
    `${colors.brightGreen}${colors.bright}⚡ Mode:${colors.reset}           ${colors.brightCyan}${mode}${colors.reset}`,
  );
  console.log(
    `${colors.brightGreen}${colors.bright}🔐 Security:${colors.reset}       ${colors.brightCyan}Enabled${colors.reset}\n`,
  );
}

export function logLoginPlanCheck(email, uid) {
  console.log(
    `\n${divider(colors.brightMagenta)}\n` +
      `${colors.brightCyan}${colors.bright}🔍 LOGIN:${colors.reset} ${colors.brightWhite}Checking active plans for ${email}${colors.reset} ${colors.dim}(UID: ${uid})${colors.reset}`,
  );
}

export function logLoginResponse(
  email,
  jwtGenerated,
  activePlan,
  premiumToken,
  redirectPage,
) {
  const tokenDisplay = premiumToken
    ? `${colors.brightGreen}✅ ${colors.brightYellow}${premiumToken.substring(0, 20)}...${colors.reset}`
    : `${colors.brightRed}❌ None${colors.reset}`;

  console.log(
    `\n${colors.brightGreen}${colors.bright}✅ LOGIN RESPONSE${colors.reset} ${colors.brightCyan}for ${colors.brightYellow}${email}${colors.brightCyan}:${colors.reset}\n` +
      `   ${colors.brightCyan}JWT:${colors.reset} ${jwtGenerated ? `${colors.brightGreen}✅ Generated${colors.reset}` : `${colors.brightRed}❌ Missing${colors.reset}`}\n` +
      `   ${colors.brightCyan}Active Plan:${colors.reset} ${colors.brightYellow}${activePlan || "None"}${colors.reset}\n` +
      `   ${colors.brightCyan}Premium Token:${colors.reset} ${tokenDisplay}\n` +
      `   ${colors.brightCyan}Redirect Page:${colors.reset} ${colors.brightMagenta}${redirectPage || "upload.html"}${colors.reset}\n` +
      `${divider(colors.brightMagenta)}\n`,
  );
}

export function logUiAccessDecision(uid, accessPlan, requestedPlan) {
  console.log(
    `${colors.brightGreen}✅ uiAccess found${colors.reset} ${colors.brightCyan}for ${uid}:${colors.reset} ${colors.brightYellow}${accessPlan}${colors.reset}`,
  );
  if (requestedPlan) {
    console.log(
      `${colors.brightGreen}✅ User ${uid} authorized via uiAccess:${colors.reset} ${colors.brightYellow}${accessPlan}${colors.reset} ${colors.brightCyan}for${colors.reset} ${colors.brightYellow}${requestedPlan}${colors.reset}`,
    );
  }
}

export function logChunkUpload(uploadedBy, fileId, chunkIndex = null) {
  const indexLabel =
    chunkIndex === null || chunkIndex === undefined ? "?" : String(chunkIndex);
  console.log(
    `${colors.brightBlue}📦 CHUNK${colors.reset} ${colors.brightCyan}user:${colors.reset} ${colors.brightWhite}${uploadedBy}${colors.reset} ${colors.dim}|${colors.reset} ${colors.brightCyan}fileId:${colors.reset} ${colors.brightYellow}${fileId}${colors.reset} ${colors.dim}|${colors.reset} ${colors.brightCyan}part:${colors.reset} ${colors.brightMagenta}${indexLabel}${colors.reset}`,
  );
}

export function logChunkMergeStart(fileId, totalChunks, sampleNames = []) {
  const sample = Array.isArray(sampleNames) ? sampleNames.slice(0, 4) : [];
  const sampleLabel = sample.length
    ? `${sample.join(", ")}${totalChunks > sample.length ? ", ..." : ""}`
    : "n/a";
  console.log(
    `${colors.brightMagenta}${colors.bright}🧩 MERGE START${colors.reset}\n` +
      `   ${colors.brightCyan}File ID:${colors.reset} ${colors.brightYellow}${fileId}${colors.reset}\n` +
      `   ${colors.brightCyan}Chunks:${colors.reset} ${colors.brightGreen}${totalChunks}${colors.reset}\n` +
      `   ${colors.brightCyan}Sample:${colors.reset} ${colors.dim}${sampleLabel}${colors.reset}`,
  );
}

export function logChunkMergeDone(fileName, ext, fileSizeMB, uploadedBy) {
  console.log(
    `${colors.brightGreen}${colors.bright}✅ MERGE COMPLETE${colors.reset}\n` +
      `   ${colors.brightCyan}File:${colors.reset} ${colors.brightWhite}${fileName}${colors.reset}\n` +
      `   ${colors.brightCyan}Type:${colors.reset} ${colors.brightYellow}${String(ext || "unknown").toUpperCase()}${colors.reset}\n` +
      `   ${colors.brightCyan}Size:${colors.reset} ${colors.brightGreen}${fileSizeMB} MB${colors.reset}\n` +
      `   ${colors.brightCyan}User:${colors.reset} ${colors.brightMagenta}${uploadedBy}${colors.reset}`,
  );
}

export function logFriendRequestDebug(
  targetUID,
  senderUID,
  senderEmail,
  hasReqUser,
) {
  console.log(
    `${colors.brightBlue}${colors.bright}🤝 FRIEND REQUEST${colors.reset} ` +
      `${colors.brightCyan}from${colors.reset} ${colors.brightYellow}${senderUID || "N/A"}${colors.reset} ` +
      `${colors.dim}(${senderEmail || "N/A"})${colors.reset} ` +
      `${colors.brightCyan}to${colors.reset} ${colors.brightYellow}${targetUID || "N/A"}${colors.reset} ` +
      `${colors.dim}| req.user=${hasReqUser ? "yes" : "no"}${colors.reset}`,
  );
}

export default {
  logTokenGenerated,
  logUIAccessFound,
  logPaymentProofSaved,
  logPlatinumUIAccess,
  logPlanActiveGenerated,
  logPurchaseRecorded,
  logPlanEmailSent,
  logUserAuthorized,
  logVerificationStats,
  logDataConsolidation,
  logPlanConfigurationLoaded,
  logPaymentMethodsLoaded,
  logDataConsolidationStart,
  logDataConsolidationDetails,
  logAutoConsolidationDisabled,
  logNetworkConnecting,
  logNetworkConnected,
  logServerOnline,
  logLoginPlanCheck,
  logLoginResponse,
  logUiAccessDecision,
  logChunkUpload,
  logChunkMergeStart,
  logChunkMergeDone,
  logFriendRequestDebug,
};
