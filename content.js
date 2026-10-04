// Respond to time requests from popup.js or extension messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTime") {
    const video = document.querySelector("video");
    sendResponse({ time: video ? video.currentTime : 0 });
  }
});

// Utility: Extract YouTube Video ID from URL
function getYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match && match[1] ? match[1] : null;
}

// Utility: Construct Thumbnail URL from Video ID
function getYouTubeThumbnail(videoId) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
}

// Safely Inject Sidebar Panel into YouTube DOM
function injectNotePanel() {
  // Prevent duplicate panel injections
  if (document.getElementById("custom-yt-notes-panel")) return;

  // Target YouTube's primary sidebar container
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
    <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #fff;">Youtube Notes for Merve</h3>
    <textarea id="yt-note-input" placeholder="Write a note... (Ctrl+Enter to save)" style="width: 100%; height: 60px; box-sizing: border-box; background: #181818; color: white; border: 1px solid #383838; border-radius: 4px; padding: 6px; resize: vertical; font-family: inherit; font-size: 13px;"></textarea>
    <button id="yt-note-save-btn" style="width: 100%; padding: 6px; margin-top: 6px; background: #3ea6ff; color: #0f0f0f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">Save Note (Ctrl+Enter)</button>
    <div id="yt-notes-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto;"></div>
    <button id="yt-open-dashboard" style="width: 100%; padding: 6px; margin-top: 8px; background: transparent; color: #aaa; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 12px;">Open Full Dashboard ↗</button>
  `;

  // Place panel at the very top of the secondary sidebar
  secondary.insertBefore(panel, secondary.firstChild);

  // Core Save Note Handler
  const saveNote = () => {
    const textInput = document.getElementById("yt-note-input");
    const text = textInput ? textInput.value.trim() : "";
    if (!text) return;

    const currentUrl = window.location.href;
    const videoId = getYouTubeVideoId(currentUrl);
    if (!videoId) return alert("Could not identify YouTube video ID.");

    // Auto-capture current video playback time
    const video = document.querySelector("video");
    const currentTimestamp = video ? Math.floor(video.currentTime) : 0;

    const videoTitle = document.querySelector("h1.ytd-watch-metadata")?.innerText || document.title.replace("- YouTube", "").trim();
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = getYouTubeThumbnail(videoId);

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

    chrome.storage.local.get({ notes: [] }, (data) => {
      const updated = [...data.notes, newNote];
      chrome.storage.local.set({ notes: updated }, () => {
        if (textInput) textInput.value = "";
        loadCurrentVideoNotes();
      });
    });
  };

  // 1. Save on Button Click
  document.getElementById("yt-note-save-btn").addEventListener("click", saveNote);

  // 2. Save on Ctrl + Enter or Cmd + Enter inside Textarea
  const textarea = document.getElementById("yt-note-input");
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveNote();
      }
    });
  }

  // 3. Open Dashboard Handler
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

// Load and render notes isolated strictly to the active video ID
function loadCurrentVideoNotes() {
  const videoId = getYouTubeVideoId(window.location.href);
  const list = document.getElementById("yt-notes-list");
  if (!list) return;

  if (!videoId) {
    list.innerHTML = `<div style="font-size:12px; color:#aaa;">No video detected.</div>`;
    return;
  }

  chrome.storage.local.get({ notes: [] }, (data) => {
    // Filter notes strictly for current video
    const matching = data.notes.filter(n => n.videoId === videoId || (n.url && n.url.includes(`v=${videoId}`)));

    if (matching.length === 0) {
      list.innerHTML = `<div style="font-size:12px; color:#aaa;">No notes saved for this video yet.</div>`;
      return;
    }

    list.innerHTML = "";
    // Sort notes sequentially by timestamp
    matching.sort((a, b) => a.time - b.time).forEach(n => {
      const mins = Math.floor(n.time / 60);
      const secs = n.time % 60;
      const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      const itemDiv = document.createElement("div");
      itemDiv.style.cssText = "padding: 5px 0; border-bottom: 1px solid #333; font-size: 12px; display: flex; justify-content: space-between; align-items: flex-start;";

      const contentContainer = document.createElement("div");
      contentContainer.style.cssText = "flex-grow: 1; word-break: break-word; padding-right: 6px;";

      const timeSpan = document.createElement("span");
      timeSpan.style.cssText = "color: #3ea6ff; cursor: pointer; font-weight: bold; margin-right: 6px;";
      timeSpan.innerText = `[${fmt}]`;

      // Jump to timestamp in video player on click
      timeSpan.addEventListener("click", () => {
        const video = document.querySelector("video");
        if (video) {
          video.currentTime = n.time;
          video.play();
        }
      });

      const textSpan = document.createElement("span");
      textSpan.innerText = n.text;

      contentContainer.appendChild(timeSpan);
      contentContainer.appendChild(textSpan);

      // Inline Delete Button
      const delBtn = document.createElement("button");
      delBtn.innerText = "✕";
      delBtn.title = "Delete Note";
      delBtn.style.cssText = "background: transparent; border: none; color: #777; cursor: pointer; font-size: 12px; padding: 0 2px;";
      delBtn.addEventListener("mouseover", () => delBtn.style.color = "#ff4e4e");
      delBtn.addEventListener("mouseout", () => delBtn.style.color = "#777");
      delBtn.addEventListener("click", () => {
        chrome.storage.local.get({ notes: [] }, (allData) => {
          const filtered = allData.notes.filter(item => item.id !== n.id);
          chrome.storage.local.set({ notes: filtered }, () => {
            loadCurrentVideoNotes();
          });
        });
      });

      itemDiv.appendChild(contentContainer);
      itemDiv.appendChild(delBtn);
      list.appendChild(itemDiv);
    });
  });
}

// Observe YouTube SPA page shifts to handle dynamic video transitions
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

// Observe DOM changes on YouTube body
observer.observe(document.body, { childList: true, subtree: true });