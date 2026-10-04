// Respond to time requests from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTime") {
    const video = document.querySelector("video");
    sendResponse({ time: video ? video.currentTime : 0 });
  }
});

// Utility: Extract YouTube Video ID from URL
function getYouTubeVideoId(url) {
  const match = url.match(/[?&]v=([^&]+)/);
  return match && match[1] ? match[1] : null;
}

// Utility: Construct Thumbnail URL from Video ID
function getYouTubeThumbnail(videoId) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
}

// Safely Inject Sidebar Panel into YouTube
function injectNotePanel() {
  // Prevent duplicate injections
  if (document.getElementById("custom-yt-notes-panel")) return;

  // Target YouTube's specific inner sidebar container
  const secondary = document.querySelector("#secondary-inner") || document.querySelector("#secondary");
  if (!secondary) return;

  const panel = document.createElement("div");
  panel.id = "custom-yt-notes-panel";
  panel.style.cssText = `
    background: #212121;
    color: #fff;
    padding: 12px;
    margin-bottom: 16px;
    border-radius: 8px;
    border: 1px solid #383838;
    font-family: Roboto, Arial, sans-serif;
    box-sizing: border-box;
  `;

  panel.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 15px;">Video Notes</h3>
    <textarea id="yt-note-input" placeholder="Note... (cmd+enter)" style="width: 100%; height: 60px; box-sizing: border-box; background: #181818; color: white; border: 1px solid #383838; border-radius: 4px; padding: 6px; resize: vertical;"></textarea>
    <button id="yt-note-save-btn" style="width: 100%; padding: 6px; margin-top: 6px; background: #3ea6ff; color: #0f0f0f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Note (Ctrl+Enter)</button>
    <div id="yt-notes-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto;"></div>
    <button id="yt-open-dashboard" style="width: 100%; padding: 6px; margin-top: 8px; background: transparent; color: #aaa; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 12px;">Open Full Dashboard ↗</button>
  `;

  // Safely insert panel at top of sidebar
  secondary.insertBefore(panel, secondary.firstChild);

  // Core Save Note Function
  const saveNote = () => {
    const textInput = document.getElementById("yt-note-input");
    const text = textInput ? textInput.value.trim() : "";
    if (!text) return;

    const currentUrl = window.location.href;
    const videoId = getYouTubeVideoId(currentUrl);
    if (!videoId) return alert("Could not identify YouTube video ID.");

    // Auto-grab current video playback time
    const video = document.querySelector("video");
    const currentTimestamp = video ? Math.floor(video.currentTime) : 0;

    const videoTitle = document.querySelector("h1.ytd-watch-metadata")?.innerText || document.title.replace("- YouTube", "").trim();
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = getYouTubeThumbnail(videoId);

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
        if (textInput) textInput.value = "";
        loadCurrentVideoNotes();
      });
    });
  };

  // 1. Trigger save on "Save Note" button click
  document.getElementById("yt-note-save-btn").addEventListener("click", saveNote);

  // 2. Keyboard Shortcut: Save on Ctrl + Enter or Cmd + Enter inside textarea
  const textarea = document.getElementById("yt-note-input");
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveNote();
      }
    });
  }

  // Dashboard button handler
  const dashboardBtn = document.getElementById("yt-open-dashboard");
  if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ action: "openOptions" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            window.open(chrome.runtime.getURL("options.html"), "_blank");
          }
        });
      } catch (err) {
        window.open(chrome.runtime.getURL("options.html"), "_blank");
      }
    });
  }

  loadCurrentVideoNotes();
}

// Load and display notes isolated strictly to the active video ID
function loadCurrentVideoNotes() {
  const videoId = getYouTubeVideoId(window.location.href);
  const list = document.getElementById("yt-notes-list");
  if (!list) return;

  if (!videoId) {
    list.innerHTML = `<div style="font-size:12px; color:#aaa;">No video detected.</div>`;
    return;
  }

  chrome.storage.local.get({ notes: [] }, (data) => {
    // Filter strictly by videoId
    const matching = data.notes.filter(n => n.videoId === videoId || n.url.includes(`v=${videoId}`));
    
    if (matching.length === 0) {
      list.innerHTML = `<div style="font-size:12px; color:#aaa;">No notes saved for this video yet.</div>`;
      return;
    }

    list.innerHTML = "";
    matching.forEach(n => {
      const mins = Math.floor(n.time / 60);
      const secs = n.time % 60;
      const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      const itemDiv = document.createElement("div");
      itemDiv.style.cssText = "padding: 4px 0; border-bottom: 1px solid #333; font-size: 12px;";

      const timeSpan = document.createElement("span");
      timeSpan.style.cssText = "color: #3ea6ff; cursor: pointer; font-weight: bold; margin-right: 6px;";
      timeSpan.innerText = `[${fmt}]`;

      timeSpan.addEventListener("click", () => {
        const video = document.querySelector("video");
        if (video) {
          video.currentTime = n.time;
          video.play();
        }
      });

      const textSpan = document.createElement("span");
      textSpan.innerText = n.text;

      itemDiv.appendChild(timeSpan);
      itemDiv.appendChild(textSpan);
      list.appendChild(itemDiv);
    });
  });
}

// Track SPA URL shifts to reload notes when clicking recommended videos
let lastVideoId = getYouTubeVideoId(window.location.href);
let timeout = null;

const observer = new MutationObserver(() => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    const currentVideoId = getYouTubeVideoId(window.location.href);
    
    if (window.location.pathname === "/watch") {
      if (!document.getElementById("custom-yt-notes-panel")) {
        injectNotePanel();
      } else if (currentVideoId !== lastVideoId) {
        lastVideoId = currentVideoId;
        loadCurrentVideoNotes();
      }
    }
  }, 300);
});

// Observe DOM changes safely
observer.observe(document.body, { childList: true, subtree: true });