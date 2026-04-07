// Page Marker – Popup Script (v2)

const btnAdd      = document.getElementById("btnAdd");
const btnPrev     = document.getElementById("btnPrev");
const btnNext     = document.getElementById("btnNext");
const btnClearAll = document.getElementById("btnClearAll");
const marksList   = document.getElementById("marksList");
const emptyState  = document.getElementById("emptyState");
const headerCount = document.getElementById("headerCount");
const markLabel   = document.getElementById("markLabel");
const toastEl     = document.getElementById("toast");

const COLORS = [
  "#63b3ed", "#48bb78", "#ed8936",
  "#9f7aea", "#e05252", "#38b2ac"
];

let toastTimer;
let currentMarks   = [];  // sorted by scrollY
let currentNavIdx  = -1;  // which mark is "current" for prev/next in popup

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// ── Tab / content helpers ──────────────────────────────────────────────────
async function getTab() {
  return new Promise(res =>
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => res(tabs[0]))
  );
}

async function send(action, extra = {}) {
  const tab = await getTab();
  return new Promise(resolve => {
    const msg = { action, ...extra };
    chrome.tabs.sendMessage(tab.id, msg, r => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ["content.js"] },
          () => chrome.tabs.sendMessage(tab.id, msg, resolve)
        );
      } else {
        resolve(r);
      }
    });
  });
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderMarks(marks, highlightId = null) {
  // Sort by position for display and navigation
  currentMarks = [...marks].sort((a, b) => a.scrollY - b.scrollY);

  marksList.innerHTML = "";
  const count = currentMarks.length;
  headerCount.textContent = count + (count === 1 ? " mark" : " marks");
  headerCount.classList.toggle("has-marks", count > 0);
  emptyState.style.display = count > 0 ? "none" : "";
  btnClearAll.disabled = count === 0;
  btnPrev.disabled     = count === 0;
  btnNext.disabled     = count === 0;

  currentMarks.forEach((mark, i) => {
    const color = COLORS[mark.colorIndex % COLORS.length];
    const isCurrent = mark.id === highlightId;
    if (isCurrent) currentNavIdx = i;

    const row = document.createElement("div");
    row.className = "mark-row" + (isCurrent ? " is-current" : "");
    row.style.setProperty("--mark-color", color);

    row.innerHTML = `
      <div class="mark-dot" style="background:${color}"></div>
      <div class="mark-info">
        <div class="mark-name">${escHtml(mark.label)}</div>
        <div class="mark-pos">${Math.round(mark.scrollY).toLocaleString()}px</div>
      </div>
      <div class="mark-actions">
        <button class="btn-icon jump" title="Jump to this mark">🎯</button>
        <button class="btn-icon del"  title="Delete this mark">✕</button>
      </div>
    `;

    row.querySelector(".jump").addEventListener("click", async () => {
      currentNavIdx = i;
      // Send jump, then close popup — content script scrolls the page
      await send("jumpToMark", { id: mark.id });
      window.close();
    });

    row.querySelector(".del").addEventListener("click", async () => {
      const res = await send("deleteMark", { id: mark.id });
      if (res?.marks) renderMarks(res.marks);
      showToast("🗑️ Mark removed");
    });

    marksList.appendChild(row);
  });
}

function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Prev / Next ────────────────────────────────────────────────────────────
async function navigate(direction) {
  if (!currentMarks.length) return;

  let next = currentNavIdx + direction;
  if (next >= currentMarks.length) next = 0;
  if (next < 0)                    next = currentMarks.length - 1;
  currentNavIdx = next;

  const mark = currentMarks[next];
  await send("jumpToMark", { id: mark.id });
  // Re-render to highlight the current mark in the list
  renderMarks(currentMarks, mark.id);
  showToast(`🎯 ${mark.label}  (${next + 1}/${currentMarks.length})`);
}

btnPrev.addEventListener("click", () => navigate(-1));
btnNext.addEventListener("click", () => navigate(1));

// ── Add mark ───────────────────────────────────────────────────────────────
btnAdd.addEventListener("click", async () => {
  const label      = markLabel.value.trim() || ("Mark " + (currentMarks.length + 1));
  const colorIndex = currentMarks.length % COLORS.length;
  const tab        = await getTab();

  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
    chrome.tabs.sendMessage(tab.id, { action: "startPlaceMode", label, colorIndex }, () => {});
    window.close(); // close popup so user can click the page
  });
});

markLabel.addEventListener("keydown", e => { if (e.key === "Enter") btnAdd.click(); });

// ── Clear all ──────────────────────────────────────────────────────────────
btnClearAll.addEventListener("click", async () => {
  if (!confirm("Remove all marks on this page?")) return;
  const res = await send("clearAllMarks");
  if (res?.success) { renderMarks([]); showToast("🗑️ All marks cleared"); }
});

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  const res = await send("getMarks");
  renderMarks(res?.marks || []);
})();
