// ✅ Define API first
const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : window.location.origin;  // ✅ auto-use ngrok URL

// ✅ If redirected from Magic Link / Google OAuth
const urlParams = new URLSearchParams(window.location.search);
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
                        : `${API}${userData.profilePic}`
                );
            }

            showAlert(`🎉 Welcome ${userData.username || userData.email}, you're logged in!`, "success");
        }
    } catch (err) {
        console.error("User parse failed:", err);
    }
}

const token = localStorage.getItem("token");
const fileLabelText = document.getElementById("fileLabelText");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const filePreview = document.getElementById("filePreview");
const progressContainer = document.getElementById("progressContainer");
const cancelBtn = document.getElementById("cancelBtn");   // ✅ add this
let selectedFiles = [];

// ✅ Keep <input type="file"> synced with selectedFiles
function syncFileInput() {
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
}
let activeUploads = [];   // ✅ add this
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
document.getElementById("uploadBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) {
        showAlert("⚠️ No files selected!", "warn"); // 🌌 COOL ALERT
        return;
    }

    // Continue upload process here...
});

// File select & preview
fileInput.addEventListener("change", () => {
    const newFiles = Array.from(fileInput.files);

    // ✅ Merge with already selected files (avoid duplicates)
    selectedFiles = [...selectedFiles, ...newFiles].filter(
        (file, index, self) =>
            index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );

    updateFileLabel();
    showFilePreview();
});


// ================== DRAG & DROP HANDLER ==================
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const newFiles = Array.from(e.dataTransfer.files);

    // ✅ merge without duplicates
    selectedFiles = [...selectedFiles, ...newFiles].filter(
        (file, index, self) =>
            index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );

    // 🔄 sync input
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;

    updateFileLabel();
    showFilePreview();
});

// ================== LABEL (UPPER PART) ==================
function updateFileLabel() {
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
            .map(f => truncateFileName(f.name, 25))
            .join(", ");
    } else {
        // more → just show count
        fileLabelText.textContent = `${selectedFiles.length} files selected`;
    }
}

// ================== FILE PREVIEW ==================
function showFilePreview() {
    filePreview.innerHTML = "";
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach((file, index) => {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

        // ✅ truncated preview but full name in tooltip
        const truncatedName = truncateFileName(file.name, 40);

        const div = document.createElement("div");
        div.innerHTML = `
            <span title="${file.name}">📄 ${truncatedName} (${sizeMB} MB)</span>
            <button class="remove-btn">❌</button>
        `;

        div.querySelector(".remove-btn").addEventListener("click", () => {
            selectedFiles.splice(index, 1);
            updateFileLabel();
            showFilePreview();
        });

        filePreview.appendChild(div);
    });

    // keep fileInput synced
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
}

// ================== TRUNCATE HELPER ==================
function truncateFileName(name, maxLength = 40) {
    if (name.length <= maxLength) return name;

    const extIndex = name.lastIndexOf(".");
    const ext = extIndex !== -1 ? name.slice(extIndex) : "";
    const base = extIndex !== -1 ? name.slice(0, extIndex) : name;

    const keepStart = Math.floor((maxLength - ext.length) * 0.6);
    const keepEnd = (maxLength - ext.length) - keepStart - 3;

    return base.slice(0, keepStart) + "..." + base.slice(-keepEnd) + ext;
}

// ================== CANCEL BUTTON ==================
cancelBtn.addEventListener("click", () => {
    selectedFiles = [];
    syncFileInput();
    filePreview.innerHTML = "";
    progressContainer.innerHTML = "";
    fileLabelText.textContent = "📂 Drag & drop files here or click to browse";

    // abort running uploads
    activeUploads.forEach(xhr => xhr.abort());
    activeUploads = [];

    showAlert("❌ File selection cleared & uploads cancelled!", "error");
});

// ================== UPLOAD HANDLER ==================
document.getElementById("uploadBtn").addEventListener("click", async () => {
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

    progressContainer.innerHTML = "";

    // 🌍 Global progress bar
    const globalBar = document.createElement("div");
    globalBar.style.width = "100%";
    globalBar.style.height = "12px";
    globalBar.style.borderRadius = "8px";
    globalBar.style.background = "rgba(255,255,255,0.1)";
    globalBar.style.overflow = "hidden";
    globalBar.style.boxShadow = "0 0 10px rgba(0,255,255,0.4)";
    const globalFill = document.createElement("div");
    globalFill.style.height = "100%";
    globalFill.style.width = "0%";
    globalFill.style.background = "linear-gradient(90deg,#00e5ff,#00ff7f)";
    globalFill.style.transition = "width 0.3s linear";
    globalBar.appendChild(globalFill);
    progressContainer.appendChild(globalBar);

    const status = document.createElement("div");
    status.style.marginTop = "8px";
    status.style.color = "#00e5ff";
    status.style.fontFamily = "monospace";
    status.style.fontSize = "13px";
    progressContainer.appendChild(status);

    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    let uploadedBytes = 0;
    const startTime = Date.now();

    // 🔄 Global progress updater
    function updateGlobalProgress(extraBytes = 0) {
        const uploaded = uploadedBytes + extraBytes;
        const percent = (uploaded / totalSize) * 100;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = (uploaded / 1024 / 1024 / elapsedSec).toFixed(2); // MB/s
        const eta = calculateETA(totalSize, uploaded, elapsedSec);

        globalFill.style.width = percent + "%";
        status.textContent = `🌍 ${percent.toFixed(1)}% | ⚡ ${speed} MB/s | ⏱ ${eta} left`;
    }

    // 🔄 Process files sequentially
    for (const file of selectedFiles) {
        if (file.size < 2 * 1024 * 1024 * 1024) {
            // ✅ < 2GB normal upload
            await new Promise((resolve, reject) => {
                const formData = new FormData();
                formData.append("files", file);    // ✅ correct field name (matches server.js)
                formData.append("uploadedBy", email);

                const xhr = new XMLHttpRequest();
                activeUploads.push(xhr);  // ✅ track this upload
                xhr.open("POST", `${API}/upload`, true);
                xhr.setRequestHeader("x-user", email);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) updateGlobalProgress(e.loaded);
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        uploadedBytes += file.size;
                        updateGlobalProgress();
                        resolve();
                    } else reject(xhr.responseText);
                };

                xhr.onerror = () => reject("❌ Upload failed");
                xhr.send(formData);
            });
        } else {
            // ✅ ≥ 2GB chunked upload
            const CHUNK_SIZE = 80 * 1024 * 1024; // 80 MB chunks
            const MAX_CONCURRENCY = 4;           // 4 parallel uploads
            const fileId = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let currentChunk = 0;

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
                fill.style.background = "linear-gradient(90deg,#00e5ff,#00ff7f)";
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
                formData.append("chunkIndex", i);       // ✅ always 0-based
                formData.append("uploadedBy", email);

                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    activeUploads.push(xhr);  // ✅ track this upload
                    xhr.open(
                        "POST",
                        `${API}/upload-chunk?fileId=${fileId}&chunkIndex=${i}`, // ✅ keep 0-based
                        true
                    );
                    xhr.setRequestHeader("x-user", email);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = ((e.loaded / chunkSize) * 100).toFixed(1);
                            const elapsed = (Date.now() - chunkStartTime) / 1000;
                            const speed = (e.loaded / 1024 / 1024 / elapsed).toFixed(2);
                            const eta = calculateETA(chunkSize, e.loaded, elapsed);

                            chunkBars[i].style.width = percent + "%";
                            chunkLabels[i].textContent = `Chunk ${i}/${totalChunks - 1}: ${percent}% | ⚡ ${speed} MB/s | ⏱ ${eta} left`;
                            updateGlobalProgress(e.loaded);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            uploadedBytes += chunkSize;
                            chunkBars[i].style.width = "100%";
                            chunkBars[i].style.background = "linear-gradient(90deg,#00ff7f,#4caf50)";
                            chunkLabels[i].textContent = `Chunk ${i}/${totalChunks - 1}: ✅ Done (${(chunkSize / 1024 / 1024).toFixed(1)} MB)`;
                            updateGlobalProgress();
                            resolve();
                        } else {
                            chunkBars[i].style.background = "linear-gradient(90deg,#ff1744,#d50000)";
                            chunkLabels[i].textContent = `Chunk ${i}/${totalChunks - 1}: ❌ Failed`;
                            reject("❌ Chunk " + i + " failed");
                        }
                    };

                    xhr.onerror = () => {
                        chunkBars[i].style.background = "linear-gradient(90deg,#ff1744,#d50000)";
                        chunkLabels[i].textContent = `Chunk ${i}/${totalChunks - 1}: ❌ Network error`;
                        reject("❌ Network error on chunk " + i);
                    };

                    xhr.send(formData);
                });
            }

            // 🚀 Upload in parallel batches
            while (currentChunk < totalChunks) {
                const batch = [];
                for (let j = 0; j < MAX_CONCURRENCY && currentChunk < totalChunks; j++) {
                    batch.push(uploadChunk(currentChunk)); // ✅ starts from 0
                    currentChunk++;
                }
                try {
                    await Promise.all(batch);
                } catch (err) {
                    status.textContent = err;
                    return;
                }
            }

            // 🔄 Merge after all chunks
            status.textContent = "🔄 Merging...";
            const mergeRes = await fetch(`${API}/merge-chunks`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-user": email },
                body: JSON.stringify({ fileId, fileName: file.name, uploadedBy: email })
            });
            const mergeData = await mergeRes.json();
            if (mergeRes.ok && mergeData.file) {
                status.textContent = `✅ ${file.name} uploaded & merged!`;
            } else {
                status.textContent = "❌ Merge failed: " + (mergeData.error || "Unknown error");
                return;
            }
        }

    }

    status.textContent = "✅ All files uploaded successfully!";
    setTimeout(() => window.location.href = "files.html", 2000);
});

// ✅ Central API fetch wrapper (with block check)
async function apiFetch(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Authorization": "Bearer " + token } };
    if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API}${endpoint}`, options);
    let data = null;
    try { data = await res.clone().json(); } catch { data = {}; }

    if (res.status === 401) {
        const tokenMsg = data?.forceLogoutToken ? ` (Code: ${data.forceLogoutToken})` : '';
        localStorage.clear();
        alert(`⚠️ Session expired. Please login again.${tokenMsg}`);
        window.location.href = "login.html";
        return null;
    }

    if (res.status === 403) {
        if (data.forceLogout || data.forceLogoutToken || data.reason === "blocked" || /block|blocked/i.test(data.error || "")) {
            // 🚪 Forced logout / blocked → force logout UI
            localStorage.clear();
            document.body.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;
                    background:rgba(15,32,39,0.95);backdrop-filter: blur(12px);
                    color:#ff4444;display:flex;flex-direction:column;justify-content:center;align-items:center;
                    font-size:24px;font-weight:bold;text-align:center;z-index:99999;">
                    🚪 Session closed<br><br>
                    ${data.forceLogoutToken ? `Code: ${data.forceLogoutToken}<br><br>` : ''}
                    ${data.error || 'You have been logged out.'}
                </div>`;
            setTimeout(() => window.location.href = "login.html", 2000);
            return null;
        }
    }

    try { return await res.json(); } catch { return null; }
}
// Auth + Profile
document.addEventListener("DOMContentLoaded", async () => {
    const email = localStorage.getItem("email");
    if (!email || !token) {
        alert("⚠️ Please login first!");
        window.location.href = "login.html";
        return;
    }
    // Auto-load storage after login
    loadStorage(localStorage.getItem("email"));

    // ✅ Check if user is still active (blocked users will be kicked)
    const me = await apiFetch("/me");
    if (!me) return; // blocked users already logged out here

    // 🌌 Profile Init
    const profileContainer = document.getElementById("profile-container");
    const profilePic = document.getElementById("profilePic");
    profileContainer.style.display = "flex";
    profilePic.src = localStorage.getItem("profilePic") || "/images/default-avatar.png";

    // 🚪 Logout with confirmation
    document.getElementById("logoutBtn").addEventListener("click", () => {
        showConfirmAlert("⚠️ Are you sure you want to logout?", "Logout", () => {
            // ✅ User clicked OK
            localStorage.clear();
            showLocalAlert("profileAlert", "✅ Logged out successfully.", "success");
            setTimeout(() => (window.location.href = "login.html"), 1200);
        });
    });

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

    // 🎭 Modal Animations
    const modal = document.getElementById("profileModal");
    const closeModal = document.getElementById("closeModal");
    const closeProfileBtn = document.getElementById("closeProfileBtn");
    const saveProfileBtn = document.getElementById("saveProfileBtn");

    function openModal() {
        modal.style.display = "flex";
        modal.classList.add("fadeIn");
    }
    function closeModalFn() {
        modal.classList.remove("fadeIn");
        modal.classList.add("fadeOut");
        setTimeout(() => {
            modal.style.display = "none";
            modal.classList.remove("fadeOut");
        }, 300);
    }

    // 🖼️ Show Profile
    profilePic.addEventListener("click", async () => {
        try {
            const res = await fetch(`${API}/user-details`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                document.getElementById("modalPic").src =
                    data.user.profilePic.startsWith("/uploads") ? API + data.user.profilePic : data.user.profilePic;
                document.getElementById("modalName").textContent = "👤 " + data.user.username;
                document.getElementById("modalEmail").textContent = data.user.email;
                document.getElementById("modalPhone").textContent = data.user.phone;
                document.getElementById("modalUid").textContent = data.user.uid;
                openModal();
            } else {
                showLocalAlert("profileAlert", "❌ " + data.error, "error");
            }
        } catch (err) {
            showLocalAlert("profileAlert", "⚠️ Error loading profile: " + err.message, "error");
        }
    });

    closeModal.onclick = closeModalFn;
    closeProfileBtn.onclick = closeModalFn;

    // 📋 Copy UID with animation
    document.getElementById("copyUidBtn").addEventListener("click", (e) => {
        e.preventDefault();
        const uid = document.getElementById("modalUid").textContent;
        navigator.clipboard.writeText(uid)
            .then(() => {
                showLocalAlert("profileAlert", "✅ UID copied: " + uid, "success");

                // Cool "Copied!" animation
                const uidEl = document.getElementById("modalUid");
                uidEl.classList.add("copied");
                setTimeout(() => uidEl.classList.remove("copied"), 1000);

                // Close after ~1s
                setTimeout(closeModalFn, 1200);
            })
            .catch(() => {
                showLocalAlert("profileAlert", "❌ Failed to copy UID", "error");
            });
    });

    // 💾 Save Profile
    saveProfileBtn.addEventListener("click", async () => {
        const username = document.getElementById("editName").value;
        const phone = document.getElementById("editPhone").value;
        const pic = document.getElementById("editPic").files[0];
        const formData = new FormData();
        formData.append("email", email);
        if (username) formData.append("username", username);
        if (phone) formData.append("phone", phone);
        uploadProfile.single("profilePic")

        try {
            showLocalAlert("profileAlert", "⏳ Saving profile...", "info");
            const res = await fetch(`${API}/update-profile`, { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) {
                showLocalAlert("profileAlert", "✅ Profile updated!", "success");
                localStorage.setItem("username", data.user.username);
                localStorage.setItem("phone", data.user.phone);
                if (data.user.profilePic) localStorage.setItem("profilePic", API + data.user.profilePic);
                setTimeout(() => {
                    closeModalFn();
                    location.reload();
                }, 1000);
            } else {
                showLocalAlert("profileAlert", "❌ " + data.error, "error");
            }
        } catch (err) {
            showLocalAlert("profileAlert", "⚠️ " + err.message, "error");
        }
    });

    // 🔑 Reset Password Section
    const resetSection = document.getElementById("resetPasswordSection");
    const resetPassBtn = document.getElementById("resetPassBtn");
    const submitResetPassBtn = document.getElementById("submitResetPassBtn");
    const cancelResetPassBtn = document.getElementById("cancelResetPassBtn");

    resetPassBtn.addEventListener("click", () => {
        resetSection.style.display = "block";
        resetSection.classList.add("slideIn");
        resetPassBtn.style.display = "none";
    });

    cancelResetPassBtn.addEventListener("click", () => {
        resetSection.style.display = "none";
        resetPassBtn.style.display = "inline-block";
        ["oldPass", "newPass", "confirmPass"].forEach(id => document.getElementById(id).value = "");
    });

    // ✅ Submit Reset Password
    submitResetPassBtn.addEventListener("click", async () => {
        const oldPass = document.getElementById("oldPass").value;
        const newPass = document.getElementById("newPass").value;
        const confirmPass = document.getElementById("confirmPass").value;
        if (!oldPass || !newPass || !confirmPass) {
            showLocalAlert("resetAlert", "⚠️ Please fill all password fields!", "warn");
            return;
        }
        if (newPass !== confirmPass) {
            showLocalAlert("resetAlert", "❌ New password and confirm password do not match.", "error");
            return;
        }
        try {
            showLocalAlert("resetAlert", "⏳ Updating password...", "info");
            const res = await fetch(`${API}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, oldPassword: oldPass, newPassword: newPass, confirmPassword: confirmPass })
            });
            const data = await res.json();
            if (res.ok) {
                showLocalAlert("resetAlert", "✅ Password updated successfully!", "success");
                setTimeout(() => cancelResetPassBtn.click(), 1000);
            } else {
                showLocalAlert("resetAlert", "❌ " + (data.error || "Failed to reset password"), "error");
            }
        } catch (err) {
            showLocalAlert("resetAlert", "⚠️ " + err.message, "warn");
        }
    });
    // ================== Fetch and Show Storage ==================
    async function loadStorage(email) {
        try {
            const res = await fetch(`${API}/storage/${email}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to load storage");

            const percent = parseFloat(data.percent) || 0;
            const used = data.usedFormatted || "0 B";
            const max = `${data.maxGB} GB`;

            const circle = document.querySelector(".circle-progress .progress");
            if (circle) {
                const radius = 54;
                const circumference = 2 * Math.PI * radius;
                circle.style.strokeDasharray = circumference;
                circle.style.strokeDashoffset = circumference;

                const offset = circumference - (percent / 100) * circumference;
                circle.style.strokeDashoffset = offset;
            }

            document.getElementById("storagePercent").innerText = `${percent}%`;
            document.getElementById("storageUsed").innerText = `${used} / ${max}`;
        } catch (err) {
            console.error("❌ Storage fetch error:", err);
            document.getElementById("storageUsed").innerText = "Error loading";
        }
    }
});


if (pic) formData.append("profilePic", pic);

