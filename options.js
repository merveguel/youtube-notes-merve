document.addEventListener("DOMContentLoaded", () => {
  const notesContainer = document.getElementById("notes-container");
  const searchInput = document.getElementById("search-input");
  const exportBtn = document.getElementById("export-all-btn");
  const importInput = document.getElementById("import-file-input");

  // Format seconds to mm:ss or hh:mm:ss
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const fmtSecs = secs < 10 ? `0${secs}` : secs;

    if (hrs > 0) {
      const fmtMins = mins < 10 ? `0${mins}` : mins;
      return `${hrs}:${fmtMins}:${fmtSecs}`;
    }
    return `${mins}:${fmtSecs}`;
  }

  // Group individual note records by videoId
  function groupNotesByVideo(notes) {
    return notes.reduce((acc, note) => {
      const key = note.videoId || note.url;
      if (!acc[key]) {
        acc[key] = {
          videoId: note.videoId,
          title: note.title || "Untitled Video",
          url: note.url,
          thumbnail: note.thumbnail || (note.videoId ? `https://img.youtube.com/vi/${note.videoId}/hqdefault.jpg` : ""),
          notes: []
        };
      }
      acc[key].notes.push(note);
      return acc;
    }, {});
  }

  // Render Dashboard
  function loadDashboard(filterQuery = "") {
    if (!notesContainer) return;

    chrome.storage.local.get({ notes: [] }, (data) => {
      let allNotes = data.notes || [];

      // Apply Real-time Search Filter
      if (filterQuery.trim() !== "") {
        const q = filterQuery.toLowerCase();
        allNotes = allNotes.filter(n => 
          (n.title && n.title.toLowerCase().includes(q)) || 
          (n.text && n.text.toLowerCase().includes(q))
        );
      }

      if (allNotes.length === 0) {
        notesContainer.innerHTML = `
          <div style="text-align: center; color: #aaa; margin-top: 40px; font-size: 14px;">
            ${filterQuery ? "No matching notes found." : "No saved YouTube notes yet."}
          </div>`;
        return;
      }

      const grouped = groupNotesByVideo(allNotes);
      notesContainer.innerHTML = "";

      Object.values(grouped).forEach(videoGroup => {
        const card = document.createElement("div");
        card.className = "video-card";
        card.style.cssText = `
          background: #212121;
          border: 1px solid #333;
          border-radius: 8px;
          margin-bottom: 16px;
          padding: 12px;
          display: flex;
          gap: 16px;
        `;

        // Thumbnail Column
        const thumbCol = document.createElement("div");
        thumbCol.style.cssText = "width: 160px; flex-shrink: 0;";
        thumbCol.innerHTML = `
          <a href="${videoGroup.url}" target="_blank">
            <img src="${videoGroup.thumbnail}" style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;" alt="Thumbnail">
          </a>
        `;

        // Details Column
        const detailsCol = document.createElement("div");
        detailsCol.style.cssText = "flex-grow: 1;";

        const titleEl = document.createElement("h4");
        titleEl.style.cssText = "margin: 0 0 10px 0; font-size: 15px; color: #fff;";
        titleEl.innerHTML = `<a href="${videoGroup.url}" target="_blank" style="color: #fff; text-decoration: none;">${videoGroup.title}</a>`;
        detailsCol.appendChild(titleEl);

        const notesList = document.createElement("div");
        notesList.className = "notes-list";

        // Sort notes by timestamp sequentially
        videoGroup.notes.sort((a, b) => a.time - b.time).forEach(note => {
          const item = document.createElement("div");
          item.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #2e2e2e;
            font-size: 13px;
          `;

          const leftSide = document.createElement("div");
          
          const timestampSpan = document.createElement("span");
          timestampSpan.style.cssText = "color: #3ea6ff; cursor: pointer; font-weight: bold; margin-right: 8px;";
          timestampSpan.innerText = `[${formatTime(note.time)}]`;
          timestampSpan.addEventListener("click", () => {
            window.open(`${videoGroup.url}&t=${note.time}s`, "_blank");
          });

          const textSpan = document.createElement("span");
          textSpan.style.color = "#ddd";
          textSpan.innerText = note.text;

          leftSide.appendChild(timestampSpan);
          leftSide.appendChild(textSpan);

          // Delete Button
          const delBtn = document.createElement("button");
          delBtn.innerText = "✕";
          delBtn.title = "Delete Note";
          delBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 14px;
            padding: 2px 6px;
          `;
          delBtn.addEventListener("mouseover", () => delBtn.style.color = "#ff4e4e");
          delBtn.addEventListener("mouseout", () => delBtn.style.color = "#888");
          delBtn.addEventListener("click", () => {
            if (confirm("Delete this note?")) {
              chrome.storage.local.get({ notes: [] }, (allData) => {
                const updated = allData.notes.filter(n => n.id !== note.id);
                chrome.storage.local.set({ notes: updated }, () => {
                  loadDashboard(searchInput ? searchInput.value : "");
                });
              });
            }
          });

          item.appendChild(leftSide);
          item.appendChild(delBtn);
          notesList.appendChild(item);
        });

        detailsCol.appendChild(notesList);
        card.appendChild(thumbCol);
        card.appendChild(detailsCol);
        notesContainer.appendChild(card);
      });
    });
  }

  // Real-time Search Listener
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      loadDashboard(e.target.value);
    });
  }

  // Export JSON Database Backup
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      chrome.storage.local.get({ notes: [] }, (data) => {
        const notes = data.notes || [];
        if (notes.length === 0) {
          alert("No notes available to export.");
          return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `youtube_notes_backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    });
  }

  // Import JSON Database Backup
  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedNotes = JSON.parse(event.target.result);
          if (Array.isArray(importedNotes)) {
            chrome.storage.local.get({ notes: [] }, (data) => {
              const existingNotes = data.notes || [];
              // Merge imported notes safely without duplicate IDs
              const existingIds = new Set(existingNotes.map(n => n.id));
              const newNotes = importedNotes.filter(n => !existingIds.has(n.id));
              const merged = [...existingNotes, ...newNotes];

              chrome.storage.local.set({ notes: merged }, () => {
                alert("Notes imported successfully!");
                loadDashboard();
              });
            });
          } else {
            alert("Invalid JSON format.");
          }
        } catch (err) {
          alert("Error parsing JSON file.");
        }
      };
      reader.readAsText(file);
    });
  }

  loadDashboard();
});