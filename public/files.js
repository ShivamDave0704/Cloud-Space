const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;

const fileList = document.getElementById("fileList");
const sortSelect = document.getElementById("sortSelect");
const profilePic = document.getElementById("profilePic");
const profileContainer = document.getElementById("profile-container");
const profileDropdown = document.getElementById("profile-dropdown");
const profileName = document.getElementById("profile-name");
const userModal = document.getElementById("userModal");
const userDetails = document.getElementById("userDetails");
const copyBtn = document.getElementById("copyUid");

function safeName(email = "guest") {
    return email.replace(/[^a-zA-Z0-9.@_-]/g, "_");
}

function checkAuth() {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");
    return token && email;
}

document.addEventListener("DOMContentLoaded", async () => {
    const email = localStorage.getItem("email");
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!email || !token) {
        alert("⚠️ Please login first!");
        window.location.href = "login.html";
        return;
    }

    profileContainer.style.display = "flex";
    profileName.textContent = username || email;
    profilePic.src = localStorage.getItem("profilePic") || "default-avatar.png";

    loadFiles();
    sortSelect.addEventListener("change", loadFiles);

    // 🚪 Logout Button (safe attach after DOM ready)
    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const confirmLogout = document.getElementById("confirmLogout");
    const cancelLogout = document.getElementById("cancelLogout");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            profileDropdown.style.display = "none";  // close dropdown
            logoutModal.style.display = "flex";      // open modal
        });
    }

    // Cancel button
    if (cancelLogout) {
        cancelLogout.addEventListener("click", () => {
            logoutModal.style.display = "none";      // close modal
        });
    }

    // Confirm logout
    if (confirmLogout) {
        confirmLogout.addEventListener("click", () => {
            localStorage.clear();
            logoutModal.style.display = "none";

            // Optional success alert
            showAlert("Logged out successfully.", "success");

            setTimeout(() => {
                window.location.href = "login.html";
            }, 1000);
        });
    }

});

// 🔎 Map extensions to icons
function getFileIcon(ext) {
    switch (ext) {
        case "jpg": case "jpeg": case "png": case "gif": case "bmp": case "webp":
            return "🖼️";
        case "mp4": case "avi": case "mov": case "mkv": case "webm":
            return "🎬";
        case "mp3": case "wav": case "ogg": case "flac":
            return "🎵";
        case "pdf":
            return "📕";
        case "doc": case "docx":
            return "📘";
        case "xls": case "xlsx": case "csv":
            return "📊";
        case "zip": case "rar": case "7z": case "tar": case "gz":
            return "📦";
        case "txt":
            return "📄";
        case "exe": case "msi":
            return "⚙️";
        default:
            return "📦"; // fallback icon
    }
}

async function loadFiles() {
    if (!checkAuth()) return;
    const email = localStorage.getItem("email");
    const safeEmail = safeName(email);
    const loader = document.getElementById("loadingIndicator");
    const errorBox = document.getElementById("fileError");

    try {
        loader.style.display = "flex";
        fileList.innerHTML = "";
        errorBox.style.display = "none";

        const res = await fetch(`${API}/files/${safeEmail}`);
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const myFiles = await res.json();

        if (myFiles.length === 0) {
            fileList.innerHTML = `<li style="text-align:center;color:#ccc;">No files uploaded yet.</li>`;
            return;
        }

        const type = sortSelect.value;
        myFiles.sort((a, b) => {
            if (type === "name") return a.filename.localeCompare(b.filename);
            if (type === "size") return a.bytes - b.bytes;
            if (type === "date") return new Date(b.created_at) - new Date(a.created_at);
            if (type === "type") return (a.format || "").localeCompare(b.format || "");
            return 0;
        });

        myFiles.forEach(f => {
            const li = document.createElement("li");
            const name = f.originalname || f.filename;
            const ext = (name.split(".").pop() || "").toLowerCase();

            const icon = getFileIcon(ext);

            li.innerHTML = `
                <span class="file-icon">${icon}</span>
                <div class="file-info">
                    <strong>${name}</strong><br>
                    <span>${(f.bytes / 1024 / 1024).toFixed(2)} MB • ${ext.toUpperCase() || "N/A"} • ${new Date(f.created_at).toLocaleString()}</span>
                </div>
                <a href="${f.secure_url}" download="${name}" class="download-btn">⬇ Download</a>
            `;
            fileList.appendChild(li);
        });
    } catch (err) {
        console.error("❌ File load error:", err);

        // Futuristic Neon Alert
        showAlert("⚡ Failed to fetch files. Try again?", "error", [
            {
                text: "🔄 Retry Uploads",
                bg: "linear-gradient(90deg,#ff1744,#d50000)",
                color: "#fff",
                onClick: () => {
                    closeAlert();
                    loadFiles();
                }
            }
        ]);

        // Extra fallback visible inside UI
        errorBox.innerHTML = `
            <div class="retry-box">
                <span style="color:#ff1744;font-size:1.2rem;">🚨 Connection Lost</span><br>
                <button class="retry-btn" onclick="loadFiles()">⚡ Retry</button>
            </div>
        `;
        errorBox.style.display = "block";
    }
    finally {
        loader.style.display = "none";
    }
}

// Toggle dropdown
profilePic.addEventListener("click", () => {
    profileDropdown.style.display = profileDropdown.style.display === "flex" ? "none" : "flex";
});

// 🌌 Neon Alert System
function showAlert(message, type = "info", buttons = null) {
    const alertBox = document.getElementById("customAlert");
    const alertMsg = document.getElementById("alertMessage");
    const alertIcon = document.getElementById("alertIcon");
    const alertBtns = document.getElementById("alertButtons");

    alertMsg.textContent = message;

    // pick icon
    if (type === "success") alertIcon.textContent = "✅";
    else if (type === "error") alertIcon.textContent = "";
    else if (type === "warn") alertIcon.textContent = "";
    else alertIcon.textContent = "ℹ️";

    // reset buttons
    alertBtns.innerHTML = `<button onclick="closeAlert()">✖</button>`;

    // add custom buttons
    if (buttons) {
        buttons.forEach(btn => {
            const b = document.createElement("button");
            b.textContent = btn.text;
            b.style = `
                background:${btn.bg || "#00ffcc"};
                border:none;
                color:${btn.color || "#111"};
                padding:6px 12px;
                border-radius:6px;
                cursor:pointer;
                font-weight:bold;`;
            b.onclick = btn.onClick;
            alertBtns.prepend(b);
        });
    }

    // ✅ make visible + trigger animation
    alertBox.style.display = "flex";
    requestAnimationFrame(() => alertBox.classList.add("show"));

    // auto-close if no custom buttons
    if (!buttons) {
        setTimeout(() => closeAlert(), 4000);
    }
}

function closeAlert() {
    const alertBox = document.getElementById("customAlert");
    alertBox.classList.remove("show");
    setTimeout(() => (alertBox.style.display = "none"), 400);
}

// 🌌 Neon Toast (cooler for quick success/error messages)
function showToast(message, type = "success") {
    const userModal = document.getElementById("userModal"); // parent modal
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    // attach inside modal (so it shows above it)
    userModal.appendChild(toast);

    // position above modal content
    toast.style.position = "absolute";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";

    setTimeout(() => toast.classList.add("show"), 50);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// View details
document.getElementById("viewDetails").addEventListener("click", async () => {
    const email = localStorage.getItem("email");
    const res = await fetch(`${API}/user-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok) {
        const u = data.user;
        userDetails.innerHTML = `
            <p><b>UID:</b> ${u.uid}</p>
            <p><b>Name:</b> ${u.username}</p>
            <p><b>Email:</b> ${u.email}</p>
            <p><b>Phone:</b> ${u.phone || "N/A"}</p>
            <p><b>Role:</b> ${u.role || "user"}</p>
            <p><b>Joined:</b> ${u.created_at || "Unknown"}</p>`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(u.uid);
            // 🔥 use toast instead of big alert
            showToast("✅ UID copied to clipboard!");
        };
        userModal.style.display = "flex";
    } else {
        showAlert("❌ User not found", "error");
    }
    profileDropdown.style.display = "none";
});
