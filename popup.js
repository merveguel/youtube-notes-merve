document.addEventListener("DOMContentLoaded", () => {
  const noteInput = document.getElementById("yt-note-input");
  const saveBtn = document.getElementById("save-note-btn");
  const exportBtn = document.getElementById("export-btn");
  const dashboardBtn = document.getElementById("open-dashboard-btn");

  // Helper to extract YouTube Video ID
  function getYouTubeVideoId(url) {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/);
    return match && match[1] ? match[1] : null;
  }

  // Helper to get Thumbnail URL
  function getYouTubeThumbnail(videoId) {
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
  }

  // 1. Save Note Handler (Automatically grabs timestamp)
  saveBtn?.addEventListener("click", async () => {
    const text = noteInput?.value.trim();
    if (!text) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
      alert("Please open a YouTube video first!");
      return;
    }

    const videoId = getYouTubeVideoId(tab.url);
    if (!videoId) return;

    // Ask content script for current video timestamp
    chrome.tabs.sendMessage(tab.id, { action: "getCurrentTime" }, (response) => {
      const currentTimestamp = Math.floor(response?.time || 0);
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const thumbnailUrl = getYouTubeThumbnail(videoId);
      const videoTitle = tab.title ? tab.title.replace("- YouTube", "").trim() : "YouTube Video";

      chrome.storage.local.get({ notes: [] }, (data) => {
        const newNote = {
          id: Date.now(),
          videoId: videoId,
          url: cleanUrl,
          title: videoTitle,
          thumbnail: thumbnailUrl,
          time: currentTimestamp,
          text: text,
          date: new Date().toLocaleDateString()
        };

        const updated = [...data.notes, newNote];
        chrome.storage.local.set({ notes: updated }, () => {
          if (noteInput) noteInput.value = "";
          alert("Note saved!");
        });
      });
    });
  });

  // 2. Export Notes Handler
  exportBtn?.addEventListener("click", () => {
    chrome.storage.local.get({ notes: [] }, (data) => {
      const notes = data.notes;
      if (!notes || notes.length === 0) {
        alert("No notes saved yet to export!");
        return;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `youtube_notes_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  });

  // 3. Open Dashboard Handler
  dashboardBtn?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openOptions" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    });
  });
});