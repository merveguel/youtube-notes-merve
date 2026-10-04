function renderDashboard() {
  chrome.storage.local.get({ notes: [] }, (data) => {
    const container = document.getElementById("dashboard-container");
    
    if (data.notes.length === 0) {
      container.innerHTML = "<p style='color:#aaa;'>No YouTube notes saved yet.</p>";
      return;
    }

    // Group notes by video URL
    const grouped = {};
    data.notes.forEach(note => {
      if (!grouped[note.url]) {
        // Fallback for thumbnail if older notes didn't save it
        const match = note.url.match(/[?&]v=([^&]+)/);
        const thumb = note.thumbnail || (match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : "");
        
        grouped[note.url] = {
          title: note.title || "YouTube Video",
          thumbnail: thumb,
          items: []
        };
      }
      grouped[note.url].items.push(note);
    });

    container.innerHTML = Object.keys(grouped).map(url => {
      const video = grouped[url];
      
      const itemsHtml = video.items.map(n => {
        const mins = Math.floor(n.time / 60);
        const secs = n.time % 60;
        const fmt = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        const jumpUrl = `${url}&t=${n.time}s`;
        
        return `
          <div class="note-item">
            <a href="${jumpUrl}" target="_blank" class="timestamp-link">[${fmt}]</a>
            <span>${n.text}</span>
          </div>
        `;
      }).join("");

      const imageTag = video.thumbnail 
        ? `<img src="${video.thumbnail}" alt="Video thumbnail">`
        : `<div style="width:100%;height:100px;background:#333;border-radius:6px;"></div>`;

      return `
        <div class="card">
          <div class="thumbnail-box">
            <a href="${url}" target="_blank">${imageTag}</a>
          </div>
          <div class="content-box">
            <a href="${url}" target="_blank" class="video-title">${video.title}</a>
            <div class="video-url">${url}</div>
            <div>${itemsHtml}</div>
          </div>
        </div>
      `;
    }).join("");
  });
}

// Render on page load
renderDashboard();

// Live update dashboard if notes change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.notes) {
    renderDashboard();
  }
});