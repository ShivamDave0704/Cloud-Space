// ================== CONFIG ==================
const BASE_URL = location.hostname.includes("192.168.29") || location.hostname.includes("localhost")
    ? "http://192.168.29.136:5000"
    : window.location.origin;

let controller;
// ================== LOGIN CHECK ==================
function requireLogin() {
    const email = localStorage.getItem("email");
    if (!email) {
        // Create custom alert
        const alertBox = document.createElement("div");
        alertBox.innerHTML = `
            <div style="
                position:fixed;top:0;left:0;width:100%;height:100%;
                display:flex;justify-content:center;align-items:center;
                background:rgba(0,0,0,0.7);z-index:99999;
            ">
                <div style="
                    background:rgba(15,25,40,0.95);
                    border:2px solid #00ffcc;
                    border-radius:12px;
                    padding:20px;
                    text-align:center;
                    color:#fff;
                    box-shadow:0 0 20px #00ffcc;
                    max-width:320px;
                ">
                    <p>⚠️ Please login first to access this page.</p>
                    <button id="loginRedirectBtn" style="
                        margin-top:10px;
                        padding:8px 16px;
                        border:none;
                        border-radius:8px;
                        background:linear-gradient(90deg,#00ffcc,#00ffa3);
                        color:#111;font-weight:bold;cursor:pointer;
                        box-shadow:0 0 12px #00ffcc;
                    ">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(alertBox);

        // Redirect when OK clicked
        document.getElementById("loginRedirectBtn").onclick = () => {
            window.location.href = "auth.html"; // or "login.html" if that's your entry
        };

        return false; // stop page logic
    }
    return true; // continue
}

// ================== PROFILE PICTURE + LOGOUT ==================
function initProfile() {
    const profileContainer = document.getElementById("profile-container");
    const profilePic = document.getElementById("profilePic");
    const logoutBtn = document.getElementById("logoutBtn");

    const email = localStorage.getItem("email");
    const username = localStorage.getItem("username");
    const pic = localStorage.getItem("profilePic") || "default-avatar.png";

    if (!profileContainer || !profilePic) return;

    if (email) {
        profileContainer.style.display = "flex";
        profilePic.src = pic;
        profilePic.onerror = () => { profilePic.src = "default-avatar.png"; };

        if (logoutBtn) {
            logoutBtn.style.display = "inline-block";
            logoutBtn.onclick = () => {
                localStorage.clear();
                window.location.href = "login.html";
            };
        }

        profileContainer.onclick = () => {
            alert(`👤 ${username || email}`);
        };
    } else {
        profileContainer.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        window.location.href = "login.html";
    }
}
document.addEventListener("DOMContentLoaded", initProfile);

// ================== UPLOAD ==================
document.getElementById("uploadBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("fileInput");
    const email = localStorage.getItem("email");

    if (!email) return showMessage("⚠️ Please login before uploading files.", "warn");
    if (!input.files || input.files.length === 0) return showMessage("Select files first!", "error");
    if (input.files.length > 20) return showMessage("You can only upload up to 20 files at once", "warn");
    for (const file of input.files) {
        if (file.size > 3 * 1024 * 1024 * 1024) {
            return showMessage(`${file.name} is larger than 3GB limit`, "warn");
        }
    }

    controller = new AbortController();

    const formData = new FormData();
    for (const file of input.files) formData.append("files", file);
    formData.append("uploadedBy", email);

    const progressContainer = document.getElementById("progressContainer");
    progressContainer.innerHTML = `
    <div class="progress-bar">
      <div class="progress-fill" style="width:0%"></div>
    </div>
    <div class="progress-details">⏳ Preparing upload...</div>
  `;

    const progressFill = progressContainer.querySelector(".progress-fill");
    const progressDetails = progressContainer.querySelector(".progress-details");

    try {
        const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${BASE_URL}/upload`);
            const totalSize = [...input.files].reduce((s, f) => s + f.size, 0);
            let startTime = Date.now();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    progressFill.style.width = percent + "%";

                    const uploadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
                    const totalMB = (event.total / (1024 * 1024)).toFixed(2);

                    const elapsedSec = (Date.now() - startTime) / 1000;
                    const speed = (event.loaded / (1024 * 1024 * elapsedSec)).toFixed(2);
                    const remaining = event.total - event.loaded;
                    const eta = (remaining / (event.loaded / elapsedSec)).toFixed(1);

                    progressDetails.textContent =
                        `📦 ${percent}% (${uploadedMB}/${totalMB} MB) | ⚡ ${speed} MB/s | ⏱ ${eta}s left`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        reject(new Error("Invalid server response (not JSON)"));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

            xhr.send(formData);
            controller.signal.addEventListener("abort", () => xhr.abort());
        });

        progressFill.style.width = "100%";
        progressDetails.textContent = "✅ Upload complete!";
        showMessage("Upload complete!", "success", 4000);

        setTimeout(() => window.location.href = "files.html", 1500);

    } catch (err) {
        if (err.name === "AbortError") {
            progressDetails.textContent = "⚠️ Upload cancelled";
            showMessage("Upload Cancelled", "warn");
        } else {
            console.error("❌ Upload error:", err);
            progressDetails.textContent = "❌ Error: " + err.message;
            showMessage(err.message, "error");
        }
    }
});

// ================== CANCEL ==================
document.getElementById("cancelBtn")?.addEventListener("click", () => {
    if (controller) controller.abort();
});

// ================== MESSAGES ==================
function showMessage(text, type = "info", duration = 3000) {
    const container = document.getElementById("messagesArea") || document.body;
    const msgEl = document.createElement("div");
    msgEl.className = `message ${type}`;
    msgEl.textContent = text;
    container.appendChild(msgEl);

    if (duration > 0) {
        setTimeout(() => {
            msgEl.classList.add("fade-out");
            setTimeout(() => msgEl.remove(), 600);
        }, duration);
    }
}

// ================== FILE LIST ==================
async function loadFiles() {
    const loadingIndicator = document.getElementById("loadingIndicator");
    const errorBox = document.getElementById("fileError");
    const list = document.getElementById("fileList");
    const currentUser = localStorage.getItem("email");

    try {
        if (loadingIndicator) loadingIndicator.classList.remove("hidden");
        if (errorBox) {
            errorBox.innerHTML = "";
            errorBox.classList.add("hidden");
        }
        if (list) list.setAttribute("aria-busy", "true");

        const res = await fetch(`${BASE_URL}/files`);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const files = await res.json();
        if (!Array.isArray(files)) throw new Error("Invalid server response");

        const validFiles = files.filter(f => f && f.filename && f.uploadedBy === currentUser);

        if (!list) return;
        list.innerHTML = "";

        if (validFiles.length === 0) {
            list.innerHTML = `<li>No files uploaded by you yet</li>`;
            return;
        }

        const sortSelect = document.getElementById("sortSelect");
        const sortType = sortSelect ? sortSelect.value : "date";

        validFiles.sort((a, b) => {
            if (sortType === "name") return (a?.filename || "").localeCompare(b?.filename || "");
            if (sortType === "size") return (a?.bytes || 0) - (b?.bytes || 0);
            if (sortType === "date") return new Date(b?.created_at || 0) - new Date(a?.created_at || 0);
            if (sortType === "type") return (a?.format || "").localeCompare(b?.format || "");
            return 0;
        });

        validFiles.forEach((f) => {
            const sizeMB = (f.bytes || 0) / (1024 * 1024);
            const date = f.created_at ? new Date(f.created_at).toLocaleString() : "Unknown";
            const li = document.createElement("li");
            li.innerHTML = `
        📄 <strong>${f.filename}</strong>
        <span>(${sizeMB.toFixed(2)} MB, ${f.format || "N/A"}, ${date})</span>
        ${f.secure_url ? `<a href="${f.secure_url}" download>⬇ Download</a>` : ""}
      `;
            list.appendChild(li);
        });
    } catch (err) {
        console.error("❌ Error loading files:", err);

        if (errorBox) {
            errorBox.classList.remove("hidden");
            errorBox.classList.add("message", "error");
            errorBox.innerHTML = `
        ❌ Could not fetch file list 
        <button class="retry-btn">Retry</button>
      `;
            const retryBtn = errorBox.querySelector(".retry-btn");
            if (retryBtn) retryBtn.addEventListener("click", loadFiles);
        }
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add("hidden");
        if (list) list.setAttribute("aria-busy", "false");
    }
}

// Refresh files when sort changes
document.getElementById("sortSelect")?.addEventListener("change", loadFiles);

// Expose globally
window.loadFiles = loadFiles;
