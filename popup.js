let currentTimestamp = 0;

// Grab timestamp from video via content script
document.getElementById("get-time-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  
  chrome.tabs.sendMessage(tab.id, { action: "getCurrentTime" }, (response) => {
    if (chrome.runtime.lastError || !response || response.time === undefined) {
      alert("Make sure you are on an active YouTube video page.");
      return;
    }
    currentTimestamp = Math.floor(response.time);
    const mins = Math.floor(currentTimestamp / 60);
    const secs = currentTimestamp % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    document.getElementById("get-time-btn").innerText = `Captured: ${formatted}`;
  });
});

// Save note to chrome.storage
document.getElementById("save-btn").addEventListener("click", async () => {
  const text = document.getElementById("note-input").value;
  if (!text) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const videoTitle = tab ? tab.title.replace("- YouTube", "").trim() : "YouTube Video";
  const videoUrl = tab ? tab.url.split("&")[0] : "";

  chrome.storage.local.get({ notes: [] }, (data) => {
    const newNote = {
      id: Date.now(),
      url: videoUrl,
      title: videoTitle,
      time: currentTimestamp,
      text: text,
      date: new Date().toLocaleDateString()
    };

    const updated = [...data.notes, newNote];
    chrome.storage.local.set({ notes: updated }, () => {
      document.getElementById("note-input").value = "";
      renderNotes(updated);
    });
  });
});

// Render recent notes in popup
function renderNotes(notes) {
  const container = document.getElementById("notes-container");
  container.innerHTML = "";
  if (notes.length === 0) {
    container.innerHTML = `<div style="font-size:12px; color:#888;">No notes yet.</div>`;
    return;
  }
  notes.slice(-5).reverse().forEach((item) => {
    const div = document.createElement("div");
    div.className = "note-item";
    const mins = Math.floor(item.time / 60);
    const secs = item.time % 60;
    const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    div.innerHTML = `<span class="timestamp">[${fmt}]</span> ${item.text}`;
    container.appendChild(div);
  });
}

// Export function
document.getElementById("export-btn").addEventListener("click", () => {
  chrome.storage.local.get({ notes: [] }, (data) => {
    if (data.notes.length === 0) return alert("No notes to export!");
    const blob = new Blob([JSON.stringify(data.notes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `youtube-notes-${new Date().toISOString().slice(0,10)}.json`,
      saveAs: false
    });
  });
});

// Direct Open Dashboard
document.getElementById("open-dashboard-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Auto-sync popup list if notes change anywhere
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.notes) {
    renderNotes(changes.notes.newValue || []);
  }
});

// Initial load
chrome.storage.local.get({ notes: [] }, (data) => renderNotes(data.notes));