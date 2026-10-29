// ==========================================
// Configuration
// ==========================================
const API_BASE = "https://render.everpick.co.in";

// 👉 Paste your backend API key here. If you disabled it in the backend, leave it as ""
const API_KEY = "my_secure_random_key_123"; 

// ==========================================
// Elements
// ==========================================
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const roomType = document.getElementById("room-type");
const designStyle = document.getElementById("design-style");
const extraDetails = document.getElementById("extra-details");
const generateBtn = document.getElementById("generate-btn");
const resultImage = document.getElementById("result-image");
const errorBox = document.getElementById("error-box");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

let selectedFile = null;

// ==========================================
// Status Check (Runs every 15 seconds)
// ==========================================
async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        
        if (data.status === "ok") {
            statusDot.style.backgroundColor = "#10b981"; // Green
            statusText.textContent = "Render PC ready";
            generateBtn.disabled = false;
        } else if (data.status === "comfyui_down") {
            statusDot.style.backgroundColor = "#ef4444"; // Red
            statusText.textContent = "ComfyUI is not running";
        }
    } catch (err) {
        statusDot.style.backgroundColor = "#ef4444"; // Red
        statusText.textContent = "Render PC offline";
    }
}

// ==========================================
// Generate Render
// ==========================================
async function generateRender() {
    if (!selectedFile) {
        showError("Please upload a sketch or clay render first.");
        return;
    }

    // Reset UI for loading
    hideError();
    generateBtn.disabled = true;
    generateBtn.textContent = "Rendering on RTX 4060 Ti...";
    resultImage.style.opacity = "0.5";

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("room_type", roomType.value);
    formData.append("style", designStyle.value);
    formData.append("extra_prompt", extraDetails.value);

    try {
        const response = await fetch(`${API_BASE}/render`, {
            method: "POST",
            headers: {
                "X-API-Key": API_KEY // This unlocks your FastAPI backend!
            },
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to generate render");
        }

        const data = await response.json();
        
        // Display the finished render
        resultImage.src = data.image;
        resultImage.style.opacity = "1";
        
    } catch (err) {
        showError(err.message);
        resultImage.style.opacity = "1";
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate render";
    }
}

// ==========================================
// Event Listeners & UI Helpers
// ==========================================
function showError(msg) {
    if (errorBox) {
        errorBox.textContent = msg;
        errorBox.style.display = "block";
    } else {
        alert(msg);
    }
}

function hideError() {
    if (errorBox) errorBox.style.display = "none";
}

// Drag & Drop handlers
if (dropZone) {
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#10b981";
    });
    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#374151";
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#374151";
        if (e.dataTransfer.files.length) {
            selectedFile = e.dataTransfer.files[0];
            dropZone.innerHTML = `<p style="color: #10b981;">Selected: ${selectedFile.name}</p>`;
        }
    });
}

if (fileInput) {
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            selectedFile = e.target.files[0];
            dropZone.innerHTML = `<p style="color: #10b981;">Selected: ${selectedFile.name}</p>`;
        }
    });
}

if (generateBtn) {
    generateBtn.addEventListener("click", generateRender);
}

// Start checking the server status immediately
checkStatus();
setInterval(checkStatus, 15000);
