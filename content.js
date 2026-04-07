// Page Marker – Content Script (v2, multi-mark + cycle navigation)

(function () {
  const OVERLAY_ID  = "pm-overlay";
  const PREVIEW_ID  = "pm-preview";
  const HINT_ID     = "pm-hint";
  const HUD_ID      = "pm-hud";

  // ── Color palette (matches popup) ─────────────────────────────────────────
  const COLORS = [
    { line: "rgba(99,179,237,0.82)",  label: "#63b3ed", bg: "rgba(99,179,237,0.1)",  border: "rgba(99,179,237,0.38)"  },
    { line: "rgba(104,211,145,0.82)", label: "#48bb78", bg: "rgba(104,211,145,0.1)", border: "rgba(104,211,145,0.38)" },
    { line: "rgba(246,173,85,0.82)",  label: "#ed8936", bg: "rgba(246,173,85,0.1)",  border: "rgba(246,173,85,0.38)"  },
    { line: "rgba(183,148,246,0.82)", label: "#9f7aea", bg: "rgba(183,148,246,0.1)", border: "rgba(183,148,246,0.38)" },
    { line: "rgba(252,129,129,0.82)", label: "#e05252", bg: "rgba(252,129,129,0.1)", border: "rgba(252,129,129,0.38)" },
    { line: "rgba(99,230,226,0.82)",  label: "#38b2ac", bg: "rgba(99,230,226,0.1)",  border: "rgba(99,230,226,0.38)"  },
  ];

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("pm-styles")) return;
    const s = document.createElement("style");
    s.id = "pm-styles";
    s.textContent = `
      .pm-line {
        position: absolute; left: 0; width: 100%; height: 2px;
        z-index: 2147483644; pointer-events: none;
      }
      .pm-label {
        position: absolute; left: 14px;
        font-family: 'Courier New', monospace; font-size: 10px;
        font-weight: 600; letter-spacing: 0.8px;
        padding: 2px 8px; border-radius: 0 0 5px 5px;
        border-width: 1px; border-style: solid;
        z-index: 2147483645; pointer-events: none; white-space: nowrap;
      }
      /* Highlight pulse when jumped to */
      .pm-line.pm-highlight {
        animation: pm-hl 1.2s ease-out forwards;
      }
      @keyframes pm-hl {
        0%   { filter: brightness(2) drop-shadow(0 0 6px white); }
        100% { filter: none; }
      }

      #${OVERLAY_ID} {
        position: fixed; inset: 0;
        z-index: 2147483640; cursor: crosshair;
      }
      #${PREVIEW_ID} {
        position: fixed; left: 0; width: 100%; height: 2px;
        z-index: 2147483641; pointer-events: none; top: 0;
      }
      #${HINT_ID} {
        position: fixed; top: 16px; left: 50%;
        transform: translateX(-50%);
        background: rgba(10,15,25,0.87);
        border: 1px solid rgba(99,179,237,0.3);
        color: #90cdf4;
        font-family: 'Courier New', monospace; font-size: 12px;
        letter-spacing: 0.4px; padding: 8px 18px;
        border-radius: 20px; z-index: 2147483642;
        pointer-events: none; white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      }
      /* HUD toast shown when cycling marks via keyboard */
      #${HUD_ID} {
        position: fixed; bottom: 24px; left: 50%;
        transform: translateX(-50%) translateY(8px);
        background: rgba(10,15,25,0.88);
        border: 1px solid rgba(255,255,255,0.12);
        color: #e2e8f0;
        font-family: 'Courier New', monospace; font-size: 12px;
        letter-spacing: 0.3px; padding: 7px 16px;
        border-radius: 16px; z-index: 2147483646;
        pointer-events: none; white-space: nowrap;
        opacity: 0; transition: opacity 0.2s, transform 0.2s;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      #${HUD_ID}.pm-hud-show {
        opacity: 1; transform: translateX(-50%) translateY(0);
      }
      .pm-flash {
        position: fixed; inset: 0;
        background: rgba(99,179,237,0.06);
        z-index: 2147483643; pointer-events: none;
        animation: pm-flash-anim 0.35s ease-out forwards;
      }
      @keyframes pm-flash-anim { from { opacity:1; } to { opacity:0; } }
    `;
    document.head.appendChild(s);
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  function storageKey() { return "pagemarker2:" + window.location.href; }

  function loadMarks(cb) {
    chrome.storage.local.get([storageKey()], r => cb(r[storageKey()] || []));
  }

  function saveMarks(marks, cb) {
    chrome.storage.local.set({ [storageKey()]: marks }, cb);
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function lineEl(id)  { return document.getElementById("pm-line-"  + id); }
  function labelEl(id) { return document.getElementById("pm-lbl-"   + id); }

  function renderOneMark(mark) {
    lineEl(mark.id)?.remove();
    labelEl(mark.id)?.remove();

    const c = COLORS[mark.colorIndex % COLORS.length];

    const line = document.createElement("div");
    line.className = "pm-line";
    line.id = "pm-line-" + mark.id;
    line.style.cssText = `top:${mark.scrollY}px; background:${c.line}; box-shadow:0 0 6px ${c.line};`;

    const lbl = document.createElement("div");
    lbl.className = "pm-label";
    lbl.id = "pm-lbl-" + mark.id;
    lbl.style.cssText = `top:${mark.scrollY}px; color:${c.label}; background:${c.bg}; border-color:${c.border};`;
    lbl.textContent = "📍 " + mark.label;

    document.body.appendChild(line);
    document.body.appendChild(lbl);
  }

  function removeOneMark(id) {
    lineEl(id)?.remove();
    labelEl(id)?.remove();
  }

  function highlightMark(id) {
    const el = lineEl(id);
    if (!el) return;
    el.classList.remove("pm-highlight");
    void el.offsetWidth; // reflow to restart animation
    el.classList.add("pm-highlight");
  }

  function flashScreen() {
    const f = document.createElement("div");
    f.className = "pm-flash";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 350);
  }

  // ── HUD toast ─────────────────────────────────────────────────────────────
  let hudTimer;
  function showHud(text) {
    injectStyles();
    let hud = document.getElementById(HUD_ID);
    if (!hud) {
      hud = document.createElement("div");
      hud.id = HUD_ID;
      document.body.appendChild(hud);
    }
    hud.textContent = text;
    hud.classList.add("pm-hud-show");
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hud.classList.remove("pm-hud-show"), 1800);
  }

  // ── Cycle navigation ──────────────────────────────────────────────────────
  // Tracks which mark index was last jumped to so cycling feels sequential
  let lastJumpedIndex = -1;

  function cycleMarks(direction) {
    loadMarks(marks => {
      if (!marks.length) { showHud("📍 No marks on this page"); return; }

      // Sort marks by scroll position for natural up/down cycling
      const sorted = [...marks].sort((a, b) => a.scrollY - b.scrollY);

      // Find next index
      let next = lastJumpedIndex + direction;
      if (next >= sorted.length) next = 0;
      if (next < 0)              next = sorted.length - 1;
      lastJumpedIndex = next;

      const mark = sorted[next];
      window.scrollTo({ top: Math.max(0, mark.scrollY - 80), behavior: "smooth" });
      highlightMark(mark.id);
      flashScreen();
      showHud(`📍 ${mark.label}  (${next + 1} / ${sorted.length})`);
    });
  }

  function jumpToSpecific(id) {
    loadMarks(marks => {
      const sorted = [...marks].sort((a, b) => a.scrollY - b.scrollY);
      const idx    = sorted.findIndex(m => m.id === id);
      const mark   = sorted[idx];
      if (!mark) return;
      lastJumpedIndex = idx;
      window.scrollTo({ top: Math.max(0, mark.scrollY - 80), behavior: "smooth" });
      highlightMark(mark.id);
      flashScreen();
      showHud(`📍 ${mark.label}  (${idx + 1} / ${sorted.length})`);
    });
  }

  // ── Place mode ────────────────────────────────────────────────────────────
  let placingActive = false;

  function startPlaceMode(label, colorIndex, callback) {
    if (placingActive) return;
    placingActive = true;
    injectStyles();

    const c = COLORS[colorIndex % COLORS.length];

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;

    const preview = document.createElement("div");
    preview.id = PREVIEW_ID;
    preview.style.cssText = `background:${c.line}; box-shadow:0 0 8px ${c.line};`;

    const hint = document.createElement("div");
    hint.id = HINT_ID;
    hint.textContent = "📍 Click anywhere to place mark  ·  Esc to cancel";

    document.body.appendChild(overlay);
    document.body.appendChild(preview);
    document.body.appendChild(hint);

    const onMove = e => { preview.style.top = e.clientY + "px"; };
    const onKey  = e => { if (e.key === "Escape") cancel(); };

    function cancel() {
      cleanup(); placingActive = false; callback({ cancelled: true });
    }

    function cleanup() {
      overlay.removeEventListener("mousemove", onMove);
      overlay.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      overlay.remove(); preview.remove(); hint.remove();
    }

    function onClick(e) {
      e.preventDefault(); e.stopPropagation();
      const pageY = e.clientY + window.scrollY;
      cleanup(); placingActive = false;

      loadMarks(marks => {
        const newMark = {
          id: Date.now().toString(),
          scrollY: pageY,
          label: label || ("Mark " + (marks.length + 1)),
          colorIndex,
          createdAt: Date.now()
        };
        const updated = [...marks, newMark];
        saveMarks(updated, () => {
          renderOneMark(newMark);
          flashScreen();
          // Reset cycle index so next cycle starts from nearest mark
          lastJumpedIndex = -1;
          callback({ success: true, mark: newMark, marks: updated });
        });
      });
    }

    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  }

  // ── Delete / clear ────────────────────────────────────────────────────────
  function deleteMark(id, cb) {
    loadMarks(marks => {
      const updated = marks.filter(m => m.id !== id);
      saveMarks(updated, () => { removeOneMark(id); lastJumpedIndex = -1; cb({ success: true, marks: updated }); });
    });
  }

  function clearAllMarks(cb) {
    loadMarks(marks => {
      marks.forEach(m => removeOneMark(m.id));
      saveMarks([], () => { lastJumpedIndex = -1; cb({ success: true }); });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function loadExistingMarks() {
    loadMarks(marks => { if (marks.length) { injectStyles(); marks.forEach(renderOneMark); } });
  }

  // ── Messages ──────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "startPlaceMode") {
      startPlaceMode(msg.label, msg.colorIndex || 0, r => sendResponse(r));
      return true;
    }
    if (msg.action === "jumpToMark") {
      jumpToSpecific(msg.id);
      sendResponse({ success: true });
      return true;
    }
    if (msg.action === "cycleMarks") {
      cycleMarks(msg.direction);
      sendResponse({ success: true });
      return true;
    }
    if (msg.action === "deleteMark") {
      deleteMark(msg.id, sendResponse);
      return true;
    }
    if (msg.action === "clearAllMarks") {
      clearAllMarks(sendResponse);
      return true;
    }
    if (msg.action === "getMarks") {
      loadMarks(marks => sendResponse({ marks }));
      return true;
    }
    if (msg.action === "ping") {
      sendResponse({ ok: true });
      return true;
    }
    return true;
  });

  loadExistingMarks();
})();
