const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

function normalizeReferralUid(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  return raw.startsWith("USR-") ? raw : `USR-${raw}`;
}

function getLoginRedirectContext() {
  const params = new URLSearchParams(window.location.search);
  const referralFromQuery = normalizeReferralUid(params.get("ref"));
  const referralFromStorage = normalizeReferralUid(
    localStorage.getItem("pendingReferralUID"),
  );
  const referralUid = referralFromQuery || referralFromStorage || "";
  if (referralUid) {
    localStorage.setItem("pendingReferralUID", referralUid);
  }

  const requestedNext = String(params.get("next") || "").trim();
  return { referralUid, requestedNext };
}

function appendQuery(url, params) {
  const query = params.toString();
  if (!query) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function normalizeUserRedirectTarget(target) {
  const raw = String(target || "").trim();
  if (!raw) return "upload.html";

  const lower = raw.toLowerCase();
  if (lower === "/files.html" || lower === "files.html") {
    return "upload.html";
  }

  return raw;
}

function resolveEffectiveRole(loginData = {}) {
  const rawRole = String(loginData?.role || "")
    .trim()
    .toLowerCase();
  if (rawRole === "admin" || rawRole === "superadmin" || rawRole === "user") {
    return rawRole;
  }

  const email = String(loginData?.email || "")
    .trim()
    .toLowerCase();

  // Keep owner fallback only when backend role is missing.
  if (email === "owner@cloudspace.com") return "superadmin";

  return "user";
}

async function refreshActivePlanFromServer(uid, jwtToken) {
  const cleanUid = String(uid || "").trim();
  if (!cleanUid) return null;

  try {
    const planRes = await fetch(
      `${API}/user-plan/${encodeURIComponent(cleanUid)}`,
      {
        headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
      },
    );
    if (!planRes.ok) return null;

    const planData = await planRes.json().catch(() => ({}));
    const backendPlan = String(planData?.plan || "free").toLowerCase();

    localStorage.setItem("activePlan", backendPlan);
    if (planData && typeof planData === "object") {
      localStorage.setItem("planDetails", JSON.stringify(planData));
    }

    if (jwtToken && backendPlan !== "free") {
      try {
        const tokenRes = await fetch(
          `${API}/api/plan-token/${encodeURIComponent(cleanUid)}/${encodeURIComponent(backendPlan)}`,
          { headers: { Authorization: `Bearer ${jwtToken}` } },
        );

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json().catch(() => ({}));
          if (tokenData?.token) {
            localStorage.setItem("premiumToken", tokenData.token);
            sessionStorage.setItem("premiumToken", tokenData.token);
            sessionStorage.setItem("ultraToken", tokenData.token);
            sessionStorage.setItem("platinumToken", tokenData.token);
          }
        }
      } catch (err) {
        console.warn("Could not refresh plan token from backend:", err);
      }
    }

    return {
      activePlan: backendPlan,
      planDetails: planData,
    };
  } catch (err) {
    console.warn("Could not refresh active plan from backend:", err);
    return null;
  }
}

function syncReferralInLoginUrl(referralUid) {
  if (!referralUid) return;
  const params = new URLSearchParams(window.location.search);
  if (normalizeReferralUid(params.get("ref")) === referralUid) return;
  params.set("ref", referralUid);
  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function showVerifyToast(message, type = "success") {
  const existing = document.querySelector(".verify-toast");
  if (existing) existing.remove();
  const box = document.createElement("div");
  box.className = `verify-toast ${type}`;
  const icon = type === "success" ? "✅" : "⚠️";
  box.innerHTML = `<span class="icon">${icon}</span><span class="text">${message}</span>`;
  document.body.appendChild(box);
  setTimeout(() => {
    box.style.animation = "toastOut 0.25s ease forwards";
    setTimeout(() => box.remove(), 240);
  }, 2600);
}

async function referralUIDExists(fullUID) {
  if (!fullUID) return false;
  try {
    const res = await fetch(
      `${API}/user-by-uid/${encodeURIComponent(fullUID)}`,
    );
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.success;
  } catch {
    return false;
  }
}
// ✅ Auto-fill email + uid if redirected from magic link
document.addEventListener("DOMContentLoaded", () => {
  const { referralUid } = getLoginRedirectContext();
  syncReferralInLoginUrl(referralUid);

  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get("email");
  const uid = urlParams.get("uid");
  const verified = urlParams.get("verified");
  const fullRef = referralUid;

  const createLink = document.querySelector("a.new-btn");
  if (fullRef) {
    referralUIDExists(fullRef).then((exists) => {
      if (!exists) {
        localStorage.removeItem("pendingReferralUID");
        if (createLink) createLink.href = "index.html";
        showVerifyToast(`Invalid referral UID: ${fullRef}`, "error");
        return;
      }

      localStorage.setItem("pendingReferralUID", fullRef);
      if (createLink) {
        createLink.href = `index.html?ref=${encodeURIComponent(fullRef)}`;
      }
      showVerifyToast(
        `Referral linked: ${fullRef}. Login or create account to continue.`,
        "success",
      );
    });
  }

  if (email && uid && verified) {
    const emailInput = document.getElementById("email");
    const uidInput = document.getElementById("uid");

    // Fill & lock email
    if (emailInput) {
      emailInput.value = email;
      emailInput.readOnly = true;
      emailInput.style.background = "rgba(255, 255, 255, 0.16)";
      emailInput.style.color = "#ffffff";
    }

    // Fill & lock uid if field exists
    if (uidInput) {
      uidInput.value = uid;
      uidInput.readOnly = true;
      uidInput.style.background = "rgba(255, 255, 255, 0.16)";
      uidInput.style.color = "#ffffff";
    }

    // Show a message
    const msgBox = document.createElement("p");
    msgBox.textContent =
      "✅ Your account is verified. Please enter your password to continue.";
    msgBox.style.color = "#ffffff";
    msgBox.style.textShadow = "0 2px 8px rgba(0, 0, 0, 0.25)";
    msgBox.style.fontSize = "14px";
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.prepend(msgBox);
  }
});

// ================== LOGIN ==================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      const effectiveRole = resolveEffectiveRole(data);
      data.role = effectiveRole;

      // 🎉 Show success animation
      showLoginSuccess(data.username || "User");

      console.log("✅ Login successful, processing plan data...");
      console.log("Response data:", {
        role: data.role,
        activePlan: data.activePlan,
        premiumToken: data.premiumToken ? "✅ Present" : "❌ Missing",
        redirectPage: data.redirectPage,
        uiAccess: data.uiAccess,
      });

      // ✅ Save JWT token for API authentication
      if (data.jwt) {
        localStorage.setItem("token", data.jwt);
      }

      localStorage.setItem("username", data.username);
      localStorage.setItem("email", data.email);
      localStorage.setItem("uid", data.uid);
      localStorage.setItem("role", data.role); // 👈 Save normalized role
      if (data.profilePic) localStorage.setItem("profilePic", data.profilePic);
      // Save plan info
      if (data.plan) localStorage.setItem("plan", data.plan);
      if (data.uiAccess) localStorage.setItem("uiAccess", data.uiAccess);
      if (data.cloudplusUI)
        localStorage.setItem("cloudplusUI", data.cloudplusUI);

      // Save active plan info
      if (data.activePlan) {
        localStorage.setItem("activePlan", data.activePlan);
        localStorage.setItem("planDetails", JSON.stringify(data.planDetails));
        console.log(`📊 Active plan found: ${data.activePlan}`);
      }

      // ✅ Store premium token in BOTH localStorage and sessionStorage for accessibility
      if (data.premiumToken) {
        localStorage.setItem("premiumToken", data.premiumToken);
        sessionStorage.setItem("premiumToken", data.premiumToken);
        sessionStorage.setItem("tokenTimestamp", Date.now().toString());
        console.log(`🔐 Premium token stored for plan: ${data.activePlan}`);
        console.log(`   Token: ${data.premiumToken}`);
      }

      // Store UID in both storages for accessibility
      sessionStorage.setItem("uid", data.uid);
      sessionStorage.setItem("email", data.email);
      console.log(`👤 User data stored: UID=${data.uid}, Email=${data.email}`);

      // Refresh active plan from backend source-of-truth (switch-plan/admin changes).
      const planSnapshot = await refreshActivePlanFromServer(
        data.uid,
        data.jwt,
      );
      if (planSnapshot?.activePlan) {
        data.activePlan = planSnapshot.activePlan;
        data.planDetails = planSnapshot.planDetails || data.planDetails;

        // If backend says paid plan but no token in login response, reuse refreshed token.
        if (!data.premiumToken) {
          const refreshedToken =
            sessionStorage.getItem("premiumToken") ||
            localStorage.getItem("premiumToken");
          if (refreshedToken) data.premiumToken = refreshedToken;
        }
      }

      // ✅ Redirect based on role and active plan (with delay for animation)
      setTimeout(() => {
        const { referralUid, requestedNext } = getLoginRedirectContext();
        if (data.role === "superadmin") {
          console.log("🔑 Super Admin detected → Redirecting to admin.html");
          window.location.href = "admin.html"; // 👑 Super Admin → Admin Panel
        } else if (data.role === "admin") {
          console.log("🔑 Admin detected → Redirecting to admin.html");
          window.location.href = "admin.html"; // 👨‍💼 Normal Admin → Admin Panel
        } else {
          // Normal user: Redirect to their active plan page if they have one
          if (data.activePlan && data.redirectPage) {
            console.log(`\n🎯 USER HAS ACTIVE PLAN!`);
            console.log(`   Plan: ${data.activePlan}`);
            console.log(`   Redirect to: ${data.redirectPage}`);
            console.log(
              `   Token: ${data.premiumToken ? "✅ Present" : "❌ Missing"}`,
            );
            console.log(
              `   Storage: ${data.planDetails ? JSON.stringify(data.planDetails) : "N/A"}\n`,
            );

            // Store token data in sessionStorage and also attach it to redirect URL.
            if (data.premiumToken) {
              sessionStorage.setItem("premiumToken", data.premiumToken);
              sessionStorage.setItem("ultraToken", data.premiumToken);
              sessionStorage.setItem("platinumToken", data.premiumToken);
              console.log("✅ All premium tokens stored in sessionStorage");
            }
            sessionStorage.setItem("uid", data.uid);

            // Log redirect action
            console.log(`🚀 Redirecting to: ${data.redirectPage}`);

            // Redirect with token details for all purchased plans so URL contains token params.
            let redirectURL = normalizeUserRedirectTarget(data.redirectPage);
            const qp = new URLSearchParams();
            if (data.premiumToken) {
              qp.set("token", data.premiumToken);
              if (data.activePlan) qp.set("plan", data.activePlan);
              if (data.uid) qp.set("uid", data.uid);
            }
            if (referralUid) qp.set("ref", referralUid);
            if (requestedNext) {
              qp.set("next", normalizeUserRedirectTarget(requestedNext));
            }
            redirectURL = appendQuery(redirectURL, qp);
            window.location.href = redirectURL;
          } else {
            // No active plan: Go to default upload page (free tier)
            console.log(
              `ℹ️ User has no active plan - redirecting to upload.html`,
            );
            const freeQp = new URLSearchParams();
            if (referralUid) freeQp.set("ref", referralUid);
            const normalizedNext = normalizeUserRedirectTarget(requestedNext);
            const nextNormalized = normalizedNext.toLowerCase();
            const freeTarget =
              nextNormalized === "upgrade.html" ||
              nextNormalized === "upgrade-form.html"
                ? "upgrade-form.html"
                : "upload.html";
            window.location.href = appendQuery(freeTarget, freeQp);
          }
        }
      }, 2000); // 2 second delay for celebration animation
    } else {
      // ⚠️ Unverified account - needs verification
      if (
        data.reason === "unverified" ||
        (res.status === 423 && data.reason === "system")
      ) {
        showCustomAlert(
          `⚠️ ${data.error || "Please verify your account. Check your email for the verification link."}`,
          "warn",
        );
      }
      // 🚫 Blocked by system with retryUntil timestamp
      else if (data.reason === "system" && data.retryUntil) {
        let remaining = Math.floor((data.retryUntil - Date.now()) / 1000);

        function formatTime(secs) {
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = secs % 60;
          return `${h}h ${m}m ${s}s`;
        }

        showCustomAlert(
          `🚫 Account blocked by system (unverified). Try again in <b>${formatTime(remaining)}</b>`,
          "warn",
        );

        const alertMsg = document.getElementById("alertMessage");
        window.blockTimer = setInterval(() => {
          if (remaining <= 0) {
            clearInterval(window.blockTimer);

            // 🔥 Call backend to refresh status
            fetch(`${API}/me`, {
              headers: {
                Authorization: "Bearer " + localStorage.getItem("token"),
              },
            })
              .then((res) => res.json())
              .then((data) => {
                if (data && !data.blocked) {
                  alertMsg.innerHTML = "✅ You can now log in!";
                } else {
                  alertMsg.innerHTML = "⚠️ Still blocked. Please try again.";
                }
              })
              .catch(() => {
                alertMsg.innerHTML = "✅ You can now log in!";
              });

            return;
          }
          alertMsg.innerHTML = `🚫 Account blocked by system (unverified). Try again in <b>${formatTime(remaining)}</b>`;
          remaining--;
        }, 1000);
      }
      // 🚫 Blocked by Admin/Owner with expiry
      else if (data.reason === "owner" || data.reason === "admin") {
        if (data.retryUntil) {
          let remaining = Math.floor((data.retryUntil - Date.now()) / 1000);

          function formatTime(secs) {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            return `${h}h ${m}m ${s}s`;
          }

          showCustomAlert(
            `🚫 Account blocked by <b>${data.reason}</b>. Time left: <b>${formatTime(remaining)}</b>`,
            "error",
          );

          const alertMsg = document.getElementById("alertMessage");
          window.blockTimer = setInterval(() => {
            if (remaining <= 0) {
              clearInterval(window.blockTimer);

              // 🔥 Call backend to refresh status
              fetch(`${API}/me`, {
                headers: {
                  Authorization: "Bearer " + localStorage.getItem("token"),
                },
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data && !data.blocked) {
                    alertMsg.innerHTML = "✅ You can now log in!";
                  } else {
                    alertMsg.innerHTML = "⚠️ Still blocked. Please try again.";
                  }
                })
                .catch(() => {
                  alertMsg.innerHTML = "✅ You can now log in!";
                });

              return;
            }
            alertMsg.innerHTML = `🚫 Account blocked by <b>${data.reason}</b>. Time left: <b>${formatTime(remaining)}</b>`;
            remaining--;
          }, 1000);
        } else {
          showCustomAlert(
            `🚫 Account blocked by ${data.reason}. Please contact support.`,
            "error",
          );
        }
      }
      // ❌ Fallback for all other errors
      else {
        showCustomAlert("❌ " + (data.error || "Login failed"), "error");
      }
    }
  } catch (err) {
    showCustomAlert("⚠️ Network error: " + err.message, "error");
  }
});

// ================== FORGOT PASSWORD ==================
const forgotModal = document.getElementById("forgotModal");
const resetModalForgot = document.getElementById("resetModalForgot");

document.getElementById("forgotLink").onclick = () =>
  (forgotModal.style.display = "flex");
document.getElementById("forgotClose").onclick = () =>
  (forgotModal.style.display = "none");
document.getElementById("resetForgotClose").onclick = () =>
  (resetModalForgot.style.display = "none");

window.onclick = (e) => {
  if (e.target === forgotModal) forgotModal.style.display = "none";
  if (e.target === resetModalForgot) resetModalForgot.style.display = "none";
};

// Cancel button inside Forgot Password modal
const forgotCancel = document.getElementById("forgotCancel");
if (forgotCancel) {
  forgotCancel.onclick = () => {
    forgotModal.style.display = "none";
  };
}

// Step 1: Verify identity
document.getElementById("forgotSubmit").addEventListener("click", async () => {
  const email = document.getElementById("fpEmail").value.trim();
  const phone = document.getElementById("fpPhone").value.trim();
  const uid = document.getElementById("fpUid").value.trim();
  const msg = document.getElementById("forgotMsg");

  msg.textContent = "";
  msg.className = "";

  try {
    const res = await fetch(`${API}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, uid }),
    });
    const data = await res.json();
    if (res.ok && data.verified) {
      msg.textContent = "✅ Verified! Set a new password.";
      msg.className = "success-msg";
      showVerifyToast("Identity verified. Set your new password.", "success");
      setTimeout(() => {
        forgotModal.style.display = "none";
        resetModalForgot.style.display = "flex";
      }, 1200);
    } else {
      msg.textContent = data.error || "❌ Verification failed";
      msg.className = "error-msg";
      showVerifyToast(data.error || "Verification failed", "error");
    }
  } catch (err) {
    msg.textContent = "⚠️ Network error: " + err.message;
    msg.className = "error-msg";
    showVerifyToast("Network error: " + err.message, "error");
  }
});

// UID Info Tooltip
const uidInfoBtn = document.getElementById("uidInfoBtn");
const uidTooltip = document.getElementById("uidTooltip");

uidInfoBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // prevent auto-close
  uidTooltip.classList.toggle("show");
});

document.addEventListener("click", (e) => {
  if (!uidInfoBtn.contains(e.target) && !uidTooltip.contains(e.target)) {
    uidTooltip.classList.remove("show");
  }
});

// Step 2: Reset password
document
  .getElementById("resetForgotSubmit")
  .addEventListener("click", async () => {
    const email = document.getElementById("fpEmail").value.trim();
    const newPassword = document.getElementById("newPassForgot").value.trim();
    const confirmPassword = document
      .getElementById("confirmPassForgot")
      .value.trim();
    const msg = document.getElementById("resetForgotMsg");

    msg.textContent = "";
    msg.className = "";

    if (newPassword !== confirmPassword) {
      msg.textContent = "❌ Passwords do not match";
      msg.className = "error-msg";
      return;
    }

    try {
      const res = await fetch(`${API}/reset-password-forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        msg.textContent = data.message || "✅ Password reset successfully!";
        msg.className = "success-msg";
        setTimeout(() => {
          resetModalForgot.style.display = "none";
          showCustomAlert(
            "✅ Password reset! Please login with your new password.",
            "success",
          );
        }, 2000);
      } else {
        msg.textContent = data.error || "❌ Reset failed";
        msg.className = "error-msg";
      }
    } catch (err) {
      msg.textContent = "⚠️ Network error: " + err.message;
      msg.className = "error-msg";
    }
  });
// 🚀 Futuristic Alert System
function showCustomAlert(message, type = "error") {
  const overlay = document.getElementById("customAlert");
  const alertMsg = document.getElementById("alertMessage");
  const alertIcon = document.getElementById("alertIcon");

  // Set message
  alertMsg.innerHTML = message;

  // Choose icon
  if (type === "error") {
    alertIcon.textContent = "❌";
    alertIcon.style.color = "#ff4b2b";
    alertIcon.style.textShadow = "0 0 15px #ff4b2b, 0 0 25px #ff0000";
  } else if (type === "success") {
    alertIcon.textContent = "✅";
    alertIcon.style.color = "#6366f1";
    alertIcon.style.textShadow = "0 0 15px #818cf8, 0 0 25px #f472b6";
  } else if (type === "warn") {
    alertIcon.textContent = "⚠️";
    alertIcon.style.color = "#ffaa00";
    alertIcon.style.textShadow = "0 0 15px #ffaa00, 0 0 25px orange";
  }

  // Show overlay ONCE
  overlay.style.display = "flex";
}

function closeAlert() {
  const overlay = document.getElementById("customAlert");
  overlay.style.display = "none";
}

// 🎉 Login Success Celebration
function showLoginSuccess(username) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.45), rgba(245, 87, 108, 0.4));
        backdrop-filter: blur(15px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        animation: fadeIn 0.3s ease;
    `;

  overlay.innerHTML = `
        <div style="text-align: center; animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);">
            <div style="font-size: 80px; margin-bottom: 20px; animation: celebrate 1s ease infinite;">
                🎉
            </div>
            <div style="font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 0 20px rgba(167, 139, 250, 0.9), 0 0 40px rgba(244, 114, 182, 0.7); margin-bottom: 10px;">
                Welcome Back!
            </div>
            <div style="font-size: 24px; color: #fff; text-shadow: 0 0 10px rgba(244, 114, 182, 0.65);">
                ${username}
            </div>
            <div style="margin-top: 30px; font-size: 18px; color: #f9a8d4; animation: pulse 1.5s ease infinite;">
                ✨ Logging you in...
            </div>
        </div>
    `;

  document.body.appendChild(overlay);
}
