// Page Marker – Background Service Worker
// Handles Alt+. (next mark) and Alt+, (prev mark) keyboard commands

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "jump-next" && command !== "jump-prev") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Make sure content script is alive, then send the cycle command
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "cycleMarks",
      direction: command === "jump-next" ? 1 : -1
    });
  } catch {
    // Content script not injected yet — inject it first, then send
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "cycleMarks",
        direction: command === "jump-next" ? 1 : -1
      });
    } catch (e) {
      console.error("Page Marker: could not send cycle command", e);
    }
  }
});
