const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

const email = document.getElementById("email");
const phone = document.getElementById("phone");
const username = document.getElementById("username");
const captchaCanvas = document.getElementById("captchaCanvas");
const captchaInput = document.getElementById("captchaInput");
const refreshCaptcha = document.getElementById("refreshCaptcha");
const magicLinkBtn = document.getElementById("magicLinkBtn");
const ctx = captchaCanvas.getContext("2d");

const alertBox = document.getElementById("alertBox");
const alertMessage = document.getElementById("alertMessage");
let captchaText = "";

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

function normalizeReferralUid(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "";
  return raw.startsWith("USR-") ? raw : `USR-${raw}`;
}

function getPendingReferralUid() {
  const params = new URLSearchParams(window.location.search);
  return (
    normalizeReferralUid(params.get("ref")) ||
    normalizeReferralUid(localStorage.getItem("pendingReferralUID"))
  );
}

function syncReferralInSignupUrl(referralUid) {
  if (!referralUid) return;
  const params = new URLSearchParams(window.location.search);
  if (normalizeReferralUid(params.get("ref")) === referralUid) return;
  params.set("ref", referralUid);
  const qs = params.toString();
  const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const fullRef =
    normalizeReferralUid(params.get("ref")) ||
    normalizeReferralUid(localStorage.getItem("pendingReferralUID"));
  if (!fullRef) return;

  localStorage.setItem("pendingReferralUID", fullRef);
  syncReferralInSignupUrl(fullRef);

  referralUIDExists(fullRef).then((exists) => {
    if (!exists) {
      localStorage.removeItem("pendingReferralUID");
      showAlert(`❌ Invalid referral UID: ${fullRef}`, "error");
      return;
    }
    showAlert(
      `🎯 Referral linked: ${fullRef}. Create your account to continue.`,
      "success",
    );
  });
});

// ✅ Normalize email (frontend + backend consistency)
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function showAlert(message, type = "success") {
  alertMessage.innerHTML = message;
  alertBox.className = `alert ${type} show`;
  setTimeout(() => {
    alertBox.classList.remove("show");
  }, 4000);
}

// CAPTCHA
function generateCaptcha() {
  ctx.clearRect(0, 0, captchaCanvas.width, captchaCanvas.height);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, captchaCanvas.width, captchaCanvas.height);

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  captchaText = "";
  for (let i = 0; i < 6; i++) {
    captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  ctx.font = "bold 26px monospace";
  ctx.fillStyle = "#00ffcc";
  ctx.fillText(captchaText, 10, 30);

  captchaInput.value = "";
  magicLinkBtn.classList.remove("enabled");
}

refreshCaptcha.addEventListener("click", generateCaptcha);

captchaInput.addEventListener("input", () => {
  if (captchaInput.value.toUpperCase() === captchaText) {
    magicLinkBtn.classList.add("enabled");
  } else {
    magicLinkBtn.classList.remove("enabled");
  }
});

// Magic link request
document.getElementById("magicLinkBtn").addEventListener("click", async (e) => {
  e.preventDefault();

  const userEmail = normalizeEmail(email.value); // ✅ normalize here
  const userPhone = phone.value.trim();
  const userName = username.value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    showAlert("📧 Enter a valid email.", "error");
    return;
  }
  if (!/^[6-9]\d{9}$/.test(userPhone)) {
    showAlert("📱 Enter a valid 10-digit phone number.", "error");
    return;
  }

  try {
    const referralUid = getPendingReferralUid();

    // First check if already exists
    const check = await fetch(`${API}/user-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail }), // ✅ normalized
    });

    if (check.ok) {
      const data = await check.json();
      if (data.user && data.user.verified) {
        showAlert(
          "⚠️ This email is already registered! Please login instead.",
          "error",
        );
        return;
      }
    }

    const res = await fetch(`${API}/request-magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail, // ✅ normalized
        phone: userPhone,
        username: userName,
        referralUid,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      // 🎉 Show success animation
      showSignupSuccess(userEmail);
    } else {
      showAlert("❌ " + (data.error || "Failed to send link"), "error");
    }
  } catch (err) {
    showAlert("⚠️ Network error: " + err.message, "error");
  }
});

window.onload = generateCaptcha;

// 🎉 Signup Success Celebration
function showSignupSuccess(email) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.5), rgba(118, 75, 162, 0.5));
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
                📧
            </div>
            <div style="font-size: 36px; font-weight: bold; color: #00ffcc; text-shadow: 0 0 20px #00ffcc, 0 0 40px #00ccff; margin-bottom: 10px;">
                Email Sent!
            </div>
            <div style="font-size: 18px; color: #fff; text-shadow: 0 0 10px #00ffcc; margin-bottom: 20px;">
                Check your inbox:
            </div>
            <div style="font-size: 20px; color: #00ffcc; font-weight: bold;">
                ${email}
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    overlay.style.animation = "fadeOut 0.5s ease";
    setTimeout(() => overlay.remove(), 500);
  }, 3000);
}
