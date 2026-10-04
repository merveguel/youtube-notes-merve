// Respond to time requests from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTime") {
    const video = document.querySelector("video");
    sendResponse({ time: video ? video.currentTime : 0 });
  }
});

// Extract YouTube Video ID to construct Thumbnail URL
function getYouTubeThumbnail(url) {
  const match = url.match(/[?&]v=([^&]+)/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return "";
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
    <button id="yt-note-capture-btn" style="width: 100%; padding: 6px; background: #cc0000; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Timestamp Note</button>
    <textarea id="yt-note-input" placeholder="Write a note for this timestamp..." style="width: 100%; height: 50px; margin-top: 8px; box-sizing: border-box; background: #181818; color: white; border: 1px solid #383838; border-radius: 4px; padding: 6px; resize: vertical;"></textarea>
    <button id="yt-note-save-btn" style="width: 100%; padding: 6px; margin-top: 6px; background: #3ea6ff; color: #0f0f0f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Note</button>
    <div id="yt-notes-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto;"></div>
    <button id="yt-open-dashboard" style="width: 100%; padding: 6px; margin-top: 8px; background: transparent; color: #aaa; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 12px;">Open Full Dashboard ↗</button>
  `;

  // Safely insert panel at the top of the sidebar without disturbing existing YouTube elements
  secondary.insertBefore(panel, secondary.firstChild);

  let capturedTime = 0;

  // Capture current playback time
  document.getElementById("yt-note-capture-btn").addEventListener("click", () => {
    const video = document.querySelector("video");
    if (video) {
      capturedTime = Math.floor(video.currentTime);
      const mins = Math.floor(capturedTime / 60);
      const secs = capturedTime % 60;
      document.getElementById("yt-note-capture-btn").innerText = `Timestamp: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
  });

  // Save note to chrome.storage
  document.getElementById("yt-note-save-btn").addEventListener("click", () => {
    const text = document.getElementById("yt-note-input").value;
    if (!text) return;

    const videoTitle = document.querySelector("h1.ytd-watch-metadata")?.innerText || document.title.replace("- YouTube", "").trim();
    const videoUrl = window.location.href.split("&")[0];
    const thumbnailUrl = getYouTubeThumbnail(videoUrl);

    chrome.storage.local.get({ notes: [] }, (data) => {
      const newNote = {
        id: Date.now(),
        url: videoUrl,
        title: videoTitle,
        thumbnail: thumbnailUrl,
        time: capturedTime,
        text: text,
        date: new Date().toLocaleDateString()
      };
      
      const updated = [...data.notes, newNote];
      chrome.storage.local.set({ notes: updated }, () => {
        document.getElementById("yt-note-input").value = "";
        loadCurrentVideoNotes();
      });
    });
  });

  // Dual-fallback Dashboard button handler
  const dashboardBtn = document.getElementById("yt-open-dashboard");
  if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ action: "openOptions" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // Direct tab fallback if background script doesn't respond
            window.open(chrome.runtime.getURL("options.html"), "_blank");
          }
        });
      } catch (err) {
        // Ultimate fallback
        window.open(chrome.runtime.getURL("options.html"), "_blank");
      }
    });
  }

  loadCurrentVideoNotes();
}

// Load and display notes saved for the active video
function loadCurrentVideoNotes() {
  const currentUrl = window.location.href.split("&")[0];
  chrome.storage.local.get({ notes: [] }, (data) => {
    const list = document.getElementById("yt-notes-list");
    if (!list) return;
    
    const matching = data.notes.filter(n => n.url === currentUrl);
    if (matching.length === 0) {
      list.innerHTML = `<div style="font-size:12px; color:#aaa;">No notes saved for this video yet.</div>`;
      return;
    }
    list.innerHTML = matching.map(n => {
      const mins = Math.floor(n.time / 60);
      const secs = n.time % 60;
      const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      return `<div style="padding: 4px 0; border-bottom: 1px solid #333; font-size: 12px;">
        <span style="color: #3ea6ff; cursor: pointer; font-weight: bold;" onclick="document.querySelector('video').currentTime=${n.time}">[${fmt}]</span> ${n.text}
      </div>`;
    }).join("");
  });
}

// Debounce function to prevent MutationObserver infinite loops on YouTube SPA navigation
let timeout = null;
const observer = new MutationObserver(() => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    // Only run if on a watch page and panel isn't present
    if (window.location.pathname === "/watch" && !document.getElementById("custom-yt-notes-panel")) {
      injectNotePanel();
    }
  }, 300);
});

// Observe child DOM changes safely
observer.observe(document.body, { childList: true, subtree: true });