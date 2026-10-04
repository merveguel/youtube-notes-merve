chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openOptions") {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        // Fallback: Open options page explicitly in a new tab
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    });
    sendResponse({ status: "ok" });
  }
  return true;
});