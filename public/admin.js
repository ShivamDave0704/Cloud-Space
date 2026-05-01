const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;
const token = localStorage.getItem("token");
// Store logged in user info
window.loggedInUserEmail = null;
window.loggedInUserRole = null;
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const email = localStorage.getItem("email");
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!email || !token) {
      showAlert("⚠️ Please login first!", "warn");
      setTimeout(() => (window.location.href = "login.html"), 1200);
      return;
    }

    // Safely get profile elements (they might not exist on the page)
    const profileContainer = document.getElementById("profileContainer");
    const profileName = document.getElementById("profileName");
    const profilePic = document.getElementById("profilePic");

    if (profileContainer) profileContainer.style.display = "flex";
    if (profileName) profileName.textContent = username || email;
    if (profilePic)
      profilePic.src =
        localStorage.getItem("profilePic") || "default-avatar.png";

    // Continue with normal load
    loadFiles(); // trigger files after login
    bindLogoutButtons();
    bindLogoutHitboxFallback();
  } catch (err) {
    // Prevent any unexpected error from stopping other handlers
    console.error("Init error:", err);
  }
});

function bindLogoutButtons() {
  const buttons = document.querySelectorAll("#logoutBtn, [data-logout]");
  buttons.forEach((btn) => {
    if (btn.dataset.logoutBound === "1") return;
    btn.dataset.logoutBound = "1";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      window.logout();
    });
  });
}

// Hard fallback: if any layer partially overlaps the logout button,
// clicking anywhere inside the button rectangle still triggers logout.
let logoutHitboxBound = false;
function bindLogoutHitboxFallback() {
  if (logoutHitboxBound) return;
  logoutHitboxBound = true;

  document.addEventListener(
    "pointerdown",
    (ev) => {
      const buttons = Array.from(
        document.querySelectorAll("#logoutBtn, [data-logout]"),
      );

      const hit = buttons.find((btn) => {
        const rect = btn.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return (
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        );
      });

      if (!hit) return;
      ev.preventDefault();
      ev.stopPropagation();
      window.logout();
    },
    true,
  );
}

async function loadMe() {
  const me = await apiFetch("/me");
  if (me) {
    window.loggedInUserEmail = me.email;
    window.loggedInUserRole = me.role;

    const header = document.querySelector("header");
    header.style.cssText = `
            position: relative;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            background: rgba(0,0,0,0.6);
            font-size: 18px;
            font-weight: bold;
        `;

    if (me.email === "owner@cloudspace.com") {
      // 👑 Default Owner Super Admin
      header.innerHTML = `
                <div style="flex:1; text-align:left; display:flex; align-items:center; gap:12px; min-width:0;">
                  <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🌌 Cloud Space Admin Panel</span>
                  <button data-back-upload style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#00ffff,#00ff99);color:#001016;font-weight:700;font-size:15px;cursor:pointer;">⬅️ Upload</button>
                </div>
                <div data-header-center-badge style="position:absolute; left:50%; transform:translateX(-50%);
                            text-align:center; color:gold; font-weight:bold; 
                      text-shadow:0 0 10px gold, 0 0 20px orange;
                      pointer-events:none; user-select:none;">
                    👑 OWNER LOGIN 👑
                </div>
                <div data-header-actions style="flex:1; text-align:right; position:relative; z-index:10002; pointer-events:auto;">
                    <button data-logout onclick="if(window.logout){window.logout();} return false;" style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff5b71,#ff2d55);color:#fff;font-weight:700;font-size:15px;cursor:pointer;pointer-events:auto !important;z-index:10020;position:relative;">🚪 Logout</button>
                </div>
            `;
    } else if (me.role === "superadmin") {
      // ⭐ Promoted Super Admin
      header.innerHTML = `
                <div style="flex:1; text-align:left; display:flex; align-items:center; gap:12px; min-width:0;">
                  <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🌌 Cloud Space Admin Panel</span>
                  <button data-back-upload style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#00ffff,#00ff99);color:#001016;font-weight:700;font-size:15px;cursor:pointer;">⬅️ Upload</button>
                </div>
                <div data-header-center-badge style="position:absolute; left:50%; transform:translateX(-50%);
                            text-align:center; color:deepskyblue; font-weight:bold; 
                      text-shadow:0 0 10px deepskyblue, 0 0 20px white;
                      pointer-events:none; user-select:none;">
                    ⭐ SUPER ADMIN LOGIN ⭐
                </div>
                <div data-header-actions style="flex:1; text-align:right; position:relative; z-index:10002; pointer-events:auto;">
                    <button data-logout onclick="if(window.logout){window.logout();} return false;" style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff5b71,#ff2d55);color:#fff;font-weight:700;font-size:15px;cursor:pointer;pointer-events:auto !important;z-index:10020;position:relative;">🚪 Logout</button>
                </div>
            `;
    } else if (me.role === "admin") {
      // 👨‍💼 Normal Admin
      header.innerHTML = `
                <div style="flex:1; text-align:left; display:flex; align-items:center; gap:12px; min-width:0;">
                  <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🌌 Cloud Space Admin Panel</span>
                  <button data-back-upload style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#00ffff,#00ff99);color:#001016;font-weight:700;font-size:15px;cursor:pointer;">⬅️ Upload</button>
                </div>
                <div data-header-center-badge style="position:absolute; left:50%; transform:translateX(-50%);
                            text-align:center; color:lime; font-weight:bold; 
                      text-shadow:0 0 10px lime, 0 0 20px green;
                      pointer-events:none; user-select:none;">
                    👨‍💼 ADMIN LOGIN
                </div>
                <div data-header-actions style="flex:1; text-align:right; position:relative; z-index:10002; pointer-events:auto;">
                    <button data-logout onclick="if(window.logout){window.logout();} return false;" style="display:inline-flex;align-items:center;min-height:44px;padding:12px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff5b71,#ff2d55);color:#fff;font-weight:700;font-size:15px;cursor:pointer;pointer-events:auto !important;z-index:10020;position:relative;">🚪 Logout</button>
                </div>
            `;
    }

    // Keep header in normal flow after role-specific render.
    header.style.position = "relative";
    header.style.pointerEvents = "auto";
    bindLogoutButtons();
  }
}

// Show cool red logout alert
function showLogoutAlert() {
  const alertDiv = document.createElement("div");
  alertDiv.id = "logoutAlert";
  alertDiv.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
        backdrop-filter: blur(8px);
        animation: fadeIn 0.3s ease;
    `;

  alertDiv.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #fe4267ff, #fc0808ff);
            border: 3px solid #fb7777ff;
            border-radius: 20px;
            padding: 40px 60px;
            text-align: center;
            box-shadow: 0 0 30px rgba(211, 25, 62, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.1);
            animation: slideUp 0.4s ease;
        ">
            <h1 style="
                color: #fff;
                font-size: 32px;
                margin: 0 0 20px 0;
                text-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
                letter-spacing: 2px;
            ">🚪 Logging Out...</h1>
            <p style="
                color: #ffcdd2;
                font-size: 16px;
                margin: 10px 0 30px 0;
                font-weight: bold;
            ">Clearing your session...</p>
            <div style="
                display: flex;
                gap: 15px;
                justify-content: center;
            ">
                <button id="logoutCancelBtn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: 2px solid #16baf6ff;
                    color: #fff;
                    padding: 12px 30px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">❌ Cancel</button>
                  <button id="logoutConfirmBtn" style="
                    background: #adff84ff;
                    border: none;
                    color: #9810edff;
                    padding: 12px 30px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 0 15px rgba(255, 82, 82, 0.6);
                ">✅ Logout</button>
            </div>
            <div style="
                margin-top: 20px;
                display: flex;
                justify-content: center;
                gap: 8px;
            ">
                <div style="
                    width: 12px;
                    height: 12px;
                    background: #ffcdd2;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                "></div>
                <div style="
                    width: 12px;
                    height: 12px;
                    background: #ffcdd2;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                    animation-delay: 0.3s;
                "></div>
                <div style="
                    width: 12px;
                    height: 12px;
                    background: #ffcdd2;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                    animation-delay: 0.6s;
                "></div>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        </style>
    `;

  document.body.appendChild(alertDiv);

  const cancelBtn = alertDiv.querySelector("#logoutCancelBtn");
  const confirmBtn = alertDiv.querySelector("#logoutConfirmBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", cancelLogout);
  if (confirmBtn) confirmBtn.addEventListener("click", confirmLogout);
}

function cancelLogout() {
  const alert = document.getElementById("logoutAlert");
  if (alert) alert.remove();
}

function confirmLogout() {
  stopAutoRefresh(); // Stop the auto-refresh interval before logout
  localStorage.clear();
  window.location.href = "login.html";
}

window.logout = function () {
  if (document.getElementById("logoutAlert")) return;
  showLogoutAlert();
};

// Robust logout handler using event delegation
// Catches both static #logoutBtn and dynamically-created [data-logout] buttons
document.addEventListener("click", (ev) => {
  const backBtn = ev.target.closest("#backToUploadBtn, [data-back-upload]");
  if (backBtn) {
    ev.preventDefault();
    window.location.href = "upload.html?from=admin";
    return;
  }

  const btn = ev.target.closest("#logoutBtn, [data-logout]");
  if (!btn) return;

  ev.preventDefault();
  ev.stopPropagation();

  try {
    window.logout();
  } catch (err) {
    console.error("Logout error:", err);
    localStorage.clear();
    window.location.href = "login.html";
  }
});

// Robust logout handler via event delegation — works even if header is replaced dynamically
document.addEventListener("click", (ev) => {
  const btn =
    ev.target.closest("#logoutBtn") || ev.target.closest("[data-logout]");
  if (!btn) return;
  ev.preventDefault();
  try {
    window.logout();
  } catch (err) {
    console.error("Logout failed:", err);
    // fallback: clear storage + redirect
    localStorage.clear();
    window.location.href = "login.html";
  }
});

// 🌟 Show Alerts
function showAlert(msg, type = "success") {
  const box = document.getElementById("alertBox");
  const alert = document.createElement("div");
  alert.className = `alert ${type}`;
  alert.textContent = msg;
  box.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

// ✅ Central API fetch wrapper
async function apiFetch(endpoint, method = "GET", body = null) {
  try {
    const currentToken = localStorage.getItem("token") || token;
    const options = { method, headers: {} };

    // ✅ Only add Authorization header if we have a valid token
    if (
      currentToken &&
      currentToken !== "null" &&
      currentToken !== "undefined"
    ) {
      options.headers["Authorization"] = "Bearer " + currentToken;
    }

    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

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
      alert(`⚠️ Session expired. Please login again.${tokenMsg}`);
      window.location.href = "login.html";
      return null;
    }

    // 403 → blocked / forbidden
    if (res.status === 403) {
      const errMsg =
        data.error || data.message || data.reason || "Access denied";
      const blockedBy = data.blockedBy || null;

      let displayMsg = "🚫 Access Denied";
      if (blockedBy === "admin") {
        displayMsg =
          "🚫 Your account was blocked by an <b>Admin</b>. Please contact support.";
      } else if (blockedBy === "owner") {
        displayMsg =
          "🚫 Your account was blocked by the <b>Owner</b>. Contact support.";
      } else if (blockedBy === "system") {
        displayMsg =
          "⚠️ Your account was <b>auto-blocked by the system</b> due to non-verification.<br><br>Please contact support after 24 hours.";
      } else if (/permanent/i.test(errMsg)) {
        displayMsg =
          "❌ Your account was <b>permanently banned</b> by Admins (not verified).<br><br>Contact admin: support@cloudspace.com";
      } else {
        displayMsg = errMsg;
      }

      // ✅ Show reusable modal (instead of replacing <body>)
      document.getElementById("blockedMsg").innerHTML = displayMsg;
      document.getElementById("blockedModal").style.display = "flex";

      // 🚪 Force logout
      localStorage.clear();
      return null;
    }

    if (!res.ok) {
      throw new Error(data.error || "❌ Request failed");
    }

    return data;
  } catch (err) {
    console.error("Network error:", err);
    showAlert(
      "🚫 Network error — unable to connect to Cloud Space server.",
      "error",
    );
    return null;
  }
}

// ================== NAV ==================
document.querySelectorAll("nav button").forEach((btn) => {
  btn.onclick = () => {
    // remove 'active' from all buttons
    document
      .querySelectorAll("nav button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // hide all sections
    document
      .querySelectorAll("section")
      .forEach((sec) => sec.classList.remove("active"));

    // find the section this button refers to
    const tabId = btn.dataset.tab;
    const targetSection = document.getElementById(tabId);

    // ✅ only add 'active' if section exists
    if (targetSection) {
      targetSection.classList.add("active");
    } else {
      console.warn(`⚠️ No section found for tab: ${tabId}`);
    }
  };
});

// ================== STATS ==================
async function loadStats() {
  const stats = await apiFetch("/admin/stats");
  if (!stats) return;

  // Update top counters
  document.getElementById("totalUsers").innerText = stats.totalUsers;
  document.getElementById("activeUsers").innerText = stats.activeUsers;
  document.getElementById("blockedUsers").innerText = stats.blockedUsers;
  document.getElementById("totalFiles").innerText = stats.totalFiles;
  document.getElementById("totalStorage").innerText = stats.totalStorage;

  // ✅ Futuristic glowing rows
  document.getElementById("statsBox").innerHTML = `
        <div class="stat-row">
            <span class="stat-label">👥 Total Users</span>
            <span class="stat-value">${stats.totalUsers}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">✅ Active Users</span>
            <span class="stat-value">${stats.activeUsers}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">🚫 Blocked Users</span>
            <span class="stat-value">${stats.blockedUsers}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">📂 Files</span>
            <span class="stat-value">${stats.totalFiles}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">💾 Storage Used</span>
            <span class="stat-value">${stats.totalStorage}</span>
        </div>
    `;
}

// ================== USER CHECK ==================
async function fetchCurrentUser() {
  const me = await apiFetch("/me");
  if (!me) return false;

  window.loggedInUserEmail = me.email;
  window.loggedInUserRole = me.role;

  if (me.role !== "admin" && me.role !== "superadmin") {
    showAlert(
      "⚠️ You no longer have admin access. Redirecting to user view...",
      "warn",
    );
    setTimeout(() => (window.location.href = "upload.html"), 2500);
    return false;
  }

  return true;
}

// ================== INIT ==================
(async () => {
  const ok = await fetchCurrentUser();
  if (!ok) return;
  loadStats();
  loadUsers();
  loadFiles();
  loadLogs();
})();

// ================== USERS ==================
let allUsers = [];
let currentPage = 1;
const rowsPerPage = 10;

function normalizeUidSearchValue(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  if (/^(USR|ADMIN|SUPER)-/.test(raw)) return raw;
  return `USR-${raw.replace(/^[-\s]+/, "")}`;
}

function getUserSearchControls() {
  return {
    input: document.getElementById("userSearch"),
    type: document.getElementById("userSearchType"),
  };
}

function updateUserSearchPlaceholder() {
  const { input, type } = getUserSearchControls();
  if (!input || !type) return;

  if (type.value === "uid") {
    input.placeholder = "🆔 Type UID suffix (USR- auto)";
  } else if (type.value === "phone") {
    input.placeholder = "📱 Search by phone number";
  } else if (type.value === "email") {
    input.placeholder = "📧 Search by email";
  } else {
    input.placeholder = "🔍 Search users...";
  }
}

function autoPrefixUidInputIfNeeded() {
  const { input, type } = getUserSearchControls();
  if (!input || !type || type.value !== "uid") return;
  if (!String(input.value || "").trim()) return;

  const normalized = normalizeUidSearchValue(input.value);
  if (input.value !== normalized) {
    input.value = normalized;
  }
}

// Auto-refresh polling mechanism (every 5 seconds)
let autoRefreshInterval = null;

function startAutoRefresh() {
  // Clear existing interval if any
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);

  // Auto-refresh user data every 5 seconds
  autoRefreshInterval = setInterval(async () => {
    const users = await apiFetch("/admin/users");
    if (users) {
      // Only update if data has changed
      const dataChanged = JSON.stringify(users) !== JSON.stringify(allUsers);
      if (dataChanged) {
        console.log("🔄 Users data updated from server");
        allUsers = users;
        renderUsers();

        // Show update notification
        const refreshStatus = document.getElementById("refreshStatus");
        if (refreshStatus) {
          refreshStatus.style.color = "#ffff00";
          refreshStatus.textContent = "✅ Updated";
          setTimeout(() => {
            refreshStatus.style.color = "#00ff00";
            refreshStatus.textContent = "🔄 Auto-refreshing...";
          }, 2000);
        }
      }
    }
  }, 5000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

async function loadUsers() {
  const users = await apiFetch("/admin/users");
  if (!users) return;
  allUsers = users;

  // ✅ Populate custom mail select
  const customSelect = document.getElementById("customUsers");
  if (customSelect) {
    customSelect.innerHTML = "";
    allUsers.forEach((u) => {
      let opt = document.createElement("option");
      opt.value = u.email;
      opt.textContent = `${u.email} (${u.role || "user"})`;
      customSelect.appendChild(opt);
    });
  }

  // Debug log
  console.log("✅ Loaded users:", allUsers);

  renderUsers();

  // Start auto-refresh when users are loaded
  startAutoRefresh();
}
function renderUsers() {
  const { input, type } = getUserSearchControls();
  const searchType = type?.value || "all";
  const searchRaw = String(input?.value || "").trim();
  const searchVal =
    searchType === "uid"
      ? normalizeUidSearchValue(searchRaw).toLowerCase()
      : searchRaw.toLowerCase();

  // ✅ Default Owner (protected)
  const defaultSuperAdmin = allUsers.find(
    (u) => u.email === "owner@cloudspace.com",
  );

  // ✅ Promoted Super Admins
  const promotedSupers = allUsers.filter(
    (u) => u.role === "superadmin" && u.email !== "owner@cloudspace.com",
  );

  // ✅ Other users (admins + normal)
  const others = allUsers.filter((u) => u.role !== "superadmin");

  // ✅ Apply search
  let filtered = others.filter((u) => {
    if (!searchVal) return true;

    const emailText = String(u.email || "").toLowerCase();
    const uidText = String(u.uid || "").toLowerCase();
    const phoneText = String(u.phone || "").toLowerCase();
    const roleText = String(u.role || "user").toLowerCase();
    const statusText = u.blocked ? "blocked" : "active";

    if (searchType === "email") return emailText.includes(searchVal);
    if (searchType === "uid") return uidText.includes(searchVal);
    if (searchType === "phone") return phoneText.includes(searchVal);

    return (
      emailText.includes(searchVal) ||
      uidText.includes(searchVal) ||
      phoneText.includes(searchVal) ||
      roleText.includes(searchVal) ||
      statusText.includes(searchVal)
    );
  });

  // ✅ Paginate
  const start = (currentPage - 1) * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);

  let html = `<tr>
        <th>📧 Email</th>
      <th>📱 Phone</th>
        <th>🆔 UID</th>
        <th>👑 Role</th>
        <th>🚦 Status</th>
        <th>⚙️ Actions</th>
    </tr>`;

  // ✅ Default Owner Row
  if (defaultSuperAdmin) {
    html += `<tr class="super-admin-row">
            <td>${defaultSuperAdmin.email} <span class="super-admin-crown">👑</span></td>
            <td>${defaultSuperAdmin.phone || "-"}</td>
            <td>${defaultSuperAdmin.uid || "-"}</td>
            <td><span class="role-badge role-superadmin">OWNER</span></td>
            <td><span class="status-badge status-active">✅ Active</span></td>
            <td>
                <select disabled>
                    <option>⚠️ Protected</option>
                </select>
                <small style="color:#ffcc00;font-size:11px;">Default Owner – fully protected</small>
            </td>
        </tr>`;
  }

  // ✅ Promoted Super Admins
  promotedSupers.forEach((u) => {
    html += `<tr class="promoted-super-row">
            <td>${u.email} <span class="super-admin-crown">👑</span></td>
            <td>${u.phone || "-"}</td>
            <td>${u.uid || "-"}</td>
            <td><span class="role-promoted-super">SUPER*</span></td>
            <td><span class="status-badge status-active">✅ Active</span></td>
            <td>
                ${
                  window.loggedInUserEmail === "owner@cloudspace.com"
                    ? `<select class="actions-select"
                          onchange="handleAction(this.value,'${u.email}', false, 'superadmin')">
                          <option value="">⚙️ Select</option>
                          <option value="demoteSuper">Demote to Admin</option>
                       </select>`
                    : `<select disabled><option>⚠️ Protected</option></select>`
                }
            </td>
        </tr>`;
  });

  // ✅ Normal Users & Admins
  paginated.forEach((u) => {
    let actions = `<option value="">⚙️ Select</option>`;

    if (window.loggedInUserEmail === "owner@cloudspace.com") {
      // 👑 OWNER → full power
      actions += `<option value="block">${u.blocked ? "Unblock" : "Block"}</option>`;
      if (u.role === "admin") {
        actions += `<option value="role">Demote to User</option>`;
        actions += `<option value="makeSuper">Promote to Super Admin</option>`;
      } else {
        actions += `<option value="role">Promote to Admin</option>`;
        actions += `<option value="makeSuper">Promote to Super Admin</option>`;
      }
    } else if (window.loggedInUserRole === "superadmin") {
      // ⭐ Promoted Super Admin → normal admin powers
      actions += `<option value="block">${u.blocked ? "Unblock" : "Block"}</option>`;
      if (u.role === "admin") {
        actions += `<option value="role">Demote to User</option>`;
      } else {
        actions += `<option value="role">Promote to Admin</option>`;
      }
    } else if (window.loggedInUserRole === "admin") {
      // 👨‍💼 Normal Admin → only users
      if (u.role !== "admin") {
        actions += `<option value="block">${u.blocked ? "Unblock" : "Block"}</option>`;
        if (!u.blocked) {
          actions += `<option value="role">Promote to Admin</option>`;
        }
      }
    }

    // 📦 Always allow export
    actions += `<option value="export">Export Files</option>`;

    html += `<tr>
            <td>${u.email}</td>
        <td>${u.phone || "-"}</td>
            <td>${u.uid || "-"}</td>
            <td>
                <span class="role-badge ${u.role === "admin" ? "role-admin" : "role-user"}">
                    ${u.role === "admin" ? "ADMIN" : "USER"}
                </span>
            </td>
            <td>
                <span class="status-badge ${u.blocked ? "status-blocked" : "status-active"}">
                    ${u.blocked ? "🚫 Blocked" : "✅ Active"}
                </span>
            </td>
            <td>
                <select class="actions-select"
                        onchange="handleAction(this.value,'${u.email}', ${u.blocked ? "true" : "false"}, '${u.role || "user"}')">
                    ${actions}
                </select>
            </td>
        </tr>`;
  });

  document.getElementById("usersTable").innerHTML = html;
  renderPagination(filtered.length);
}

// ================== PAGINATION ==================
function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  let paginationHtml = `<div style="margin-top: 20px; text-align: center; color: #999;">`;

  if (totalPages > 1) {
    // Previous button
    if (currentPage > 1) {
      paginationHtml += `<button onclick="previousPage()" style="padding: 8px 12px; margin: 0 5px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">← Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        paginationHtml += `<button style="padding: 8px 12px; margin: 0 5px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">${i}</button>`;
      } else {
        paginationHtml += `<button onclick="goToPage(${i})" style="padding: 8px 12px; margin: 0 5px; background: #444; color: #999; border: none; border-radius: 4px; cursor: pointer;">${i}</button>`;
      }
    }

    // Next button
    if (currentPage < totalPages) {
      paginationHtml += `<button onclick="nextPage()" style="padding: 8px 12px; margin: 0 5px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Next →</button>`;
    }
  }

  paginationHtml += `<div style="margin-top: 10px; color: #aaa; font-size: 12px;">Page ${currentPage} of ${totalPages || 1} (${totalItems} total)</div></div>`;

  const paginationContainer = document.getElementById("usersPagination");
  if (paginationContainer) {
    paginationContainer.innerHTML = paginationHtml;
  }
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderUsers();
    window.scrollTo(0, 0);
  }
}

function nextPage() {
  const totalItems = allUsers.filter((u) => u.role !== "superadmin").length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderUsers();
    window.scrollTo(0, 0);
  }
}

function goToPage(page) {
  currentPage = page;
  renderUsers();
  window.scrollTo(0, 0);
}

// ================== FIXED ACTION HANDLER ==================
function handleAction(action, email, blocked, role) {
  if (!action) return;

  const isOwner = window.loggedInUserEmail === "owner@cloudspace.com";

  if (action === "makeSuper") {
    if (!isOwner) {
      showAlert(
        "🚫 Only Default Owner can promote users to Super Admin.",
        "error",
      );
      return;
    }
    if (blocked && !confirm("⚠️ User is BLOCKED. Promote anyway?")) return;

    // 🔥 FIX: send makeSuper:true to backend
    apiFetch("/admin/toggle-admin", "POST", {
      targetEmail: email,
      makeSuper: true,
    }).then(() => {
      showAlert(`✅ ${email} promoted to Super Admin`, "success");
      loadUsers();
    });
    return;
  }

  if (action === "demoteSuper") {
    if (!isOwner) {
      showAlert("🚫 Only Default Owner can demote Super Admins.", "error");
      return;
    }
    if (!confirm("⚠️ Are you sure you want to DEMOTE this Super Admin?"))
      return;

    // 🔥 FIX: send demoteSuper:true to backend
    apiFetch("/admin/toggle-admin", "POST", {
      targetEmail: email,
      demoteSuper: true,
    }).then(() => {
      showAlert(`⚠️ ${email} demoted to Admin`, "warn");
      loadUsers();
    });
    return;
  }

  if (action === "role") {
    if (blocked && !isOwner) {
      showAlert(
        "🚫 Blocked users cannot be promoted/demoted by non-Owners.",
        "warn",
      );
      return;
    }
    if (blocked && isOwner) {
      if (!confirm("⚠️ User is BLOCKED. Change role anyway?")) return;
    }
    toggleAdmin(email);
    return;
  }

  if (action === "block") {
    if (blocked) {
      // ✅ If user is already blocked → Unblock directly
      unblockUser(email);
      return;
    }

    // 🚫 Blocking logic
    if (role === "admin" && !isOwner) {
      showAlert("🚫 Only Owner can block admins.", "warn");
      return;
    }
    if (role === "superadmin") {
      showAlert("🚫 Super Admin accounts cannot be blocked.", "error");
      return;
    }

    // ✅ Show modal for blocking only
    openBlockModal(email);
    return;
  }
}
const userSearchInput = document.getElementById("userSearch");
if (userSearchInput) {
  userSearchInput.addEventListener("input", () => {
    autoPrefixUidInputIfNeeded();
    currentPage = 1;
    renderUsers();
  });
}

const userSearchType = document.getElementById("userSearchType");
if (userSearchType) {
  userSearchType.addEventListener("change", () => {
    updateUserSearchPlaceholder();
    autoPrefixUidInputIfNeeded();
    currentPage = 1;
    renderUsers();
  });
}

updateUserSearchPlaceholder();

// Ensure the logout button always works (attach via JS instead of relying on inline onclick)
//document.addEventListener('DOMContentLoaded', () => {
//    try {
//        const logoutBtn = document.getElementById('logoutBtn');
//        if (logoutBtn) {
//            // Remove any inline handler if present and attach a reliable listener
//            logoutBtn.removeAttribute('onclick');
//            logoutBtn.addEventListener('click', () => window.logout());
//        }
//    } catch (err) {
//        console.error('Error attaching logout handler:', err);
//    }
//});

async function toggleBlock(targetEmail) {
  await apiFetch("/admin/toggle-block", "POST", { targetEmail });
  showAlert(`✅ Toggled block for ${targetEmail}`, "success");
  loadUsers();
  loadStats();
}

async function toggleAdmin(targetEmail) {
  await apiFetch("/admin/toggle-admin", "POST", { targetEmail });
  showAlert(`✅ Toggled role for ${targetEmail}`, "success");
  loadUsers();
}

async function exportFiles(targetEmail) {
  const res = await fetch(`${API}/admin/export-user-files`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetEmail }),
  });
  if (res.ok) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${targetEmail}_files.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showAlert(`📦 Exported files for ${targetEmail}`, "success");
  } else showAlert("❌ Failed to export files", "error");
}

// ================== FILES ==================
async function loadFiles() {
  const files = await apiFetch("/admin/files");
  if (!files) return;

  // ✅ Group by user
  const grouped = {};
  files.forEach((f) => {
    if (!grouped[f.uploadedBy]) grouped[f.uploadedBy] = [];
    grouped[f.uploadedBy].push(f);
  });

  let html = "";
  Object.keys(grouped).forEach((user) => {
    const safeId = user.replace(/[^a-z0-9]/gi, "_"); // unique id for collapse
    html += `
            <tr class="folder-row" onclick="toggleFolder('${safeId}')"
                style="cursor:pointer;background:#111;color:#00ffcc;font-size:16px;">
                <td colspan="3">📂 <b>${user}</b> <span id="arrow-${safeId}">▶</span></td>
            </tr>
            <tbody id="folder-${safeId}" style="display:none;">
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Actions</th>
                </tr>
        `;
    grouped[user].forEach((f) => {
      html += `
                <tr>
                    <td>${f.originalname}</td>
                    <td>${(f.bytes / 1024).toFixed(1)} KB</td>
                    <td>
                        <button class="btn-small danger"
                                onclick="deleteFile('${f.filename}','${f.uploadedBy}')">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `;
    });

    // ✅ Add "Delete All" button under user’s files
    html += `
            <tr>
                <td colspan="3" style="text-align:center;padding:8px;">
                    <button class="btn-small danger"
                            onclick="deleteAllFiles('${user}')">
                        ❌ Delete ALL files of ${user}
                    </button>
                </td>
            </tr>
        `;

    html += `</tbody>`;
  });

  document.getElementById("filesTable").innerHTML = html;
}

// ✅ Collapse/Expand folders
function toggleFolder(id) {
  const section = document.getElementById(`folder-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (section.style.display === "none") {
    section.style.display = "table-row-group";
    arrow.textContent = "▼";
  } else {
    section.style.display = "none";
    arrow.textContent = "▶";
  }
}

// ✅ Delete single file
async function deleteFile(filename, uploadedBy) {
  await apiFetch("/admin/delete-file", "POST", { filename, uploadedBy });
  showAlert(`🗑️ Deleted ${filename}`, "warn");
  loadFiles();
  loadStats();
}

// ✅ Delete ALL files for a user
async function deleteAllFiles(userEmail) {
  if (!confirm(`⚠️ Delete ALL files of ${userEmail}?`)) return;

  await apiFetch("/admin/delete-user-files", "POST", {
    targetEmail: userEmail,
  });
  showAlert(`❌ All files of ${userEmail} deleted`, "error");
  loadFiles();
  loadStats();
}

async function autoBlock() {
  const data = await apiFetch("/admin/auto-block", "POST");
  if (data) showAlert(data.message, "warn");
  loadUsers();
  loadStats();
}

// ================== LOGS ==================
async function loadLogs() {
  const logs = await apiFetch("/admin/logs");
  if (!logs) return;

  const logSections = [
    { title: "🔑 Reset Requests", id: "resetLogs", data: logs.resetLog },
    { title: "🔒 Password Changes", id: "passLogs", data: logs.passLog },
    { title: "📤 File Uploads", id: "uploadLogs", data: logs.uploadLog },
    { title: "🔐 Login Attempts", id: "loginLogs", data: logs.loginLog },
    { title: "📩 Mail Activity", id: "mailLogs", data: logs.mailLogs },
    { title: "🚨 Account Flags / Bans", id: "flagsLogs", data: logs.flagLogs },
  ];

  let html = "";
  logSections.forEach((sec) => {
    html += `
            <div class="log-card">
                <div class="log-header" onclick="toggleLog('${sec.id}')">
                    ${sec.title}
                    <span id="arrow-${sec.id}" class="arrow">▼</span>
                </div>
                <div class="log-body" id="${sec.id}">
                    ${sec.data ? formatLogs(sec.data) : "<p class='empty-log'>📭 No logs.</p>"}
                </div>
            </div>
        `;
  });

  document.getElementById("logs").innerHTML = `
        <h2>📝 Activity Logs</h2>
        ${html}
    `;
}

// ✅ Format logs into lines with glow
function formatLogs(data) {
  if (typeof data === "string") data = data.split("\n");
  return data
    .filter((line) => line.trim() !== "")
    .map((line) => `<div class="log-line">⚡ ${line}</div>`)
    .join("");
}

// ✅ Collapse / Expand logs
function toggleLog(id) {
  const body = document.getElementById(id);
  const arrow = document.getElementById("arrow-" + id);

  if (body.style.display === "none") {
    body.style.display = "block";
    arrow.textContent = "▼";
  } else {
    body.style.display = "none";
    arrow.textContent = "▶";
  }
}

// ================== MAIL ==================
document.getElementById("mailTo").addEventListener("change", (e) => {
  document.getElementById("customUsers").style.display =
    e.target.value === "custom" ? "block" : "none";
});

document.getElementById("sendMailBtn").onclick = async () => {
  const to = document.getElementById("mailTo").value;
  const subject = document.getElementById("mailSub").value.trim();
  const message = document.getElementById("mailMsg").value.trim();
  if (!subject || !message) {
    showAlert("⚠️ Subject and message required.", "warn");
    return;
  }

  let payload = { subject, message };
  if (to === "custom") {
    const selected = Array.from(
      document.getElementById("customUsers").selectedOptions,
    ).map((o) => o.value);
    if (!selected.length) {
      showAlert("⚠️ Please select at least one user.", "warn");
      return;
    }
    payload.to = selected;
  } else {
    payload.to = to || "all";
  }

  const res = await apiFetch("/admin/send-mail", "POST", payload);

  // ✅ Clean handling
  if (res?.error && res.error.includes("No recipients")) {
    showAlert("📭 No users found for this selection.", "warn");
  } else if (res?.message) {
    showAlert(res.message, "success");
  } else {
    showAlert("❌ Failed to send mail.", "error");
  }
};

// ================== INITIAL LOAD ==================
loadMe().then(() => {
  loadStats();
  loadUsers();
  loadFiles();
  loadLogs();
});
let targetBlockEmail = null;

// Open modal
function openBlockModal(email) {
  targetBlockEmail = email;
  document.getElementById("blockUserEmail").innerText = `Blocking: ${email}`;
  document.getElementById("blockDurationModal").style.display = "flex";
}

// Close modal
function closeBlockModal() {
  document.getElementById("blockDurationModal").style.display = "none";
  targetBlockEmail = null;
}

// Show custom hours if selected
document
  .getElementById("blockDurationSelect")
  .addEventListener("change", (e) => {
    document.getElementById("customTimeInputs").style.display =
      e.target.value === "custom" ? "block" : "none";
  });

// Confirm block
document
  .getElementById("confirmBlockBtn")
  .addEventListener("click", async () => {
    let durationVal = document.getElementById("blockDurationSelect").value;
    let durationHours = 0;
    let durationMinutes = 0;

    if (durationVal === "custom") {
      // Allow both hours + minutes
      durationHours =
        parseInt(document.getElementById("customHours").value) || 0;
      durationMinutes =
        parseInt(document.getElementById("customMinutes")?.value) || 0;
    } else {
      // Predefined options (like 24h, 30d etc.)
      durationHours = parseInt(durationVal) || 0;
    }

    try {
      const res = await fetch(`${API}/admin/block-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          targetEmail: targetBlockEmail,
          durationHours,
          durationMinutes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message, "success");
        loadUsers(); // refresh table
        closeBlockModal();
      } else {
        showAlert("❌ " + data.error, "error");
      }
    } catch (err) {
      showAlert("⚠️ Block failed: " + err.message, "error");
    }
  });
async function unblockUser(email) {
  try {
    const res = await fetch(`${API}/admin/block-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ targetEmail: email, durationHours: 0 }), // 0 hours = unblock
    });

    const data = await res.json();
    if (res.ok) {
      showAlert(`✅ ${email} is now unblocked`, "success");
      loadUsers(); // refresh table
    } else {
      showAlert("❌ " + data.error, "error");
    }
  } catch (err) {
    showAlert("⚠️ Unblock failed: " + err.message, "error");
  }
}
