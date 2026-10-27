/**
 * RenderStudio frontend logic (vanilla JS, no build step).
 * Talks to the FastAPI backend through your permanent Cloudflare Tunnel URL.
 */

// ====================== CONFIGURATION: edit these two lines ======================
const API_BASE = "https://render.everpick.co.in"; // your Cloudflare Tunnel hostname (no trailing slash)
const API_KEY = "";                             // same value as API_KEY in backend/.env ("" if unused)
// =================================================================================

const MAX_FILE_MB = 15;
const REQUEST_TIMEOUT_MS = 100_000; // slightly above the backend's 90 s limit

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("fileInput");
const preview = $("preview");
const dropHint = $("dropHint");
const generateBtn = $("generateBtn");
const spinner = $("spinner");
const btnLabel = $("btnLabel");
const errorBox = $("errorBox");
const resultImg = $("resultImg");
const placeholder = $("placeholder");
const loadingBox = $("loadingBox");
const resultActions = $("resultActions");

let selectedFile = null;
let busy = false;
let timerId = null;

/* ----------------------------- Error display ----------------------------- */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError() {
  errorBox.classList.add("hidden");
}

/* ------------------------------ File handling ----------------------------- */
function setFile(file) {
  clearError();
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return showError("Please choose a PNG, JPG or WEBP image.");
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return showError(`Image is larger than ${MAX_FILE_MB} MB.`);
  }
  selectedFile = file;
  if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  dropHint.classList.add("hidden");
  generateBtn.disabled = busy;
}

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("border-amber-400", "bg-slate-900");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-amber-400", "bg-slate-900");
  })
);
dropzone.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

/* ------------------------------ Loading state ----------------------------- */
function setBusy(on) {
  busy = on;
  generateBtn.disabled = on || !selectedFile;
  spinner.classList.toggle("hidden", !on);
  btnLabel.textContent = on ? "Rendering…" : "Generate render";
  loadingBox.classList.toggle("hidden", !on);
  if (on) {
    placeholder.classList.add("hidden");
    resultImg.classList.add("hidden");
    resultActions.classList.add("hidden");
    const t0 = Date.now();
    $("elapsed").textContent = "0";
    timerId = setInterval(() => ($("elapsed").textContent = Math.floor((Date.now() - t0) / 1000)), 500);
  } else {
    clearInterval(timerId);
  }
}

/* ------------------------------- Generating ------------------------------- */
function friendlyError(status, detail) {
  const map = {
    401: "Access denied (bad API key).",
    413: "That image is too large.",
    415: "That file is not a valid image.",
    429: "The render PC is busy. Please try again in a minute.",
    503: "The render PC or ComfyUI is offline. Check that the PC is on.",
    504: "The render took too long. Try a smaller image.",
    507: "The GPU ran out of memory. Try a smaller image.",
  };
  return map[status] || detail || `Something went wrong (HTTP ${status}).`;
}

async function generate() {
  if (!selectedFile || busy) return;
  clearError();
  setBusy(true);

  const form = new FormData();
  form.append("file", selectedFile);
  form.append("room_type", $("roomType").value);
  form.append("style", $("style").value);
  form.append("extra_prompt", $("extra").value.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {};
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    const res = await fetch(`${API_BASE}/render`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail; } catch (_) {}
      throw new Error(friendlyError(res.status, detail));
    }

    const data = await res.json();
    resultImg.src = data.image;
    resultImg.classList.remove("hidden");
    $("downloadLink").href = data.image;
    $("resultMeta").textContent = `Seed ${data.seed} · ${data.seconds}s`;
    resultActions.classList.remove("hidden");
  } catch (err) {
    if (err.name === "AbortError") showError("The request timed out. Please try again.");
    else if (err instanceof TypeError) showError("Cannot reach the render server. Is the PC on and the tunnel running?");
    else showError(err.message);
    placeholder.classList.remove("hidden");
  } finally {
    clearTimeout(timeout);
    setBusy(false);
  }
}

generateBtn.addEventListener("click", generate);

/* ---------------------------- Server status dot --------------------------- */
async function checkHealth() {
  const dot = $("statusDot"), text = $("statusText");
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(6000) });
    const h = await res.json();
    if (h.status === "ok") {
      dot.className = "inline-block w-2.5 h-2.5 rounded-full " + (h.busy ? "bg-amber-400" : "bg-emerald-400");
      text.textContent = h.busy ? `GPU busy (${h.pending} in queue)` : "Render PC ready";
    } else {
      dot.className = "inline-block w-2.5 h-2.5 rounded-full bg-red-500";
      text.textContent = "ComfyUI is not running";
    }
  } catch (_) {
    dot.className = "inline-block w-2.5 h-2.5 rounded-full bg-red-500";
    text.textContent = "Render PC offline";
  }
}
checkHealth();
setInterval(checkHealth, 15000);
