// ==========================================
// Configuration
// ==========================================
const API_BASE = "https://render.everpick.co.in";

// Must match API_KEY in your backend .env. Leave "" if auth is disabled.
const API_KEY = "my_secure_random_key_123";

const HEALTH_INTERVAL_MS = 15000;
const HEALTH_TIMEOUT_MS = 5000;
const RENDER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ==========================================
// Elements (IDs match index.html exactly)
// ==========================================
const $ = (id) => document.getElementById(id);

const dropZone = $("dropzone");
const fileInput = $("fileInput");
const dropHint = $("dropHint");
const preview = $("preview");
const roomType = $("roomType");
const designStyle = $("style");
const extraDetails = $("extra");
const generateBtn = $("generateBtn");
const btnLabel = $("btnLabel");
const spinner = $("spinner");
const errorBox = $("errorBox");
const statusDot = $("statusDot");
const statusText = $("statusText");
const placeholder = $("placeholder");
const loadingBox = $("loadingBox");
const elapsedEl = $("elapsed");
const resultImg = $("resultImg");
const resultActions = $("resultActions");
const resultMeta = $("resultMeta");
const downloadLink = $("downloadLink");

// ==========================================
// State
// ==========================================
let selectedFile = null;
let serverOnline = false;
let isRendering = false;
let previewUrl = null;
let elapsedTimer = null;

// ==========================================
// Helpers
// ==========================================
function setStatus(color, text) {
  if (statusDot) statusDot.style.backgroundColor = color;
  if (statusText) statusText.textContent = text;
}

function updateButton() {
  if (!generateBtn) return;
  generateBtn.disabled = !(serverOnline && selectedFile && !isRendering);
}

function showError(msg) {
  if (errorBox) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  } else {
    alert(msg);
  }
}

function hideError() {
  if (errorBox) errorBox.classList.add("hidden");
}

function setRendering(on) {
  isRendering = on;
  if (spinner) spinner.classList.toggle("hidden", !on);
  if (btnLabel) btnLabel.textContent = on ? "Rendering on RTX 4060 Ti…" : "Generate render";
  if (loadingBox) loadingBox.classList.toggle("hidden", !on);
  if (on) {
    if (placeholder) placeholder.classList.add("hidden");
    if (resultImg) resultImg.classList.add("hidden");
    if (resultActions) resultActions.classList.add("hidden");
    const start = Date.now();
    if (elapsedEl) elapsedEl.textContent = "0";
    elapsedTimer = setInterval(() => {
      if (elapsedEl) elapsedEl.textContent = Math.floor((Date.now() - start) / 1000);
    }, 1000);
  } else {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  updateButton();
}

// Accepts a data URL, http(s) URL, relative path, or raw base64
function normalizeImageSrc(value) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("data:") || value.startsWith("http")) return value;
  if (value.startsWith("/")) return API_BASE + value;
  return `data:image/png;base64,${value}`;
}

// ==========================================
// Status check (every 15 s, 5 s timeout)
// ==========================================
async function checkStatus() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    const data = await res.json();

    if (data.status === "ok") {
      serverOnline = true;
      if (data.busy) {
        setStatus("#f59e0b", `Rendering… (${data.pending ?? 0} queued)`);
      } else {
        setStatus("#10b981", "Render PC ready");
      }
    } else if (data.status === "comfyui_down") {
      serverOnline = false;
      setStatus("#ef4444", "ComfyUI is not running");
    } else {
      serverOnline = false;
      setStatus("#f59e0b", "Unexpected server status");
    }
  } catch (err) {
    serverOnline = false;
    setStatus("#ef4444", "Render PC offline");
  } finally {
    clearTimeout(timer);
    updateButton();
  }
}

// ==========================================
// File selection
// ==========================================
function handleFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    showError("Please choose a PNG, JPG or WEBP image.");
    return;
  }
  hideError();
  selectedFile = file;

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.classList.remove("hidden");
  dropHint.classList.add("hidden");
  updateButton();
}

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("border-amber-400");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("border-amber-400");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("border-amber-400");
  handleFile(e.dataTransfer.files[0]);
});

// ==========================================
// Generate render
// ==========================================
async function generateRender() {
  if (!selectedFile) {
    showError("Please upload a sketch or clay render first.");
    return;
  }

  hideError();
  setRendering(true);
  const startedAt = Date.now();

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("room_type", roomType.value);
  formData.append("style", designStyle.value);
  formData.append("extra_prompt", extraDetails.value.trim());

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RENDER_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/render`, {
      method: "POST",
      headers: API_KEY ? { "X-API-Key": API_KEY } : {},
      body: formData,
      signal: ctrl.signal,
    });

    if (!response.ok) {
      let detail = `Render failed (HTTP ${response.status})`;
      try {
        const errData = await response.json();
        if (errData.detail) {
          detail = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        }
      } catch (_) {}
      throw new Error(detail);
    }

    let src;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      src = URL.createObjectURL(await response.blob());
    } else {
      const data = await response.json();
      src = normalizeImageSrc(data.image || data.image_url || data.url);
    }
    if (!src) throw new Error("Server returned no image.");

    resultImg.src = src;
    resultImg.classList.remove("hidden");
    downloadLink.href = src;
    resultMeta.textContent = `Done in ${Math.round((Date.now() - startedAt) / 1000)}s`;
    resultActions.classList.remove("hidden");
  } catch (err) {
    if (placeholder) placeholder.classList.remove("hidden");
    showError(
      err.name === "AbortError"
        ? "Render timed out. Check that the render PC is running."
        : err.message
    );
  } finally {
    clearTimeout(timer);
    setRendering(false);
  }
}

generateBtn.addEventListener("click", generateRender);

// ==========================================
// Start
// ==========================================
checkStatus();
setInterval(checkStatus, HEALTH_INTERVAL_MS);
