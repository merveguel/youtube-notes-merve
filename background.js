importScripts('dexie.js');
const db = new Dexie("YouTubeNotesDB");
db.version(1).stores({ notes: "++id, videoId, text" });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "saveNote") {
    db.notes.add(msg.note).then(() => sendResponse({ success: true }));
    return true;
  }
});