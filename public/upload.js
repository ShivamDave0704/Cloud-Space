// ✅ Define API first
const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin; // ✅ auto-use ngrok URL
// ✅ If redirected from Magic Link / Google OAuth
const urlParams = new URLSearchParams(window.location.search);
const premiumPlanTokenRegex =
  /^(TOK-(PCS|UCS)\d{10}|PTK-USR\d{6}|USR-[A-Z0-9]+-(PLATPLAN|ULTRPLAN)-\d{2}-\d{2}-\d{4}-\d{6}|USR-[A-Z0-9]+-TOK-PLATINUM-\d{6})$/;

function isPremiumPlanToken(value) {
  return (
    typeof value === "string" &&
    premiumPlanTokenRegex.test(value.trim().toUpperCase())
  );
}

function resolvePlanUploadPage(tokenValue, planHint, fallbackPlan) {
  const hint = (planHint || "").toLowerCase();
  if (hint === "ultra") return "ultra-upload.html";
  if (hint === "platinum") return "platinum-ui-upload.html";

  const tokenUpper = String(tokenValue || "").toUpperCase();
  if (tokenUpper.includes("ULTRPLAN") || tokenUpper.includes("TOK-UCS")) {
    return "ultra-upload.html";
  }
  if (String(fallbackPlan || "").toLowerCase() === "ultra") {
    return "ultra-upload.html";
  }
  return "platinum-ui-upload.html";
}

const premiumTokenFromQuery = urlParams.get("token");
const premiumPlanHintFromQuery = (urlParams.get("plan") || "").toLowerCase();
const premiumUidFromQuery = urlParams.get("uid");
const referralFromQueryRaw = String(urlParams.get("ref") || "")
  .trim()
  .toUpperCase();
const referralFromQuery = referralFromQueryRaw
  ? referralFromQueryRaw.startsWith("USR-")
    ? referralFromQueryRaw
    : `USR-${referralFromQueryRaw}`
  : "";
const referralFromStorage = String(
  localStorage.getItem("pendingReferralUID") || "",
)
  .trim()
  .toUpperCase();
const activeReferralUid = referralFromQuery || referralFromStorage;
if (activeReferralUid) {
  localStorage.setItem("pendingReferralUID", activeReferralUid);

  if (referralFromQuery !== activeReferralUid) {
    const syncParams = new URLSearchParams(window.location.search);
    syncParams.set("ref", activeReferralUid);
    const qs = syncParams.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }
}

function buildLoginRedirectWithReferral() {
  const refForRedirect = String(
    activeReferralUid || localStorage.getItem("pendingReferralUID") || "",
  )
    .trim()
    .toUpperCase();

  const qp = new URLSearchParams();
  if (refForRedirect) qp.set("ref", refForRedirect);
  qp.set("next", "upload.html");
  return `login.html?${qp.toString()}`;
}

if (isPremiumPlanToken(premiumTokenFromQuery)) {
  sessionStorage.setItem("planSwitchToken", premiumTokenFromQuery);
  if (premiumPlanHintFromQuery) {
    sessionStorage.setItem("planSwitchHint", premiumPlanHintFromQuery);
  }
  if (premiumUidFromQuery) {
    sessionStorage.setItem("planSwitchUid", premiumUidFromQuery);
  }
}

const storedPlanSwitchToken = sessionStorage.getItem("planSwitchToken");
const planSwitchToken = isPremiumPlanToken(premiumTokenFromQuery)
  ? premiumTokenFromQuery
  : isPremiumPlanToken(storedPlanSwitchToken)
    ? storedPlanSwitchToken
    : "";
const planSwitchHint =
  premiumPlanHintFromQuery || sessionStorage.getItem("planSwitchHint") || "";
const isTokenNormalUploadPage = Boolean(planSwitchToken);

if (urlParams.has("user")) {
  try {
    const userData = JSON.parse(decodeURIComponent(urlParams.get("user")));
    if (userData) {
      // Save user to localStorage
      localStorage.setItem("email", userData.email);
      localStorage.setItem("username", userData.username);
      localStorage.setItem("phone", userData.phone || "");
      localStorage.setItem("uid", userData.uid);

      // ✅ Fix: Gmail DP auto fetch
      if (userData.profilePic) {
        localStorage.setItem(
          "profilePic",
          userData.profilePic.startsWith("http")
            ? userData.profilePic
            : `${API}${userData.profilePic}`,
        );
      }

      showAlert(
        `🎉 Welcome ${userData.username || userData.email}, you're logged in!`,
        "success",
      );
    }
  } catch (err) {
    console.error("User parse failed:", err);
  }
}

const token = localStorage.getItem("token");
const fileLabelText = document.getElementById("fileLabelText");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const filePreview = document.getElementById("filesGrid");
const progressContainer = document.getElementById("progressContainer");
const cancelBtn = document.getElementById("cancelBtn"); // ✅ add this
let selectedFiles = [];
let currentUserPlan = "free"; // track current plan for redirects
const fileCardRefs = new Map();

function getFileKey(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

// ✅ Keep <input type="file"> synced with selectedFiles
function syncFileInput() {
  const dt = new DataTransfer();
  selectedFiles.forEach((file) => dt.items.add(file));
  fileInput.files = dt.files;
}
let activeUploads = []; // ✅ add this
let storageFull = false; // track whether storage is full (do not disable button permanently)
// ✅ ETA helper
function calculateETA(totalSize, uploadedBytes, elapsedSec) {
  if (elapsedSec <= 0 || uploadedBytes <= 0) return "Calculating...";
  const speed = uploadedBytes / elapsedSec; // bytes/sec
  const remaining = totalSize - uploadedBytes;
  const etaSec = remaining / speed;

  if (etaSec < 60) return `${etaSec.toFixed(1)}s`;
  if (etaSec < 3600) return `${(etaSec / 60).toFixed(1)}m`;
  return `${(etaSec / 3600).toFixed(1)}h`;
}

// 🌌 Cool Custom Alert System
function showAlert(message, type = "info") {
  const alertBox = document.getElementById("customAlert");
  const alertMessage = document.getElementById("alertMessage");
  const alertIcon = document.getElementById("alertIcon");

  // Reset first
  alertBox.classList.remove("show", "error", "success", "warn", "info");

  // Set message
  alertMessage.textContent = message;

  // Style per type
  if (type === "error") {
    alertIcon.textContent = "";
    alertBox.classList.add("error");
  } else if (type === "success") {
    alertIcon.textContent = "";
    alertBox.classList.add("success");
  } else if (type === "warn") {
    alertIcon.textContent = "";
    alertBox.classList.add("warn");
  } else {
    alertIcon.textContent = "";
    alertBox.classList.add("info");
  }

  // Show
  setTimeout(() => alertBox.classList.add("show"), 50);

  // Auto close after 4s
  setTimeout(() => closeAlert(), 4000);
}

function closeAlert() {
  const alertBox = document.getElementById("customAlert");
  alertBox.classList.remove("show");
}

// 🎨 COOL UPLOAD STARTED ANIMATION ALERT
function showUploadStartedAlert(filesCount) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(102, 126, 234, 0.1), rgba(0, 0, 0, 0.7));
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 98888;
        backdrop-filter: blur(8px);
        animation: uploadStartFadeIn 0.4s ease;
    `;

  const alertBox = document.createElement("div");
  alertBox.style.cssText = `
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(245, 87, 108, 0.85));
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 30px;
        padding: 50px 80px;
        text-align: center;
        box-shadow: 0 20px 80px rgba(102, 126, 234, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        max-width: 500px;
        animation: uploadAlertBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        backdrop-filter: blur(20px);
        border-radius: 35px;
    `;

  alertBox.innerHTML = `
        <div style="font-size: 100px; margin-bottom: 20px; animation: uploadPulse 1.2s ease-in-out infinite;">🚀</div>
        <h2 style="color: white; font-size: 36px; font-weight: 900; margin-bottom: 10px; text-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            Starting Upload!
        </h2>
        <p style="color: rgba(255, 255, 255, 0.95); font-size: 18px; margin: 0 0 20px 0; font-weight: 600;">
            📁 ${filesCount} file${filesCount > 1 ? "s" : ""} ready to upload
        </p>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 25px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: white; animation: uploadDot 1.4s ease-in-out infinite 0s;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: white; animation: uploadDot 1.4s ease-in-out infinite 0.2s;"></div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: white; animation: uploadDot 1.4s ease-in-out infinite 0.4s;"></div>
        </div>
        <style>
            @keyframes uploadStartFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes uploadAlertBounce {
                0% { transform: scale(0.5) translateY(-30px); opacity: 0; }
                70% { transform: scale(1.08); }
                100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes uploadPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
            }
            @keyframes uploadDot {
                0%, 100% { opacity: 0.4; transform: translateY(0px); }
                50% { opacity: 1; transform: translateY(-15px); }
            }
        </style>
    `;

  overlay.appendChild(alertBox);
  document.body.appendChild(overlay);

  // Auto dismiss after 2.5 seconds
  setTimeout(() => {
    overlay.style.animation = "uploadStartFadeOut 0.4s ease forwards";
    setTimeout(() => overlay.remove(), 400);
  }, 2500);

  // Add fadeOut animation
  const style = document.createElement("style");
  style.textContent = `
        @keyframes uploadStartFadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
  document.head.appendChild(style);
}

// 📌 PINNED UPLOAD PROGRESS ALERT (stays on screen)
let pinnedAlertElement = null;
function showPinnedUploadAlert(filesCount) {
  // Remove existing pinned alert if any
  if (pinnedAlertElement) {
    pinnedAlertElement.remove();
  }

  pinnedAlertElement = document.createElement("div");
  pinnedAlertElement.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 255, 136, 0.1));
        border: 2px solid rgba(0, 212, 255, 0.6);
        border-radius: 20px;
        padding: 20px 35px;
        z-index: 98889;
        box-shadow: 0 10px 40px rgba(0, 212, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(15px);
        display: flex;
        align-items: center;
        gap: 15px;
        animation: pinnedSlideDown 0.4s ease;
        max-width: 600px;
        width: 90%;
    `;

  pinnedAlertElement.innerHTML = `
        <div style="font-size: 28px; animation: pinnedPulse 1.5s ease-in-out infinite;">⬆️</div>
        <div style="flex: 1;">
            <div style="color: #00ffcc; font-weight: 800; font-size: 16px;">🎯 UPLOADING IN PROGRESS</div>
            <div style="color: rgba(255, 255, 255, 0.85); font-size: 13px; margin-top: 3px;">Do not close or refresh • ${filesCount} file${filesCount > 1 ? "s" : ""}</div>
        </div>
        <style>
            @keyframes pinnedSlideDown {
                from { transform: translateX(-50%) translateY(-30px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
            @keyframes pinnedPulse {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
            }
        </style>
    `;

  document.body.appendChild(pinnedAlertElement);
}

// Remove pinned alert
function removePinnedAlert() {
  if (pinnedAlertElement) {
    pinnedAlertElement.style.animation = "pinnedSlideUp 0.3s ease forwards";
    setTimeout(() => {
      if (pinnedAlertElement) {
        pinnedAlertElement.remove();
        pinnedAlertElement = null;
      }
    }, 300);
  }
}

// 🌟 Reusable Local Inline Alert
function showLocalAlert(id, message, type = "error") {
  const box = document.getElementById(id);
  if (!box) return;

  box.textContent = message;
  box.className = `local-alert ${type}`;
  box.style.display = "block";

  // Auto-hide after 4s
  setTimeout(() => {
    box.style.display = "none";
  }, 4000);
}

// ================== File Upload Example ==================
//document.getElementById("uploadBtn").addEventListener("click", () => {
//    const fileInput = document.getElementById("fileInput");
//    // If storage is full, show a friendly error but keep the button clickable
//    const storagePercentEl = document.getElementById("storagePercent");
//    const currentPercent = storagePercentEl ? parseFloat(storagePercentEl.innerText.replace('%', '')) || 0 : 0;
//    if (currentPercent >= 100) {
//        showAlert("🚫 Your storage is full. Please upgrade or delete files before uploading.", "error");
//        return;
//    }
//    if (!fileInput.files.length) {
//        showAlert("⚠️ No files selected!", "warn"); // 🌌 COOL ALERT
//        return;
//    }
//
// Continue upload process here...
//});

// File select & preview
fileInput.addEventListener("change", () => {
  const newFiles = Array.from(fileInput.files);

  // ✅ Merge with already selected files (avoid duplicates)
  selectedFiles = [...selectedFiles, ...newFiles].filter(
    (file, index, self) =>
      index ===
      self.findIndex((f) => f.name === file.name && f.size === file.size),
  );

  // Show cool file selection animation
  if (newFiles.length > 0) {
    const fileAddedNotif = document.createElement("div");
    fileAddedNotif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.5);
            z-index: 9999;
            animation: slideInRight 0.5s ease, shake 0.5s ease 0.2s;
            font-weight: 600;
            font-size: 16px;
        `;
    fileAddedNotif.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 30px; animation: bounce 0.6s ease;">📁</span>
                <div>
                    <div>${newFiles.length} file${newFiles.length > 1 ? "s" : ""} added!</div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 3px;">Total: ${selectedFiles.length} files</div>
                </div>
            </div>
            <style>
                @keyframes slideInRight {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
            </style>
        `;
    document.body.appendChild(fileAddedNotif);
    setTimeout(() => {
      fileAddedNotif.style.animation = "slideOutRight 0.5s ease";
      setTimeout(() => fileAddedNotif.remove(), 500);
    }, 3000);
  }

  updateFileLabel();
  showFilePreview();
});

// ================== DRAG & DROP HANDLER ==================
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("dragover"),
);

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  const newFiles = Array.from(e.dataTransfer.files);

  // ✅ merge without duplicates
  selectedFiles = [...selectedFiles, ...newFiles].filter(
    (file, index, self) =>
      index ===
      self.findIndex((f) => f.name === file.name && f.size === file.size),
  );

  // 🔄 sync input
  const dt = new DataTransfer();
  selectedFiles.forEach((file) => dt.items.add(file));
  fileInput.files = dt.files;

  updateFileLabel();
  showFilePreview();
});

// ✅ Click to browse files
dropZone.addEventListener("click", () => {
  fileInput.click();
});

// ================== LABEL (UPPER PART) ==================
function updateFileLabel() {
  if (!fileLabelText) return; // Safety check

  if (selectedFiles.length === 0) {
    fileLabelText.textContent = "📂 Drag & drop files here or click to browse";
    return;
  }

  if (selectedFiles.length === 1) {
    // single file → truncate nicely
    fileLabelText.textContent = truncateFileName(selectedFiles[0].name, 40);
  } else if (selectedFiles.length <= 3) {
    // 2–3 files → short list
    fileLabelText.textContent = selectedFiles
      .map((f) => truncateFileName(f.name, 25))
      .join(", ");
  } else {
    // more → just show count
    fileLabelText.textContent = `${selectedFiles.length} files selected`;
  }
}

// ================== FILE TYPE ICON HELPER ==================
function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();

  // Documents
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return "📄";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📽️";

  // Archives
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "📦";

  // Code
  if (
    ["js", "py", "java", "cpp", "c", "html", "css", "json", "xml"].includes(ext)
  )
    return "💻";

  // Media
  if (["mp3", "wav", "flac", "m4a", "aac", "ogg"].includes(ext)) return "🎵";
  if (["mp4", "avi", "mkv", "mov", "flv", "wmv", "webm"].includes(ext))
    return "🎬";
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext))
    return "🖼️";

  // Mobile
  if (["apk", "ipa"].includes(ext)) return "📲";

  // Executables
  if (["exe", "msi", "dmg", "sh", "bat"].includes(ext)) return "⚙️";

  // Default
  return "📎";
}

// ================== FILE PREVIEW ==================
function showFilePreview() {
  if (!filePreview) return; // Safety check

  filePreview.innerHTML = "";
  fileCardRefs.clear();
  if (selectedFiles.length === 0) return;

  selectedFiles.forEach((file, index) => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const sizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2);
    const displaySize =
      file.size > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;

    // ✅ truncated preview but full name in tooltip
    const truncatedName = truncateFileName(file.name, 40);
    const fileIcon = getFileIcon(file.name);

    const card = document.createElement("div");
    card.className = "file-card";

    const header = document.createElement("div");
    header.className = "file-header";

    const icon = document.createElement("div");
    icon.className = "file-icon";
    icon.textContent = fileIcon;

    const nameEl = document.createElement("div");
    nameEl.className = "file-name";
    nameEl.title = file.name;
    nameEl.textContent = truncatedName;

    const removeBtn = document.createElement("button");
    removeBtn.className = "file-remove";
    removeBtn.innerHTML = "✖";

    header.appendChild(icon);
    header.appendChild(nameEl);
    header.appendChild(removeBtn);

    const sizeEl = document.createElement("div");
    sizeEl.className = "file-size";
    sizeEl.textContent = displaySize;

    const statusRow = document.createElement("div");
    statusRow.style.display = "flex";
    statusRow.style.justifyContent = "space-between";
    statusRow.style.alignItems = "center";
    statusRow.style.fontSize = "12px";
    statusRow.style.color = "rgba(255,255,255,0.75)";

    const statusText = document.createElement("span");
    statusText.textContent = "Queued";

    const percentText = document.createElement("span");
    percentText.textContent = "0%";

    statusRow.appendChild(statusText);
    statusRow.appendChild(percentText);

    const progress = document.createElement("div");
    progress.className = "file-progress";

    const progressBar = document.createElement("div");
    progressBar.className = "file-progress-bar";
    progressBar.style.width = "0%";
    progressBar.style.background =
      "linear-gradient(90deg,#00c6ff,#00ffb8,#00e5ff,#00b3ff)";
    progressBar.style.backgroundSize = "200% 100%";
    progressBar.style.animation = "progressShimmer 2s linear infinite";
    progress.appendChild(progressBar);

    card.appendChild(header);
    card.appendChild(sizeEl);
    card.appendChild(statusRow);
    card.appendChild(progress);

    removeBtn.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      updateFileLabel();
      showFilePreview();
    });

    const key = getFileKey(file);
    fileCardRefs.set(key, { progressBar, statusText, percentText });

    filePreview.appendChild(card);
  });

  // keep fileInput synced
  const dt = new DataTransfer();
  selectedFiles.forEach((file) => dt.items.add(file));
  fileInput.files = dt.files;
}

// ================== TRUNCATE HELPER ==================
function truncateFileName(name, maxLength = 40) {
  if (name.length <= maxLength) return name;

  const extIndex = name.lastIndexOf(".");
  const ext = extIndex !== -1 ? name.slice(extIndex) : "";
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;

  const keepStart = Math.floor((maxLength - ext.length) * 0.6);
  const keepEnd = maxLength - ext.length - keepStart - 3;

  return base.slice(0, keepStart) + "..." + base.slice(-keepEnd) + ext;
}

// ================== CANCEL BUTTON ==================
cancelBtn.addEventListener("click", () => {
  showConfirmAlert(
    "🗑️ Clear all selected files and cancel uploads?",
    "Clear All",
    () => {
      // Create clear animation
      const clearOverlay = document.createElement("div");
      clearOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;
      clearOverlay.innerHTML = `
            <div style="text-align: center; animation: bounceIn 0.5s ease;">
                <div style="font-size: 100px; animation: spin 0.5s ease;">🗑️</div>
                <h2 style="color: white; font-size: 28px; margin-top: 20px;">Clearing Files...</h2>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        `;
      document.body.appendChild(clearOverlay);

      setTimeout(() => {
        selectedFiles = [];
        syncFileInput();
        filePreview.innerHTML = "";
        progressContainer.innerHTML = "";
        fileLabelText.textContent =
          "📂 Drag & drop files here or click to browse";

        // abort running uploads
        activeUploads.forEach((xhr) => xhr.abort());
        activeUploads = [];

        // 🔓 Reset upload flag
        isUploading = false;
        const uploadBtnReset = document.getElementById("uploadBtn");
        if (uploadBtnReset) uploadBtnReset.disabled = false;

        // 🚫 Remove pinned alert
        removePinnedAlert();

        clearOverlay.remove();
        showAlert("✅ Files cleared successfully!", "success");
      }, 800);
    },
  );
});

// ================== UPLOAD HANDLER ==================
// ================== UPLOAD HANDLER ==================
let isUploading = false; // 🔒 Flag to prevent interruption

// 🔒 Block ALL buttons during upload
function blockAllButtons(blocked = true) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((btn) => {
    if (blocked) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });
}

// 🎨 COOL CUSTOM RELOAD CONFIRMATION MODAL - MATCHES UPLOAD PAGE
function showReloadConfirmation() {
  return new Promise((resolve) => {
    const existing = document.getElementById("reloadConfirmOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "reloadConfirmOverlay";
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.95), rgba(240, 147, 251, 0.95), rgba(245, 87, 108, 0.95), rgba(255, 165, 165, 0.95));
            background-size: 400% 400%;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999 !important;
            animation: gradientShift 15s ease infinite, fadeIn 0.4s ease;
        `;

    const modal = document.createElement("div");
    modal.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 30px;
            padding: 50px 40px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

    modal.innerHTML = `
            <style>
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                
                #reloadConfirmOverlay .reload-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                    animation: pulse 1.5s ease-in-out infinite;
                    display: block;
                }
                #reloadConfirmOverlay .reload-title {
                    font-size: 32px;
                    color: #667eea;
                    font-weight: 900;
                    margin-bottom: 15px;
                    letter-spacing: -1px;
                }
                #reloadConfirmOverlay .reload-message {
                    font-size: 18px;
                    color: #555;
                    margin-bottom: 10px;
                    line-height: 1.6;
                }
                #reloadConfirmOverlay .reload-warning {
                    font-size: 14px;
                    color: #f5576c;
                    margin-top: 20px;
                    padding: 15px;
                    background: rgba(245, 87, 108, 0.1);
                    border-radius: 15px;
                    border-left: 4px solid #f5576c;
                }
                #reloadConfirmOverlay .button-group {
                    display: flex;
                    gap: 15px;
                    margin-top: 30px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                #reloadConfirmOverlay button {
                    padding: 14px 30px;
                    font-size: 16px;
                    font-weight: 700;
                    border: none;
                    border-radius: 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 150px;
                }
                #reloadConfirmOverlay .cancel-btn {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                #reloadConfirmOverlay .cancel-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                }
                #reloadConfirmOverlay .confirm-btn {
                    background: linear-gradient(135deg, #f5576c, #f093fb);
                    color: white;
                    box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
                }
                #reloadConfirmOverlay .confirm-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 20px rgba(245, 87, 108, 0.6);
                }
            </style>

            <div class="reload-icon">⚠️</div>
            <div class="reload-title">Hold On!</div>
            <div class="reload-message">Your upload is still in progress</div>
            <div class="reload-message" style="font-weight: 700; color: #f5576c;">
                Leaving will cancel your upload!
            </div>
            <div class="reload-warning">
                📤 Please wait for the upload to complete before leaving
            </div>
            
            <div class="button-group">
                <button class="cancel-btn" id="stayBtn">⬅️ Stay Here</button>
                <button class="confirm-btn" id="leaveBtn">🚪 Leave Anyway</button>
            </div>
        `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.querySelector("#stayBtn").addEventListener("click", (e) => {
      e.preventDefault();
      overlay.remove();
      resolve(false);
    });

    overlay.querySelector("#leaveBtn").addEventListener("click", (e) => {
      e.preventDefault();
      overlay.remove();
      resolve(true);
    });
  });
}

// 🔒 Intercept F5 / Ctrl+R / Cmd+R during upload
document.addEventListener("keydown", async (e) => {
  if (!isUploading) return;

  // F5 or Ctrl+R (Windows) or Cmd+R (Mac)
  if (
    e.key === "F5" ||
    (e.ctrlKey && e.key === "r") ||
    (e.metaKey && e.key === "r")
  ) {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await showReloadConfirmation();
    if (confirmed) {
      isUploading = false;
      location.reload();
    }
  }
});

// 🔒 Intercept link clicks during upload - SHOW CUSTOM MODAL ONLY
document.addEventListener(
  "click",
  async (e) => {
    if (!isUploading) return;

    const link = e.target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        e.preventDefault();
        e.stopPropagation();
        const confirmed = await showReloadConfirmation();
        if (confirmed) {
          isUploading = false;
          window.location.href = href;
        }
      }
    }
  },
  true,
);

// 🔒 Intercept form submissions during upload
document.addEventListener(
  "submit",
  async (e) => {
    if (!isUploading) return;

    e.preventDefault();
    e.stopPropagation();
    const confirmed = await showReloadConfirmation();
    if (confirmed) {
      isUploading = false;
      e.target.submit();
    }
  },
  true,
);

// 🔒 Fallback: Only for edge cases (back button, etc) - minimal browser alert
window.addEventListener("beforeunload", (e) => {
  if (isUploading) {
    e.preventDefault();
    e.returnValue = "⚠️ Upload in progress!";
  }
});

document.getElementById("uploadBtn").addEventListener("click", async () => {
  // 🔒 Prevent upload if already uploading
  if (isUploading) {
    showAlert("⏳ Upload already in progress! Please wait...", "warn");
    return;
  }

  try {
    // 🚫 Block upload early if storage is full — show requested message
    const storagePercentEl = document.getElementById("storagePercent");
    const currentPercent = storagePercentEl
      ? parseFloat(storagePercentEl.innerText.replace("%", "")) || 0
      : 0;
    if (currentPercent >= 100) {
      showAlert("storage is full upgrade your plan", "error");
      return;
    }

    // Then require login
    const email = localStorage.getItem("email");
    if (!email) {
      showAlert("⚠️ Please login first!", "warn");
      window.location.href = "login.html";
      return;
    }

    if (selectedFiles.length === 0) {
      showAlert("⚠️ No files selected!", "warn");
      return;
    }

    // 🚀 Mark upload as started - prevent interruption
    isUploading = true;
    blockAllButtons(true); // 🔒 Block ALL buttons

    // 🎨 COOL UPLOAD STARTED ANIMATION ALERT
    showUploadStartedAlert(selectedFiles.length);

    // 📌 Show pinned upload alert
    setTimeout(() => {
      showPinnedUploadAlert(selectedFiles.length);
    }, 800);

    progressContainer.innerHTML = "";
    progressContainer.classList.remove("hidden");

    // 🌟 Enhanced Title Section
    const titleSection = document.createElement("div");
    titleSection.style.marginBottom = "20px";
    titleSection.style.textAlign = "center";
    titleSection.innerHTML = `
        <div style="font-size: 24px; color: #00e5ff; font-weight: 800; margin-bottom: 10px; text-shadow: 0 0 20px rgba(0,229,255,0.6);">
            🚀 Uploading Your Files
        </div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.7);">
            Please wait while we upload your files to the cloud ☁️
        </div>
    `;
    progressContainer.appendChild(titleSection);

    // 🌍 Global progress bar
    const globalWrapper = document.createElement("div");
    globalWrapper.style.marginBottom = "20px";

    const globalBar = document.createElement("div");
    globalBar.style.width = "100%";
    globalBar.style.height = "40px";
    globalBar.style.borderRadius = "20px";
    globalBar.style.background = "rgba(0,0,0,0.6)";
    globalBar.style.overflow = "visible";
    globalBar.style.boxShadow = "inset 0 4px 8px rgba(0,0,0,0.4)";
    globalBar.style.border = "2px solid rgba(0,255,255,0.2)";
    globalBar.style.position = "relative";

    const globalFill = document.createElement("div");
    globalFill.style.height = "100%";
    globalFill.style.width = "0%";
    globalFill.style.background =
      "linear-gradient(90deg, #00c6ff, #00ffb8, #00e5ff, #00b3ff)";
    globalFill.style.backgroundSize = "200% 100%";
    globalFill.style.transition = "width 0.3s ease";
    globalFill.style.borderRadius = "18px";
    globalFill.style.boxShadow =
      "0 0 25px rgba(0,229,255,0.8), inset 0 2px 10px rgba(255,255,255,0.3)";
    globalFill.style.animation = "progressShimmer 2s linear infinite";
    globalFill.style.position = "relative";
    globalFill.style.overflow = "hidden";

    // Add sweep effect
    const sweepEffect = document.createElement("div");
    sweepEffect.style.position = "absolute";
    sweepEffect.style.top = "0";
    sweepEffect.style.left = "-100%";
    sweepEffect.style.width = "100%";
    sweepEffect.style.height = "100%";
    sweepEffect.style.background =
      "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)";
    sweepEffect.style.animation = "progressSweep 1.5s ease-in-out infinite";
    globalFill.appendChild(sweepEffect);

    // Percentage text inside bar
    const percentText = document.createElement("div");
    percentText.style.position = "absolute";
    percentText.style.top = "50%";
    percentText.style.left = "50%";
    percentText.style.transform = "translate(-50%, -50%)";
    percentText.style.fontSize = "20px";
    percentText.style.fontWeight = "800";
    percentText.style.color = "#fff";
    percentText.style.textShadow = "0 2px 4px rgba(0,0,0,0.8)";
    percentText.style.zIndex = "10";
    percentText.textContent = "0%";
    globalBar.appendChild(percentText);

    globalBar.appendChild(globalFill);
    globalWrapper.appendChild(globalBar);
    progressContainer.appendChild(globalWrapper);

    const status = document.createElement("div");
    status.style.marginTop = "15px";
    status.style.color = "#00e5ff";
    status.style.fontFamily = "'Courier New', monospace";
    status.style.fontSize = "16px";
    status.style.textAlign = "center";
    status.style.textShadow = "0 0 10px rgba(0,229,255,0.5)";
    status.style.fontWeight = "600";
    progressContainer.appendChild(status);

    // 🎨 Per-file progress list (separate bar for each file)
    const perFileSection = document.createElement("div");
    perFileSection.style.marginBottom = "25px";
    perFileSection.style.padding = "16px";
    perFileSection.style.background = "rgba(0,0,0,0.45)";
    perFileSection.style.borderRadius = "16px";
    perFileSection.style.border = "1px solid rgba(0,255,255,0.25)";
    perFileSection.style.boxShadow = "0 0 20px rgba(0,255,255,0.2)";
    progressContainer.appendChild(perFileSection);

    const perFileTitle = document.createElement("div");
    perFileTitle.textContent = "📁 File Queue";
    perFileTitle.style.fontSize = "14px";
    perFileTitle.style.color = "rgba(255,255,255,0.85)";
    perFileTitle.style.marginBottom = "10px";
    perFileTitle.style.letterSpacing = "0.5px";
    perFileSection.appendChild(perFileTitle);

    const fileProgressRows = selectedFiles.map((file, index) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.padding = "10px 12px";
      row.style.marginBottom = "8px";
      row.style.borderRadius = "12px";
      row.style.background = "rgba(255,255,255,0.04)";
      row.style.border = "1px solid rgba(255,255,255,0.08)";
      row.style.boxShadow = "0 0 12px rgba(0,229,255,0.12) inset";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.gap = "6px";

      const name = document.createElement("div");
      name.style.fontSize = "13px";
      name.style.color = "#fff";
      name.style.fontWeight = "600";
      name.textContent = `${index + 1}. ${truncateFileName(file.name, 48)} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

      const bar = document.createElement("div");
      bar.style.width = "100%";
      bar.style.height = "10px";
      bar.style.borderRadius = "999px";
      bar.style.background = "rgba(0,0,0,0.5)";
      bar.style.overflow = "hidden";
      bar.style.border = "1px solid rgba(0,255,255,0.15)";

      const fill = document.createElement("div");
      fill.style.height = "100%";
      fill.style.width = "0%";
      fill.style.borderRadius = "999px";
      fill.style.background =
        "linear-gradient(90deg,#00c6ff,#00ffb8,#00e5ff,#00b3ff)";
      fill.style.backgroundSize = "200% 100%";
      fill.style.transition = "width 0.2s ease";
      fill.style.animation = "progressShimmer 2s linear infinite";
      bar.appendChild(fill);

      left.appendChild(name);
      left.appendChild(bar);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.flexDirection = "column";
      right.style.alignItems = "flex-end";
      right.style.gap = "4px";

      const percent = document.createElement("div");
      percent.style.fontSize = "12px";
      percent.style.color = "rgba(255,255,255,0.8)";
      percent.textContent = "0%";

      const state = document.createElement("div");
      state.style.fontSize = "11px";
      state.style.color = "rgba(255,255,255,0.55)";
      state.textContent = "Queued";

      right.appendChild(percent);
      right.appendChild(state);

      row.appendChild(left);
      row.appendChild(right);
      perFileSection.appendChild(row);

      // Return refs plus DOM element for later updates
      return { fill, percent, state, dom: row };
    });

    // Add upload complete celebration function
    function showUploadSuccess(filesCount) {
      const successOverlay = document.createElement("div");
      successOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(0, 255, 136, 0.95), rgba(0, 212, 255, 0.95));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            animation: fadeIn 0.3s ease;
        `;
      successOverlay.innerHTML = `
            <div style="text-align: center; animation: bounceIn 0.6s ease;">
                <div style="font-size: 120px; margin-bottom: 20px; animation: celebrate 0.8s ease;">🎉</div>
                <h1 style="color: white; font-size: 48px; font-weight: 900; margin-bottom: 15px; text-shadow: 0 4px 20px rgba(0,0,0,0.3);">Upload Complete!</h1>
                <p style="color: white; font-size: 24px; opacity: 0.9;">${filesCount} file${filesCount > 1 ? "s" : ""} uploaded successfully</p>
                <div style="margin-top: 30px; font-size: 60px; animation: float 2s ease-in-out infinite;">☁️</div>
            </div>
            <style>
                @keyframes celebrate {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.2) rotate(-15deg); }
                    75% { transform: scale(1.2) rotate(15deg); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
            </style>
        `;
      document.body.appendChild(successOverlay);
      // Confetti burst
      const confettiColors = [
        "#FFC700",
        "#FF4B4B",
        "#2E3192",
        "#41BBC7",
        "#8BC34A",
        "#FF69B4",
      ];
      for (let i = 0; i < 32; i++) {
        const c = document.createElement("div");
        c.className = "confetti";
        c.style.left = Math.random() * 100 + "%";
        c.style.background =
          confettiColors[Math.floor(Math.random() * confettiColors.length)];
        c.style.transform = `translateY(-20vh) rotate(${Math.random() * 360}deg)`;
        c.style.animationDelay = Math.random() * 0.4 + "s";
        successOverlay.appendChild(c);
        setTimeout(() => c.remove(), 2600);
      }
      setTimeout(() => {
        successOverlay.style.animation = "fadeOut 0.5s ease";
        setTimeout(() => successOverlay.remove(), 500);
      }, 3000);
    }

    function updateFileRow(index, loaded, total, stateText) {
      const rowObj = fileProgressRows[index];
      if (!rowObj) return;
      const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
      rowObj.fill.style.width = pct.toFixed(1) + "%";
      rowObj.percent.textContent = pct.toFixed(1) + "%";
      if (stateText) rowObj.state.textContent = stateText;
      if (pct >= 100) {
        rowObj.fill.style.background =
          "linear-gradient(90deg,#00ff7f,#4caf50,#00ff7f)";
        // Pop a small check badge for feedback
        if (!rowObj._checked) {
          rowObj._checked = true;
          const check = document.createElement("div");
          check.className = "file-check";
          check.textContent = "✅";
          // Append to DOM row if available
          if (rowObj.dom) {
            rowObj.dom.style.position = "relative";
            rowObj.dom.appendChild(check);
            // Remove after pop animation
            setTimeout(() => {
              check.style.animation = "popOut 0.35s ease forwards";
              setTimeout(() => check.remove(), 360);
            }, 900);
          } else {
            console.warn("Missing DOM for file row index", index);
          }
        }
      }
    }

    function updateFileCardProgress(file, loaded, total, stateText) {
      const key = getFileKey(file);
      const refs = fileCardRefs.get(key);
      if (!refs) return;
      const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
      refs.progressBar.style.width = pct.toFixed(1) + "%";
      refs.percentText.textContent = pct.toFixed(1) + "%";
      if (stateText) refs.statusText.textContent = stateText;
      if (pct >= 100) {
        refs.progressBar.style.background =
          "linear-gradient(90deg,#00ff7f,#4caf50,#00ff7f)";
      }
    }

    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    let uploadedBytes = 0;
    const startTime = Date.now();

    // � Current File Progress Section
    const currentFileSection = document.createElement("div");
    currentFileSection.style.marginBottom = "25px";
    currentFileSection.style.padding = "20px";
    currentFileSection.style.background = "rgba(0,0,0,0.4)";
    currentFileSection.style.borderRadius = "15px";
    currentFileSection.style.border = "2px solid rgba(102, 126, 234, 0.4)";
    currentFileSection.style.boxShadow = "0 0 20px rgba(102, 126, 234, 0.3)";
    currentFileSection.style.animation = "filePulse 2s ease-in-out infinite";
    progressContainer.appendChild(currentFileSection);

    // Add pulse animation
    if (!document.getElementById("filePulseStyle")) {
      const pulseStyle = document.createElement("style");
      pulseStyle.id = "filePulseStyle";
      pulseStyle.textContent = `
            @keyframes filePulse {
                0%, 100% { 
                    box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
                    border-color: rgba(102, 126, 234, 0.4);
                }
                50% { 
                    box-shadow: 0 0 30px rgba(102, 126, 234, 0.6);
                    border-color: rgba(102, 126, 234, 0.7);
                }
            }
        `;
      document.head.appendChild(pulseStyle);
    }

    const currentFileName = document.createElement("div");
    currentFileName.style.fontSize = "16px";
    currentFileName.style.color = "#fff";
    currentFileName.style.marginBottom = "12px";
    currentFileName.style.fontWeight = "600";
    currentFileName.style.textAlign = "center";
    currentFileName.innerHTML = "⏳ Preparing files...";
    currentFileSection.appendChild(currentFileName);

    const currentFileBar = document.createElement("div");
    currentFileBar.style.width = "100%";
    currentFileBar.style.height = "30px";
    currentFileBar.style.borderRadius = "15px";
    currentFileBar.style.background = "rgba(0,0,0,0.6)";
    currentFileBar.style.overflow = "visible";
    currentFileBar.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.4)";
    currentFileBar.style.border = "1px solid rgba(255,255,255,0.2)";
    currentFileBar.style.position = "relative";

    const currentFileFill = document.createElement("div");
    currentFileFill.style.height = "100%";
    currentFileFill.style.width = "0%";
    currentFileFill.style.background =
      "linear-gradient(90deg, #00c6ff, #00ffb8, #00e5ff, #00b3ff)";
    currentFileFill.style.backgroundSize = "200% 100%";
    currentFileFill.style.transition = "width 0.3s ease";
    currentFileFill.style.borderRadius = "13px";
    currentFileFill.style.boxShadow = "0 0 20px rgba(102,126,234,0.6)";
    currentFileFill.style.animation = "progressShimmer 2s linear infinite";

    const currentFilePercent = document.createElement("div");
    currentFilePercent.style.position = "absolute";
    currentFilePercent.style.top = "50%";
    currentFilePercent.style.left = "50%";
    currentFilePercent.style.transform = "translate(-50%, -50%)";
    currentFilePercent.style.fontSize = "14px";
    currentFilePercent.style.fontWeight = "700";
    currentFilePercent.style.color = "#fff";
    currentFilePercent.style.textShadow = "0 1px 3px rgba(0,0,0,0.8)";
    currentFilePercent.textContent = "0%";
    currentFileBar.appendChild(currentFilePercent);

    currentFileBar.appendChild(currentFileFill);
    currentFileSection.appendChild(currentFileBar);

    const currentFileInfo = document.createElement("div");
    currentFileInfo.style.marginTop = "10px";
    currentFileInfo.style.fontSize = "13px";
    currentFileInfo.style.color = "rgba(255,255,255,0.7)";
    currentFileInfo.style.textAlign = "center";
    currentFileSection.appendChild(currentFileInfo);

    // 🔄 Optimized progress updater with requestAnimationFrame
    let lastUpdateTime = 0;
    let animationFrameId = null;
    let pendingUpdate = null;

    function updateGlobalProgress(extraBytes = 0) {
      const uploaded = uploadedBytes + extraBytes;
      const percent = (uploaded / totalSize) * 100;

      // Cancel pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Always update width immediately (fastest operation)
      globalFill.style.width = percent.toFixed(1) + "%";
      percentText.textContent = percent.toFixed(1) + "%";

      // Store pending update
      pendingUpdate = { uploaded, percent };

      // Schedule expensive updates with requestAnimationFrame
      animationFrameId = requestAnimationFrame(() => {
        const now = Date.now();
        if (now - lastUpdateTime > 150) {
          // Increased throttle to 150ms
          lastUpdateTime = now;

          if (pendingUpdate) {
            const { uploaded, percent } = pendingUpdate;
            const elapsedSec = (now - startTime) / 1000;
            const speed =
              elapsedSec > 0
                ? (uploaded / 1024 / 1024 / elapsedSec).toFixed(1)
                : "0.0";
            const eta = calculateETA(totalSize, uploaded, elapsedSec);

            // Update color only when crossing thresholds
            const currentBg = globalFill.style.background;
            let newBg;
            newBg =
              "linear-gradient(90deg, #00c6ff, #00ffb8, #00e5ff, #00b3ff)";
            if (currentBg !== newBg) {
              globalFill.style.background = newBg;
              globalFill.style.backgroundSize = "200% 100%";
            }

            // Single innerHTML update with all text
            status.innerHTML = `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:15px"><span>📊 <strong>${percent.toFixed(1)}%</strong></span><span>⚡ <strong>${speed} MB/s</strong></span><span>⏱️ <strong>${eta}</strong></span><span>📦 <strong>${(uploaded / 1048576).toFixed(1)}</strong>/<strong>${(totalSize / 1048576).toFixed(1)} MB</strong></span></div>`;

            pendingUpdate = null;
          }
        }
      });
    }

    // 🔄 Process files sequentially
    for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
      const file = selectedFiles[fileIndex];

      // Update current file display
      currentFileName.innerHTML = `📄 Uploading: <strong>${truncateFileName(file.name, 50)}</strong> (${(file.size / 1024 / 1024).toFixed(2)} MB) - File ${fileIndex + 1}/${selectedFiles.length}`;
      currentFileFill.style.width = "0%";
      currentFilePercent.textContent = "0%";
      currentFileInfo.textContent = "Preparing...";
      updateFileRow(fileIndex, 0, file.size, "Uploading");
      updateFileCardProgress(file, 0, file.size, "Uploading");

      if (file.size < 2 * 1024 * 1024 * 1024) {
        // ✅ < 2GB normal upload
        await new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append("files", file); // ✅ correct field name (matches server.js)
          formData.append("uploadedBy", email);

          const xhr = new XMLHttpRequest();
          activeUploads.push(xhr); // ✅ track this upload
          xhr.open("POST", `${API}/upload`, true);
          xhr.setRequestHeader("x-user", email);

          const fileStartTime = Date.now();
          let lastFileUpdateTime = 0;
          let lastFilePercent = 0;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const now = Date.now();
              const filePercent = ((e.loaded / file.size) * 100).toFixed(1);

              // Always update bar width (fast)
              currentFileFill.style.width = filePercent + "%";
              currentFilePercent.textContent = filePercent + "%";

              // Throttle info text updates (expensive) - only every 300ms or 5% change
              const percentDiff = Math.abs(filePercent - lastFilePercent);
              if (now - lastFileUpdateTime > 300 || percentDiff >= 5) {
                lastFileUpdateTime = now;
                lastFilePercent = filePercent;

                const fileElapsed = (now - fileStartTime) / 1000;
                if (fileElapsed > 0) {
                  const fileSpeed = (e.loaded / 1048576 / fileElapsed).toFixed(
                    1,
                  );
                  const fileEta = calculateETA(
                    file.size,
                    e.loaded,
                    fileElapsed,
                  );
                  currentFileInfo.textContent = `⚡ ${fileSpeed} MB/s | ⏱️ ${fileEta}`;
                }
              }

              updateGlobalProgress(e.loaded);
              updateFileRow(fileIndex, e.loaded, file.size, "Uploading");
              updateFileCardProgress(file, e.loaded, file.size, "Uploading");
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              uploadedBytes += file.size;
              currentFileFill.style.width = "100%";
              currentFilePercent.textContent = "100%";
              currentFileFill.style.background =
                "linear-gradient(90deg, #00ff7f, #4caf50, #00ff7f)";
              currentFileInfo.innerHTML = "✅ Complete!";
              updateGlobalProgress();
              updateFileRow(fileIndex, file.size, file.size, "✅ Done");
              updateFileCardProgress(file, file.size, file.size, "✅ Done");
              setTimeout(resolve, 300);
            } else reject(xhr.responseText);
          };

          xhr.onerror = () => {
            updateFileRow(fileIndex, 0, file.size, "❌ Failed");
            updateFileCardProgress(file, 0, file.size, "❌ Failed");
            reject("❌ Upload failed");
          };
          xhr.send(formData);
        });
      } else {
        // ✅ ≥ 2GB chunked upload
        currentFileInfo.textContent = "Large file - using chunked upload...";

        const CHUNK_SIZE = 80 * 1024 * 1024; // 80 MB chunks
        const MAX_CONCURRENCY = 4; // 4 parallel uploads
        const fileId =
          Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let currentChunk = 0;
        let fileUploadedBytes = 0;

        // 📂 File wrapper
        const fileWrapper = document.createElement("div");
        fileWrapper.style.margin = "20px 0";
        fileWrapper.style.padding = "12px";
        fileWrapper.style.borderRadius = "12px";
        fileWrapper.style.background = "rgba(0,0,0,0.5)";
        fileWrapper.style.boxShadow = "0 0 20px rgba(0,255,255,0.3)";
        progressContainer.appendChild(fileWrapper);

        // 📂 File label + collapse button
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.cursor = "pointer";
        fileWrapper.appendChild(header);

        const fileLabel = document.createElement("div");
        fileLabel.textContent = `📂 ${file.name} (${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB)`;
        fileLabel.style.fontSize = "14px";
        fileLabel.style.color = "#00e5ff";
        header.appendChild(fileLabel);

        const toggleBtn = document.createElement("span");
        toggleBtn.textContent = "🔽";
        toggleBtn.style.color = "#ff9800";
        toggleBtn.style.fontSize = "14px";
        header.appendChild(toggleBtn);

        // 📦 Scrollable chunk container
        const scrollBox = document.createElement("div");
        scrollBox.style.maxHeight = "220px";
        scrollBox.style.overflowY = "auto";
        scrollBox.style.marginTop = "8px";
        scrollBox.style.border = "1px solid rgba(0,255,255,0.2)";
        scrollBox.style.padding = "6px";
        scrollBox.style.borderRadius = "8px";
        scrollBox.style.background = "rgba(10,25,47,0.85)";
        fileWrapper.appendChild(scrollBox);

        // collapse/expand
        let collapsed = false;
        header.onclick = () => {
          collapsed = !collapsed;
          scrollBox.style.display = collapsed ? "none" : "block";
          toggleBtn.textContent = collapsed ? "▶️" : "🔽";
        };

        // 📊 Per-chunk bars + labels
        const chunkBars = [];
        const chunkLabels = [];
        for (let i = 0; i < totalChunks; i++) {
          const wrapper = document.createElement("div");
          wrapper.style.display = "flex";
          wrapper.style.alignItems = "center";
          wrapper.style.justifyContent = "space-between";
          wrapper.style.marginBottom = "8px";
          wrapper.style.padding = "4px 6px";
          wrapper.style.borderRadius = "6px";
          wrapper.style.background = "rgba(255,255,255,0.05)";
          wrapper.style.boxShadow = "0 0 6px rgba(0,255,255,0.15) inset";

          // Label
          const label = document.createElement("span");
          label.style.fontSize = "12px";
          label.style.color = "#00e5ff";
          label.style.flex = "1";
          label.textContent = `Chunk ${i + 1}/${totalChunks}: Waiting...`;
          wrapper.appendChild(label);
          chunkLabels.push(label);

          // Progress bar
          const bar = document.createElement("div");
          bar.style.width = "220px";
          bar.style.height = "10px";
          bar.style.background = "rgba(255,255,255,0.1)";
          bar.style.borderRadius = "5px";
          bar.style.overflow = "hidden";
          bar.style.boxShadow = "0 0 8px rgba(0,255,255,0.3) inset";

          const fill = document.createElement("div");
          fill.style.height = "100%";
          fill.style.width = "0%";
          fill.style.background =
            "linear-gradient(90deg,#00c6ff,#00ffb8,#00e5ff)";
          fill.style.transition = "width 0.2s linear, background 0.3s";

          bar.appendChild(fill);
          wrapper.appendChild(bar);

          scrollBox.appendChild(wrapper);
          chunkBars.push(fill);
        }

        // 🔄 Upload single chunk
        async function uploadChunk(i) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunk = file.slice(start, end);
          const chunkSize = end - start;
          const chunkStartTime = Date.now();

          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("fileId", fileId);
          formData.append("chunkIndex", i); // ✅ always 0-based
          formData.append("uploadedBy", email);

          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            activeUploads.push(xhr); // ✅ track this upload
            xhr.open(
              "POST",
              `${API}/upload-chunk?fileId=${fileId}&chunkIndex=${i}`, // ✅ keep 0-based
              true,
            );
            xhr.setRequestHeader("x-user", email);

            let lastChunkUpdateTime = 0;
            let lastChunkPercent = 0;

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const now = Date.now();
                const percent = ((e.loaded / chunkSize) * 100).toFixed(1);

                // Always update bar width
                chunkBars[i].style.width = percent + "%";

                // Throttle text updates - only every 300ms or 10% change
                const percentDiff = Math.abs(percent - lastChunkPercent);
                if (now - lastChunkUpdateTime > 300 || percentDiff >= 10) {
                  lastChunkUpdateTime = now;
                  lastChunkPercent = percent;

                  const elapsed = (now - chunkStartTime) / 1000;
                  if (elapsed > 0) {
                    const speed = (e.loaded / 1048576 / elapsed).toFixed(1);
                    const eta = calculateETA(chunkSize, e.loaded, elapsed);
                    chunkLabels[i].textContent =
                      `Chunk ${i}/${totalChunks - 1}: ${percent}% | ${speed} MB/s`;

                    // Update current file progress
                    const filePercent = (
                      ((fileUploadedBytes + e.loaded) / file.size) *
                      100
                    ).toFixed(1);
                    currentFileFill.style.width = filePercent + "%";
                    currentFilePercent.textContent = filePercent + "%";
                    currentFileInfo.textContent = `Chunk ${i + 1}/${totalChunks} - ${speed} MB/s`;
                    updateFileRow(
                      fileIndex,
                      fileUploadedBytes + e.loaded,
                      file.size,
                      `Uploading (${i + 1}/${totalChunks})`,
                    );
                    updateFileCardProgress(
                      file,
                      fileUploadedBytes + e.loaded,
                      file.size,
                      `Uploading (${i + 1}/${totalChunks})`,
                    );
                  }
                }

                updateGlobalProgress(e.loaded);
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200) {
                uploadedBytes += chunkSize;
                fileUploadedBytes += chunkSize;
                chunkBars[i].style.width = "100%";
                chunkBars[i].style.background =
                  "linear-gradient(90deg,#00ff7f,#4caf50)";
                chunkLabels[i].textContent =
                  `Chunk ${i}/${totalChunks - 1}: ✅ Done (${(chunkSize / 1024 / 1024).toFixed(1)} MB)`;
                updateGlobalProgress();
                resolve();
              } else {
                chunkBars[i].style.background =
                  "linear-gradient(90deg,#ff1744,#d50000)";
                chunkLabels[i].textContent =
                  `Chunk ${i}/${totalChunks - 1}: ❌ Failed`;
                reject("❌ Chunk " + i + " failed");
              }
            };

            xhr.onerror = () => {
              chunkBars[i].style.background =
                "linear-gradient(90deg,#ff1744,#d50000)";
              chunkLabels[i].textContent =
                `Chunk ${i}/${totalChunks - 1}: ❌ Network error`;
              updateFileRow(
                fileIndex,
                fileUploadedBytes,
                file.size,
                "❌ Failed",
              );
              updateFileCardProgress(
                file,
                fileUploadedBytes,
                file.size,
                "❌ Failed",
              );
              reject("❌ Network error on chunk " + i);
            };

            xhr.send(formData);
          });
        }

        // 🚀 Upload in parallel batches
        while (currentChunk < totalChunks) {
          const batch = [];
          for (
            let j = 0;
            j < MAX_CONCURRENCY && currentChunk < totalChunks;
            j++
          ) {
            batch.push(uploadChunk(currentChunk)); // ✅ starts from 0
            currentChunk++;
          }
          try {
            await Promise.all(batch);
          } catch (err) {
            status.textContent = err;
            updateFileRow(fileIndex, fileUploadedBytes, file.size, "❌ Failed");
            updateFileCardProgress(
              file,
              fileUploadedBytes,
              file.size,
              "❌ Failed",
            );
            return;
          }
        }

        // 🔄 Merge after all chunks
        currentFileInfo.textContent = "🔄 Merging chunks...";
        currentFileFill.style.width = "100%";
        currentFilePercent.textContent = "100%";

        const mergeRes = await fetch(`${API}/merge-chunks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user": email },
          body: JSON.stringify({
            fileId,
            fileName: file.name,
            uploadedBy: email,
          }),
        });
        const mergeData = await mergeRes.json();
        if (mergeRes.ok && mergeData.file) {
          currentFileFill.style.background =
            "linear-gradient(90deg, #00ff7f, #4caf50, #00ff7f)";
          currentFileInfo.innerHTML = "✅ Complete!";
          status.textContent = `✅ ${file.name} uploaded & merged!`;
          updateFileRow(fileIndex, file.size, file.size, "✅ Done");
          updateFileCardProgress(file, file.size, file.size, "✅ Done");
        } else {
          currentFileFill.style.background =
            "linear-gradient(90deg, #ff1744, #d50000, #ff1744)";
          currentFileInfo.innerHTML = "❌ Merge failed!";
          status.textContent =
            "❌ Merge failed: " + (mergeData.error || "Unknown error");
          updateFileRow(fileIndex, fileUploadedBytes, file.size, "❌ Failed");
          updateFileCardProgress(
            file,
            fileUploadedBytes,
            file.size,
            "❌ Failed",
          );
          return;
        }
      }
    }

    // 🎉 Success Animation
    globalFill.style.width = "100%";
    percentText.textContent = "100%";
    globalFill.style.background =
      "linear-gradient(90deg, #00ff7f, #4caf50, #00ff7f)";
    globalFill.style.backgroundSize = "200% 100%";

    // 🚫 Remove pinned alert when upload completes
    removePinnedAlert();

    status.innerHTML = `
        <div style="font-size: 24px; color: #00ff7f; font-weight: 800; text-shadow: 0 0 20px rgba(0,255,127,0.8); margin-top: 20px; animation: bounce 0.5s ease;">
            ✅ All files uploaded successfully! 🎉
        </div>
        <div style="font-size: 16px; color: rgba(255,255,255,0.8); margin-top: 10px;">
            Updating coin balance...
        </div>
    `;

    // Add bounce animation
    const style = document.createElement("style");
    style.textContent = `
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);

    // Wait a moment for server to process coins, then reload coin balance to show any awarded coins
    await new Promise((resolve) => setTimeout(resolve, 500));
    const coinBalanceDisplay = document.getElementById("coinDisplay");
    const coinsBefore = coinBalanceDisplay
      ? parseInt(coinBalanceDisplay.textContent.replace(/,/g, ""))
      : 0;

    if (typeof loadCoinBalance === "function") {
      await loadCoinBalance();
    } else {
      console.warn("loadCoinBalance not available");
    }

    const coinsAfter = coinBalanceDisplay
      ? parseInt(coinBalanceDisplay.textContent.replace(/,/g, ""))
      : 0;
    const coinsAwarded = coinsAfter - coinsBefore;
    const coinMessage =
      coinsAwarded > 0
        ? `🪙 +${coinsAwarded} coins awarded!`
        : `Keep uploading to reach coin milestones (400 files = 200 coins)`;

    // Show cool success animation
    showUploadSuccess(selectedFiles.length);

    // Update status message before redirect
    status.innerHTML = `
        <div style="font-size: 24px; color: #00ff7f; font-weight: 800; text-shadow: 0 0 20px rgba(0,255,127,0.8); margin-top: 20px; animation: bounce 0.5s ease;">
            ✅ All files uploaded successfully! 🎉
        </div>
        <div style="font-size: 16px; color: rgba(255,255,255,0.8); margin-top: 10px;">
            ${coinMessage}
        </div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 8px;">
            Redirecting to your files...
        </div>
    `;

    // 🔓 Reset upload flag to allow new uploads
    isUploading = false;
    blockAllButtons(false); // 🔓 Unblock ALL buttons

    setTimeout(() => (window.location.href = "files.html"), 3000);
  } catch (error) {
    // 🔓 Reset upload flag on error
    isUploading = false;
    blockAllButtons(false); // 🔓 Unblock ALL buttons on error

    // 🚫 Remove pinned alert on error
    removePinnedAlert();

    // Show error alert
    console.error("Upload error:", error);
    showAlert(`❌ Upload error: ${error.message || error}`, "error");
  }
});

// ✅ Central API fetch wrapper (with block check)
async function apiFetch(endpoint, method = "GET", body = null) {
  const currentToken = localStorage.getItem("token") || token;
  const options = { method, headers: {} };

  // ✅ Only add Authorization header if we have a valid token
  if (currentToken && currentToken !== "null" && currentToken !== "undefined") {
    options.headers["Authorization"] = "Bearer " + currentToken;
  }

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  console.log(`📡 API Request: ${method} ${API}${endpoint}`, {
    token: currentToken ? "✅ Present" : "❌ Missing",
  });
  const res = await fetch(`${API}${endpoint}`, options);
  let data = null;
  try {
    data = await res.clone().json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    const tokenMsg = data?.forceLogoutToken
      ? ` (Code: ${data.forceLogoutToken})`
      : "";
    localStorage.clear();
    showAlert(`⚠️ Session expired. Please login again.${tokenMsg}`, "error");
    window.location.href = "login.html";
    return null;
  }

  if (res.status === 403) {
    if (
      data.forceLogout ||
      data.forceLogoutToken ||
      data.reason === "blocked" ||
      /block|blocked/i.test(data.error || "")
    ) {
      // 🚪 Forced logout / blocked → force logout UI
      localStorage.clear();
      document.body.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;
                    background:rgba(15,32,39,0.95);backdrop-filter: blur(12px);
                    color:#ff4444;display:flex;flex-direction:column;justify-content:center;align-items:center;
                    font-size:24px;font-weight:bold;text-align:center;z-index:99999;">
                    🚪 Session closed<br><br>
                    ${data.forceLogoutToken ? `Code: ${data.forceLogoutToken}<br><br>` : ""}
                    ${data.error || "You have been logged out."}
                </div>`;
      setTimeout(() => (window.location.href = "login.html"), 2000);
      return null;
    }
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

const DEFAULT_PROFILE_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%23667eea' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='60' fill='white'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";

function resolveProfilePicUrl(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return "";
  const value = rawValue.trim();
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }
  if (value.startsWith("/")) return `${API}${value}`;
  return `${API}/${value}`;
}

function applyHeaderProfile(userData = null) {
  const profilePicEl = document.getElementById("profilePic");
  const userNameEl = document.getElementById("userNameHeader");

  const incomingName =
    userData && typeof userData === "object"
      ? userData.username || userData.name || ""
      : "";
  const incomingPic =
    userData && typeof userData === "object" ? userData.profilePic || "" : "";

  const storedEmail = localStorage.getItem("email") || "";
  const fallbackName = storedEmail.includes("@")
    ? storedEmail.split("@")[0]
    : "User";
  const headerName =
    incomingName || localStorage.getItem("username") || fallbackName;

  if (userNameEl) {
    userNameEl.textContent = headerName;
  }

  const resolvedProfilePic =
    resolveProfilePicUrl(incomingPic) ||
    resolveProfilePicUrl(localStorage.getItem("profilePic")) ||
    DEFAULT_PROFILE_AVATAR;

  if (profilePicEl) {
    profilePicEl.src = resolvedProfilePic;
    profilePicEl.onerror = () => {
      profilePicEl.src = DEFAULT_PROFILE_AVATAR;
    };
  }

  if (incomingName) localStorage.setItem("username", incomingName);
  if (incomingPic)
    localStorage.setItem("profilePic", resolveProfilePicUrl(incomingPic));
}

// Check if user has premium plan access (Ultra or Platinum) based on tokens.json
async function checkPremiumPlanAccess() {
  try {
    const uid = localStorage.getItem("uid");
    if (!uid) return;

    const response = await fetch(`${API}/api/check-premium-access/${uid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const switchBtn = document.getElementById("premiumSwitchBtn");
      if (!switchBtn) return;

      // Always send to upgrade page
      switchBtn.style.display = "block";
      switchBtn.onclick = () => {
        window.location.href = "upgrade-form.html";
      };
      switchBtn.innerHTML = "⬆ Upgrade Plan";
    }
  } catch (error) {
    console.error("Error checking premium access:", error);
  }
}

// Auth + Profile
document.addEventListener("DOMContentLoaded", async () => {
  const fromAdmin =
    new URLSearchParams(window.location.search).get("from") === "admin";

  const backToAdminBtn = document.getElementById("backToAdminBtn");
  const adminModeBadge = document.getElementById("adminModeBadge");
  const showAccessBlurOverlay = () => {
    if (document.getElementById("adminAccessBlurOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "adminAccessBlurOverlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(5, 10, 20, 0.38);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      pointer-events: auto;
    `;
    document.body.appendChild(overlay);
  };
  const applyAdminEntryUI = (canSeeAdminBack) => {
    if (!backToAdminBtn) return;
    backToAdminBtn.style.display = canSeeAdminBack ? "inline-flex" : "none";
    if (adminModeBadge) {
      adminModeBadge.style.display = canSeeAdminBack ? "inline-flex" : "none";
    }
  };

  if (backToAdminBtn) {
    applyAdminEntryUI(false);
    backToAdminBtn.addEventListener("click", () => {
      window.location.href = "admin.html";
    });
  }

  const email = localStorage.getItem("email");
  if (!email || !token) {
    showAlert("⚠️ Please login first!", "warn");
    window.location.href = buildLoginRedirectWithReferral();
    return;
  }

  // Check for premium plan token and show switch button if available
  await checkPremiumPlanAccess();

  // Auto-load storage after login
  const userEmail = localStorage.getItem("email");
  if (userEmail) {
    await loadStorage(userEmail);
    await loadUserPlan(userEmail);
    if (typeof loadCoinBalance === "function") await loadCoinBalance();
  }

  // Render cached header identity immediately, then refresh with /me data.
  applyHeaderProfile();

  // ✅ Check if user is still active (blocked users will be kicked)
  const me = await apiFetch("/me");
  if (!me) return; // blocked users already logged out here

  const meUser =
    me && typeof me === "object" && me.user && typeof me.user === "object"
      ? me.user
      : me;
  applyHeaderProfile(meUser);

  const liveRole = String(meUser?.role || "").toLowerCase();
  const canUseAdminEntry =
    fromAdmin && (liveRole === "admin" || liveRole === "superadmin");

  if (fromAdmin && !canUseAdminEntry) {
    applyAdminEntryUI(false);
    showAccessBlurOverlay();
    showAlert("🚫 Admin link only. Access denied for this account.", "error");
    setTimeout(() => {
      window.location.href = "upload.html";
    }, 1200);
    return;
  }

  applyAdminEntryUI(canUseAdminEntry);

  // 🌌 Profile Init
  const profileContainer = document.getElementById("profile-container");
  const profilePic = document.getElementById("profilePic");
  if (profileContainer) profileContainer.style.display = "flex";
  if (profilePic) applyHeaderProfile(meUser);

  // 🚪 Logout with confirmation
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      showConfirmAlert("⚠️ Are you sure you want to logout?", "Logout", () => {
        // ✅ User clicked OK
        localStorage.clear();
        showLocalAlert(
          "profileAlert",
          "✅ Logged out successfully.",
          "success",
        );
        setTimeout(() => (window.location.href = "login.html"), 1200);
      });
    });
  }

  /**
   * Custom Confirm Alert
   * @param {string} message - The message to display
   * @param {string} okText - The text for the OK button
   * @param {function} onConfirm - Function to run if OK is clicked
   */
  function showConfirmAlert(message, okText = "OK", onConfirm) {
    const alertBox = document.createElement("div");
    alertBox.className = "custom-confirm";

    alertBox.innerHTML = `
        <div class="custom-confirm-box">
            <p>${message}</p>
            <div class="confirm-actions">
                <button class="confirm-ok">${okText}</button>
                <button class="confirm-cancel">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(alertBox);

    // Button events
    alertBox.querySelector(".confirm-ok").addEventListener("click", () => {
      onConfirm();
      alertBox.remove();
    });

    alertBox.querySelector(".confirm-cancel").addEventListener("click", () => {
      alertBox.remove();
    });
  }

  // 🎭 Modal Animations (Fixed Version)
  const modal = document.getElementById("profileModal");
  const closeModal = document.getElementById("closeModal"); // ❌ Top-right cross
  const closeProfileBtn = document.getElementById("closeProfileBtn"); // 🔘 Bottom "Close" button
  const saveProfileBtn = document.getElementById("saveProfileBtn");

  // 🧊 Open Modal
  function openModal() {
    if (modal) {
      modal.style.display = "flex";
      modal.classList.remove("fadeOut");
      modal.classList.add("fadeIn", "show");
    }
  }

  // ❄️ Close Modal (with fade animation)
  function closeModalFn() {
    if (modal) {
      modal.classList.remove("fadeIn", "show");
      modal.classList.add("fadeOut");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("fadeOut");
      }, 300);
    }
  }

  // ✅ Connect buttons to the close function
  if (closeModal) {
    closeModal.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModalFn();
    });
  }
  if (closeProfileBtn) {
    closeProfileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModalFn();
    });
  }

  // 📸 Profile Picture Upload Handler
  const profilePicInput = document.getElementById("profilePicInput");
  const modalPic = document.getElementById("modalPic");

  if (modalPic && profilePicInput) {
    modalPic.style.cursor = "pointer";
    modalPic.addEventListener("click", () => profilePicInput.click());

    profilePicInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showAlert("❌ Please select an image file", "error");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showAlert("❌ Image must be less than 5MB", "error");
        return;
      }

      const formData = new FormData();
      formData.append("profilePic", file);
      formData.append("email", localStorage.getItem("email"));
      formData.append("uid", localStorage.getItem("uid"));

      try {
        const userEmail = localStorage.getItem("email");
        const res = await fetch(
          `${API}/update-profile?email=${encodeURIComponent(userEmail)}`,
          {
            method: "POST",
            headers: {
              "x-user-email": userEmail,
            },
            body: formData,
          },
        );
        const data = await res.json();
        if (res.ok && data.user) {
          const newPicUrl = data.user.profilePic.startsWith("http")
            ? data.user.profilePic
            : API + data.user.profilePic;
          modalPic.src = newPicUrl;
          localStorage.setItem("profilePic", newPicUrl);
          applyHeaderProfile({
            username: localStorage.getItem("username") || "",
            profilePic: newPicUrl,
          });
          // Cool success animation for profile update
          const successDiv = document.createElement("div");
          successDiv.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) scale(0);
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        padding: 40px 60px;
                        border-radius: 25px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                        z-index: 99999;
                        text-align: center;
                        animation: popIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
                    `;
          successDiv.innerHTML = `
                        <div style="font-size: 80px; margin-bottom: 15px; animation: bounce 0.6s ease;">✅</div>
                        <h2 style="color: white; font-size: 28px; font-weight: 700;">Profile Updated!</h2>
                        <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin-top: 10px;">Your profile picture has been updated</p>
                        <style>
                            @keyframes popIn {
                                to { transform: translate(-50%, -50%) scale(1); }
                            }
                            @keyframes bounce {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.2); }
                            }
                        </style>
                    `;
          document.body.appendChild(successDiv);
          setTimeout(() => {
            successDiv.style.animation = "popOut 0.3s ease forwards";
            setTimeout(() => successDiv.remove(), 300);
          }, 2000);
        } else {
          showAlert("❌ Failed to update profile picture", "error");
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
      }
    });
  }

  // ✅ Save Profile Handler
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      const email = localStorage.getItem("email");
      const uid = localStorage.getItem("uid");
      const name = document.getElementById("modalName").value;
      const phone = document.getElementById("modalPhone").value;

      try {
        const res = await fetch(`${API}/update-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, uid, username: name, phone }),
        });
        const data = await res.json();
        if (res.ok) {
          showAlert("✅ Profile updated successfully!", "success");
          localStorage.setItem("username", name);
          localStorage.setItem("phone", phone);
          applyHeaderProfile({ username: name });
          setTimeout(() => closeModalFn(), 1000);
        } else {
          showAlert(
            "❌ " + (data.error || "Failed to update profile"),
            "error",
          );
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
      }
    });
  }

  // 🔐 Password Change Handler
  const showPasswordChange = document.getElementById("showPasswordChange");
  const passwordChangeSection = document.getElementById(
    "passwordChangeSection",
  );
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  if (showPasswordChange && passwordChangeSection) {
    showPasswordChange.addEventListener("click", () => {
      const isVisible = passwordChangeSection.style.display !== "none";
      passwordChangeSection.style.display = isVisible ? "none" : "block";
      showPasswordChange.innerHTML = isVisible
        ? "<span>🔐</span><span>Change Password</span>"
        : "<span>🔼</span><span>Hide Password Change</span>";
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const confirmNewPassword =
        document.getElementById("confirmNewPassword").value;
      const email = localStorage.getItem("email");

      if (!currentPassword || !newPassword || !confirmNewPassword) {
        showAlert("⚠️ Please fill all password fields", "warn");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showAlert("❌ New passwords do not match", "error");
        return;
      }

      if (newPassword.length < 6) {
        showAlert("⚠️ New password must be at least 6 characters", "warn");
        return;
      }

      try {
        const res = await fetch(`${API}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            oldPassword: currentPassword,
            newPassword,
            confirmPassword: confirmNewPassword,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showAlert("✅ Password updated successfully!", "success");
          document.getElementById("currentPassword").value = "";
          document.getElementById("newPassword").value = "";
          document.getElementById("confirmNewPassword").value = "";
          passwordChangeSection.style.display = "none";
          showPasswordChange.innerHTML =
            "<span>🔐</span><span>Change Password</span>";
        } else {
          showAlert(
            "❌ " + (data.error || "Failed to update password"),
            "error",
          );
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
      }
    });
  }

  // (Optional) Allow closing by clicking outside modal
  if (modal) {
    window.addEventListener("click", (e) => {
      if (e.target === modal) closeModalFn();
    });
  }

  // =================== FORGOT PASSWORD WITH CAPTCHA & OTP ===================
  const forgotPasswordModal = document.getElementById("forgotPasswordModal");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const closeForgotPassword = document.getElementById("closeForgotPassword");
  const forgotCaptchaCanvas = document.getElementById("forgotCaptchaCanvas");
  const forgotCaptchaInput = document.getElementById("forgotCaptchaInput");
  const refreshForgotCaptcha = document.getElementById("refreshForgotCaptcha");
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");
  const resendOtpBtn = document.getElementById("resendOtpBtn");
  const resetPasswordBtn = document.getElementById("resetPasswordBtn");

  let forgotCaptchaText = "";
  let forgotOtpToken = "";

  // Generate Captcha
  function generateForgotCaptcha() {
    const ctx = forgotCaptchaCanvas.getContext("2d");
    ctx.clearRect(0, 0, forgotCaptchaCanvas.width, forgotCaptchaCanvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, forgotCaptchaCanvas.width, forgotCaptchaCanvas.height);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    forgotCaptchaText = "";
    for (let i = 0; i < 6; i++) {
      forgotCaptchaText += chars.charAt(
        Math.floor(Math.random() * chars.length),
      );
    }

    ctx.font = "bold 26px monospace";
    ctx.fillStyle = "#00ffcc";
    ctx.fillText(forgotCaptchaText, 10, 30);

    forgotCaptchaInput.value = "";
    sendOtpBtn.disabled = true;
  }

  // Captcha validation
  if (forgotCaptchaInput) {
    forgotCaptchaInput.addEventListener("input", () => {
      if (forgotCaptchaInput.value.toUpperCase() === forgotCaptchaText) {
        sendOtpBtn.disabled = false;
        sendOtpBtn.style.opacity = "1";
      } else {
        sendOtpBtn.disabled = true;
        sendOtpBtn.style.opacity = "0.6";
      }
    });
  }

  if (refreshForgotCaptcha) {
    refreshForgotCaptcha.addEventListener("click", generateForgotCaptcha);
  }

  // Open Forgot Password Modal
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", () => {
      const email = localStorage.getItem("email");
      const uid = localStorage.getItem("uid");
      const phone = localStorage.getItem("phone");

      document.getElementById("forgotUid").value = uid || "N/A";
      document.getElementById("forgotEmail").value = email || "N/A";
      document.getElementById("forgotPhone").value = phone || "N/A";

      document.getElementById("forgotStep1").style.display = "block";
      document.getElementById("forgotStep2").style.display = "none";
      document.getElementById("forgotStep3").style.display = "none";

      generateForgotCaptcha();
      forgotPasswordModal.style.display = "flex";
    });
  }

  // Close Modal
  if (closeForgotPassword) {
    closeForgotPassword.addEventListener("click", () => {
      forgotPasswordModal.style.display = "none";
    });
  }

  // Send OTP
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", async () => {
      const email = localStorage.getItem("email");

      if (forgotCaptchaInput.value.toUpperCase() !== forgotCaptchaText) {
        showAlert("❌ Invalid captcha!", "error");
        return;
      }

      sendOtpBtn.disabled = true;
      sendOtpBtn.innerHTML = "<span>⏳</span><span>Sending OTP...</span>";

      try {
        const res = await fetch(`${API}/send-otp-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (res.ok) {
          forgotOtpToken = data.token;
          showAlert("✅ OTP sent to your email!", "success");
          document.getElementById("forgotStep1").style.display = "none";
          document.getElementById("forgotStep2").style.display = "block";
        } else {
          showAlert("❌ " + (data.error || "Failed to send OTP"), "error");
          sendOtpBtn.disabled = false;
          sendOtpBtn.innerHTML =
            "<span>📧</span><span>Send OTP to Email</span>";
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerHTML = "<span>📧</span><span>Send OTP to Email</span>";
      }
    });
  }

  // Resend OTP
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener("click", () => {
      document.getElementById("forgotStep1").style.display = "block";
      document.getElementById("forgotStep2").style.display = "none";
      generateForgotCaptcha();
    });
  }

  // Verify OTP
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener("click", async () => {
      const otp = document.getElementById("otpInput").value;
      const email = localStorage.getItem("email");

      if (!otp || otp.length !== 6) {
        showAlert("❌ Please enter 6-digit OTP", "error");
        return;
      }

      verifyOtpBtn.disabled = true;
      verifyOtpBtn.innerHTML = "<span>⏳</span><span>Verifying...</span>";

      try {
        const res = await fetch(`${API}/verify-otp-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, token: forgotOtpToken }),
        });

        const data = await res.json();

        if (res.ok) {
          showAlert("✅ OTP verified! Set your new password", "success");
          document.getElementById("forgotStep2").style.display = "none";
          document.getElementById("forgotStep3").style.display = "block";
        } else {
          showAlert("❌ " + (data.error || "Invalid OTP"), "error");
          verifyOtpBtn.disabled = false;
          verifyOtpBtn.innerHTML = "<span>✅</span><span>Verify OTP</span>";
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
        verifyOtpBtn.disabled = false;
        verifyOtpBtn.innerHTML = "<span>✅</span><span>Verify OTP</span>";
      }
    });
  }

  // Reset Password
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener("click", async () => {
      const email = localStorage.getItem("email");
      const newPassword = document.getElementById("forgotNewPassword").value;
      const confirmPassword = document.getElementById(
        "forgotConfirmPassword",
      ).value;

      if (!newPassword || !confirmPassword) {
        showAlert("⚠️ Please fill all fields", "warn");
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert("❌ Passwords do not match", "error");
        return;
      }

      if (newPassword.length < 6) {
        showAlert("⚠️ Password must be at least 6 characters", "warn");
        return;
      }

      resetPasswordBtn.disabled = true;
      resetPasswordBtn.innerHTML = "<span>⏳</span><span>Resetting...</span>";

      try {
        const res = await fetch(`${API}/reset-password-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, newPassword, token: forgotOtpToken }),
        });

        const data = await res.json();

        if (res.ok) {
          showAlert("✅ Password reset successfully!", "success");
          forgotPasswordModal.style.display = "none";
          document.getElementById("forgotNewPassword").value = "";
          document.getElementById("forgotConfirmPassword").value = "";
          document.getElementById("otpInput").value = "";
        } else {
          showAlert(
            "❌ " + (data.error || "Failed to reset password"),
            "error",
          );
          resetPasswordBtn.disabled = false;
          resetPasswordBtn.innerHTML =
            "<span>🔐</span><span>Reset Password</span>";
        }
      } catch (err) {
        showAlert("⚠️ " + err.message, "warn");
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.innerHTML =
          "<span>🔐</span><span>Reset Password</span>";
      }
    });
  }

  async function openProfilePanel() {
    const email = localStorage.getItem("email");
    const uid = localStorage.getItem("uid");
    try {
      const res = await fetch(`${API}/user-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, uid }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const u = data.user;
        document.getElementById("modalPic").src = u.profilePic
          ? u.profilePic.startsWith("http")
            ? u.profilePic
            : API + u.profilePic
          : DEFAULT_PROFILE_AVATAR;
        document.getElementById("modalName").value = u.username || "";
        document.getElementById("modalEmail").value = u.email || "";
        document.getElementById("modalPhone").value = u.phone || "";
        document.getElementById("modalUid").value = u.uid || "";

        applyHeaderProfile(u);

        const profileModal = document.getElementById("profileModal");
        if (profileModal) profileModal.classList.add("show");
      } else {
        showAlert("❌ User not found", "error");
      }
    } catch (err) {
      showAlert("⚠️ Error loading profile", "warn");
    }
  }

  // 🖼️ Show Profile Modal for current user
  profilePic.addEventListener("click", (e) => {
    e.stopPropagation();
    openProfilePanel();
  });

  // ⚙️ Settings Dropdown
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDropdown = document.getElementById("settingsDropdown");
  const profileEditOption = document.getElementById("profileEditOption");
  const friendsOption = document.getElementById("friendsOption");
  const switchPlanOption = document.getElementById("switchPlanOption");
  const supportOption = document.getElementById("supportOption");
  const changePasswordOption = document.getElementById("changePasswordOption");
  const logoutOption = document.getElementById("logoutOption");

  if (settingsBtn && settingsDropdown) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      // Position dropdown below and aligned to right of button
      const rect = settingsBtn.getBoundingClientRect();
      settingsDropdown.style.top = rect.bottom + 10 + "px";
      settingsDropdown.style.left = rect.right - 200 + "px"; // 200 is min-width

      settingsDropdown.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !settingsBtn.contains(e.target) &&
        !settingsDropdown.contains(e.target)
      ) {
        settingsDropdown.classList.remove("show");
      }
    });
  }

  if (profileEditOption) {
    profileEditOption.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");
      openProfilePanel();
    });
  }

  if (friendsOption) {
    friendsOption.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");
      window.location.href = "friends.html";
    });
  }

  if (switchPlanOption) {
    // ✅ Only show Switch Plan button for platinum/ultra users on token upload pages
    if (
      isTokenNormalUploadPage &&
      (currentUserPlan === "platinum" || currentUserPlan === "ultra")
    ) {
      switchPlanOption.style.display = "flex";
      switchPlanOption.innerHTML = `
                <span>💎</span>
                <span>Go to Plan Upload</span>
            `;
    } else {
      switchPlanOption.style.display = "none";
    }
  }

  if (switchPlanOption) {
    switchPlanOption.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");

      if (isTokenNormalUploadPage) {
        const uidForPlan =
          premiumUidFromQuery ||
          sessionStorage.getItem("planSwitchUid") ||
          localStorage.getItem("uid") ||
          "";
        const targetPage = resolvePlanUploadPage(
          planSwitchToken,
          planSwitchHint,
          currentUserPlan,
        );
        const qp = new URLSearchParams();
        if (uidForPlan) qp.set("uid", uidForPlan);
        qp.set("token", planSwitchToken);
        window.location.href = `${targetPage}?${qp.toString()}`;
        return;
      }
      window.location.href = "upgrade-form.html";
    });
  }

  if (supportOption) {
    supportOption.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");
      window.location.href = "support.html";
    });
  }

  if (changePasswordOption) {
    changePasswordOption.addEventListener("click", async (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");
      await openProfilePanel();
      if (resetSection && resetPassBtn) {
        resetSection.style.display = "block";
        resetSection.classList.add("slideIn");
        resetPassBtn.style.display = "none";
      }
    });
  }

  if (logoutOption) {
    logoutOption.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsDropdown.classList.remove("show");
      showConfirmAlert("🚪 Are you sure you want to logout?", "Logout", () => {
        // Create logout animation overlay
        const logoutOverlay = document.createElement("div");
        logoutOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    animation: fadeIn 0.3s ease;
                `;
        logoutOverlay.innerHTML = `
                    <div style="text-align: center; animation: bounceIn 0.5s ease;">
                        <div style="font-size: 80px; margin-bottom: 20px; animation: wave 1s ease infinite;">👋</div>
                        <h2 style="color: white; font-size: 32px; font-weight: 700; margin-bottom: 10px;">Goodbye!</h2>
                        <p style="color: rgba(255,255,255,0.8); font-size: 18px;">Logging you out...</p>
                        <div style="margin-top: 30px;">
                            <div style="width: 60px; height: 60px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; margin: 0 auto; animation: spin 0.8s linear infinite;"></div>
                        </div>
                    </div>
                    <style>
                        @keyframes wave {
                            0%, 100% { transform: rotate(0deg); }
                            25% { transform: rotate(-15deg); }
                            75% { transform: rotate(15deg); }
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes bounceIn {
                            0% { transform: scale(0.3); opacity: 0; }
                            50% { transform: scale(1.05); }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    </style>
                `;
        document.body.appendChild(logoutOverlay);

        // Clear storage and redirect
        setTimeout(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "login.html";
        }, 1500);
      });
    });
  }

  // Friends navigation is now in the settings dropdown only
  // 🔑 Reset Password Section
  const resetSection =
    document.getElementById("passwordChangeSection") ||
    document.getElementById("resetPasswordSection");
  const resetPassBtn =
    document.getElementById("showPasswordChange") ||
    document.getElementById("resetPassBtn");
  const submitResetPassBtn = document.getElementById("submitResetPassBtn");
  const cancelResetPassBtn = document.getElementById("cancelResetPassBtn");

  if (resetPassBtn && resetSection) {
    resetPassBtn.addEventListener("click", () => {
      resetSection.style.display = "block";
      resetSection.classList.add("slideIn");
      resetPassBtn.style.display = "none";
    });
  }

  if (cancelResetPassBtn && resetSection && resetPassBtn) {
    cancelResetPassBtn.addEventListener("click", () => {
      resetSection.style.display = "none";
      resetPassBtn.style.display = "inline-block";
      ["oldPass", "newPass", "confirmPass"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    });
  }

  // ✅ Submit Reset Password
  if (submitResetPassBtn) {
    submitResetPassBtn.addEventListener("click", async () => {
      const oldPass = document.getElementById("oldPass").value;
      const newPass = document.getElementById("newPass").value;
      const confirmPass = document.getElementById("confirmPass").value;
      if (!oldPass || !newPass || !confirmPass) {
        showLocalAlert(
          "resetAlert",
          "⚠️ Please fill all password fields!",
          "warn",
        );
        return;
      }
      if (newPass !== confirmPass) {
        showLocalAlert(
          "resetAlert",
          "❌ New password and confirm password do not match.",
          "error",
        );
        return;
      }
      try {
        showLocalAlert("resetAlert", "⏳ Updating password...", "info");
        const res = await fetch(`${API}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            oldPassword: oldPass,
            newPassword: newPass,
            confirmPassword: confirmPass,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showLocalAlert(
            "resetAlert",
            "✅ Password updated successfully!",
            "success",
          );
          setTimeout(() => cancelResetPassBtn.click(), 1000);
        } else {
          showLocalAlert(
            "resetAlert",
            "❌ " + (data.error || "Failed to reset password"),
            "error",
          );
        }
      } catch (err) {
        showLocalAlert("resetAlert", "⚠️ " + err.message, "warn");
      }
    });
  }
  // ================== Fetch and Show Storage ==================
  async function loadStorage(email) {
    try {
      const res = await fetch(`${API}/storage/${email}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load storage");

      const percent = parseFloat(data.percent) || 0;
      const usedGB = parseFloat(data.usedGB) || 0;
      const maxGB = parseFloat(data.maxGB) || 512;
      const used = data.usedFormatted || "0 B";
      const normalizedPercent = Math.max(0, Math.min(percent, 100));
      const isEmptyUsage = normalizedPercent <= 0.05;

      // Format storage display
      let maxDisplay =
        maxGB >= 1024 ? `${(maxGB / 1024).toFixed(1)} TB` : `${maxGB} GB`;

      // Update circular progress
      const circle =
        document.getElementById("storageCircle") ||
        document.getElementById("storageRing");
      if (circle) {
        const radius = 54;
        const circumference = 2 * Math.PI * radius;
        const offset =
          circumference - (normalizedPercent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
        circle.style.stroke = isEmptyUsage
          ? "rgba(255, 255, 255, 0.28)"
          : "url(#storageGradient)";
      }

      const percentEl = document.getElementById("storagePercent");
      if (percentEl) {
        percentEl.style.color = isEmptyUsage
          ? "rgba(255, 255, 255, 0.82)"
          : "#00ff88";
        percentEl.style.textShadow = isEmptyUsage
          ? "0 0 10px rgba(255, 255, 255, 0.18)"
          : "0 0 15px rgba(0, 255, 136, 0.8)";
      }

      // Update storage display
      document.getElementById("storagePercent").innerText =
        `${normalizedPercent.toFixed(1)}%`;
      document.getElementById("usedStorage").innerText = used;
      const totalStorageEl = document.getElementById("totalStorage");
      if (totalStorageEl) totalStorageEl.innerText = maxDisplay;

      // Update storage bar
      const storageBar = document.getElementById("storageBarFill");
      if (storageBar) {
        storageBar.style.width = `${normalizedPercent}%`;
        storageBar.style.background = isEmptyUsage
          ? "linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.25))"
          : "linear-gradient(90deg, #00d4ff, #00ff88, #00d4ff)";
        storageBar.style.boxShadow = isEmptyUsage
          ? "none"
          : "0 0 20px rgba(0, 255, 136, 0.8)";
        storageBar.style.animation = isEmptyUsage
          ? "none"
          : "shimmer 3s ease-in-out infinite";
      }

      // Update available storage
      const availableStorage = document.getElementById("availableStorage");
      if (availableStorage) {
        const remainingGB = maxGB - usedGB;
        availableStorage.innerText =
          remainingGB >= 1024
            ? `${(remainingGB / 1024).toFixed(1)} TB`
            : `${remainingGB.toFixed(2)} GB`;
      }

      // Keep upload button clickable even when storage is full
      const uploadBtn = document.getElementById("uploadBtn");
      if (uploadBtn) {
        const isFull = normalizedPercent >= 100;
        uploadBtn.disabled = false;
        uploadBtn.classList.remove("disabled");
        uploadBtn.title = isFull
          ? "storage is full upgrade your plan"
          : "Upload files to your cloud";
        storageFull = isFull;

        if (isFull) {
          uploadBtn.style.opacity = "0.85";
        } else {
          uploadBtn.style.opacity = "";
        }
        // Add ripple effect
        uploadBtn.style.position = "relative";
        uploadBtn.addEventListener("pointerdown", function (e) {
          const ripple = document.createElement("span");
          ripple.className = "ripple";
          const rect = this.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height) * 1.2;
          ripple.style.width = ripple.style.height = size + "px";
          ripple.style.left = e.clientX - rect.left - size / 2 + "px";
          ripple.style.top = e.clientY - rect.top - size / 2 + "px";
          this.appendChild(ripple);
          setTimeout(() => ripple.remove(), 700);
        });
      }
    } catch (err) {
      console.error("❌ Storage fetch error:", err);
      const usedStorageEl = document.getElementById("usedStorage");
      if (usedStorageEl) {
        usedStorageEl.innerText = "Error loading";
      }
    }
  }

  // ================== Load User Plan ==================
  async function loadUserPlan(email) {
    try {
      const uid = localStorage.getItem("uid");
      const authToken = localStorage.getItem("token");
      if (!email) return;

      const parsePlanFromPayload = (payload) => {
        if (!payload || typeof payload !== "object") return "free";
        const directPlan = payload.plan;
        const nestedPlan = payload.currentPlan?.plan;
        const finalPlan = String(
          directPlan || nestedPlan || "free",
        ).toLowerCase();
        return finalPlan;
      };

      let data = null;
      let resOk = false;

      // Primary plan endpoint by UID snapshot.
      if (uid) {
        const res = await fetch(`${API}/user-plan/${uid}`);
        data = await res.json();
        resOk = res.ok;
      }

      // Fallback to authenticated email-based endpoint when UID route fails or returns free.
      const initialPlan = parsePlanFromPayload(data);
      if ((!resOk || initialPlan === "free") && authToken) {
        const fallbackRes = await fetch(`${API}/api/user-plan`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (fallbackRes.ok) {
          data = await fallbackRes.json();
          resOk = true;
        }
      }

      const plan = parsePlanFromPayload(data);
      currentUserPlan = plan;

      const upgradeBtn = document.getElementById("upgradeBtn");
      const planBadge =
        document.getElementById("planBadgeText") ||
        document.getElementById("planBadge");

      if (resOk && plan !== "free") {
        // User has a paid plan - show switch button
        if (planBadge) {
          planBadge.textContent = `${plan.toUpperCase()} Plan`;
          planBadge.style.color = "#ffffff";
          planBadge.style.textShadow = "0 0 8px rgba(0,0,0,0.35)";
        }

        if (upgradeBtn) {
          upgradeBtn.innerHTML = "<span>🔄</span><span>Switch Plan</span>";
          upgradeBtn.style.display = "inline-flex";
        }
      } else {
        // User has free plan - show upgrade button
        if (planBadge) planBadge.textContent = "Free Plan";
        currentUserPlan = "free";

        if (upgradeBtn) {
          upgradeBtn.innerHTML = "<span>⭐</span><span>Upgrade Plan</span>";
          upgradeBtn.style.display = "inline-flex";
        }
      }
    } catch (err) {
      console.error("❌ Plan fetch error:", err);
    }
  }

  // ================== Load Coin Balance ==================
  async function loadCoinBalance() {
    try {
      const token = localStorage.getItem("token");
      const coinBalanceDisplay = document.getElementById("coinDisplay");

      if (!token || !coinBalanceDisplay) return;

      const res = await fetch(`${API}/api/coins/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const balance = data.balance || 0;
        coinBalanceDisplay.textContent = balance.toLocaleString();

        // Animate the update
        coinBalanceDisplay.style.animation = "none";
        setTimeout(() => {
          coinBalanceDisplay.style.animation = "coinPulse 0.6s ease-out";
        }, 10);
      } else {
        console.warn(`⚠️ Coin balance endpoint returned ${res.status}`);
        coinBalanceDisplay.textContent = "0";
      }
    } catch (err) {
      console.error("❌ Coin balance fetch error:", err);
      const coinDisplay = document.getElementById("coinDisplay");
      if (coinDisplay) coinDisplay.textContent = "0";
    }
  }

  function getPlanColor(plan) {
    const colors = {
      silver: "linear-gradient(135deg, #c0c0c0, #888888)",
      gold: "linear-gradient(135deg, #ffd700, #ffed4e)",
      platinum: "linear-gradient(135deg, #e5e4e2, #8a8a8a)",
      ultra: "linear-gradient(135deg, #667eea, #764ba2)",
      free: "linear-gradient(135deg, #667eea, #764ba2)",
    };
    return colors[plan.toLowerCase()] || colors["free"];
  }

  async function redirectToPlanWithToken() {
    const uid = localStorage.getItem("uid");

    if (!uid) {
      showAlert("⚠️ Please login again to switch plans.", "warn");
      window.location.href = "upgrade-form.html";
      return;
    }

    // Free users still go to upgrade form
    if (!currentUserPlan || currentUserPlan === "free") {
      window.location.href = "upgrade-form.html";
      return;
    }

    try {
      const res = await fetch(
        `${API}/get-platinum-token/${uid}?plan=${encodeURIComponent(currentUserPlan)}`,
      );
      const data = await res.json();

      if (res.ok && data.token) {
        const targetPage =
          currentUserPlan === "ultra"
            ? "ultra-upload.html"
            : "platinum-ui-upload.html";
        const url = `${targetPage}?token=${encodeURIComponent(data.token)}&uid=${encodeURIComponent(uid)}`;
        window.location.href = url;
      } else {
        showAlert(
          "⚠️ No active plan token found. Please complete your upgrade.",
          "warn",
        );
        window.location.href = "upgrade-form.html";
      }
    } catch (err) {
      console.error("❌ Token fetch error:", err);
      showAlert(
        "⚠️ Unable to fetch your plan token. Please try again.",
        "warn",
      );
      window.location.href = "upgrade-form.html";
    }
  }

  // 💎 Premium Modal Open/Close
  const premiumModal = document.getElementById("premiumModal");
  const closePremium = document.getElementById("closePremium");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const plansGrid = document.getElementById("plansGrid");

  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      if (currentUserPlan && currentUserPlan !== "free") {
        redirectToPlanWithToken();
      } else {
        window.location.href = "upgrade-form.html";
      }
    });
  }

  if (closePremium) {
    closePremium.addEventListener("click", () => {
      if (premiumModal) premiumModal.classList.remove("show");
    });
  }

  if (premiumModal) {
    window.addEventListener("click", (e) => {
      if (e.target === premiumModal) premiumModal.classList.remove("show");
    });
  }

  // ========== AUTO-REFRESH USER DATA (Real-time updates from admin changes) ==========
  let lastUserData = JSON.stringify(me);
  let autoRefreshInterval = setInterval(async () => {
    // Pause auto-refresh when tab is not visible to save requests
    if (document.hidden) return;

    try {
      const updatedMe = await apiFetch("/me");
      if (updatedMe) {
        const currentUserData = JSON.stringify(updatedMe);

        // Check if user data has changed (UI access, storage quota, role, etc.)
        if (currentUserData !== lastUserData) {
          console.log("🔄 User profile updated from admin changes");
          lastUserData = currentUserData;

          // Reload storage and plan to reflect any quota changes
          await loadStorage(updatedMe.email);
          await loadUserPlan(updatedMe.email);

          // Show notification if UI access changed
          if (me.uiAccess !== updatedMe.uiAccess) {
            showAlert(
              `ℹ️ Your UI access has been updated to: ${updatedMe.uiAccess || "default"}`,
              "info",
            );
          }

          // Update local me object
          Object.assign(me, updatedMe);
        }
      }
    } catch (error) {
      console.error("Auto-refresh error:", error);
    }
  }, 15000); // Check every 15 seconds (paused when tab hidden)

  // ========== COIN HISTORY MODAL ==========
  const coinDisplayBtn = document.getElementById("coinDisplay");
  const coinHistoryModal = document.getElementById("coinHistoryModal");
  const closeCoinHistoryBtn = document.getElementById("closeCoinHistoryBtn");
  const coinHistoryList = document.getElementById("coinHistoryList");

  // Fetch and display coin history
  async function loadAndDisplayCoinHistory() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API}/api/coins/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const transactions = Array.isArray(data.transactions)
          ? data.transactions
          : [];

        if (transactions.length === 0) {
          coinHistoryList.innerHTML =
            '<div style="padding: 20px; text-align: center; color: #aaa;">No transaction history yet.</div>';
          return;
        }

        coinHistoryList.innerHTML = transactions
          .slice(0, 24)
          .map((tx) => {
            const amount = Number(tx?.amount || 0);
            const isDebit = amount < 0;
            const absAmount = Math.abs(amount);
            const type = (tx?.type || "transaction").replace(/_/g, " ");
            const reason = tx?.reason || tx?.note || "";
            const timestamp = formatCoinTime(tx?.timestamp || tx?.createdAt);
            const amountColor = isDebit ? "#ff8b8b" : "#9bffcb";
            const sign = isDebit ? "-" : "+";

            return `<div style="padding: 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid rgba(255, 215, 0, 0.16); background: linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,165,0,0.04));">
            <div style="display: flex; justify-content: space-between; gap: 10px; align-items: baseline;">
              <div style="font-size: 12px; color: #f6e8b9; font-weight: 700; text-transform: capitalize;">${type}</div>
              <div style="font-size: 13px; font-weight: 800; color: ${amountColor};">${sign}${absAmount.toLocaleString()} coins</div>
            </div>
            ${reason ? `<div style="font-size: 11px; color: #e6d9ad; margin-top: 4px;">${reason}</div>` : ""}
            <div style="font-size: 10px; color: #c0b081; margin-top: 4px;">${timestamp}</div>
          </div>`;
          })
          .join("");
      }
    } catch (err) {
      console.error("Failed to load coin history:", err);
      coinHistoryList.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #ff8b8b;">Failed to load history.</div>';
    }
  }

  function formatCoinTime(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    return `${day}/${month}/${year}, ${displayHours}:${minutes}:${seconds} ${period}`;
  }

  // Event listeners for coin history modal
  if (coinDisplayBtn) {
    coinDisplayBtn.addEventListener("click", async () => {
      if (coinHistoryModal) {
        coinHistoryModal.style.display = "flex";
        await loadAndDisplayCoinHistory();
      }
    });
  }

  if (closeCoinHistoryBtn) {
    closeCoinHistoryBtn.addEventListener("click", () => {
      if (coinHistoryModal) {
        coinHistoryModal.style.display = "none";
      }
    });
  }

  if (coinHistoryModal) {
    coinHistoryModal.addEventListener("click", (e) => {
      if (e.target === coinHistoryModal) {
        coinHistoryModal.style.display = "none";
      }
    });
  }

  // Clean up interval on logout
  window.addEventListener("beforeunload", () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  });
});
