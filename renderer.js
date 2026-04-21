window.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveBtn = document.getElementById('save');
  const saveAsBtn = document.getElementById('save-as');
  const newNoteBtn = document.getElementById('new-note');
  const openFileBtn = document.getElementById('open-file');
  const deleteBtn = document.getElementById('deleteBtn');
  const statusEl = document.getElementById('status');
  const list = document.getElementById('notes-list');

  let currentNoteId = null;
  let lastSavedText = '';
  let currentFilePath = null;
  let debounceTimer;

  async function loadNotes() {
    const notes = await window.electronAPI.getNotes();
    list.innerHTML = '';
    notes.forEach(note => {
      const li = document.createElement('li');
      li.textContent = note.title;
      li.onclick = () => {
        currentNoteId = note.id;
        textarea.value = note.content;
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = 'X';
      delBtn.onclick = async () => {
        await window.electronAPI.deleteNote(note.id);
        loadNotes();
      };
      li.appendChild(delBtn);
      list.appendChild(li);
    });
  }

  async function autoSave() {
    const currentText = textarea.value;
    if (currentText === lastSavedText) {
      statusEl.textContent = 'No changes to save';
      return;
    }
    try {
      await window.electronAPI.saveNoteJson({
        id: currentNoteId || Date.now().toString(),
        title: currentText.substring(0, 10),
        content: currentText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      currentNoteId = currentNoteId || Date.now().toString();
      lastSavedText = currentText;
      const now = new Date().toLocaleTimeString();
      statusEl.textContent = `Auto-saved at ${now}`;
      loadNotes();
    } catch (err) {
      statusEl.textContent = 'Auto-save error!';
    }
  }

  saveBtn.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.smartSave(textarea.value, currentFilePath);
      lastSavedText = textarea.value;
      currentFilePath = result.filePath;
      statusEl.textContent = `Saved to: ${result.filePath}`;
    } catch (err) {
      statusEl.textContent = 'Save failed!';
    }
  });

  saveAsBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.saveAs(textarea.value);
    if (result.success) {
      lastSavedText = textarea.value;
      currentFilePath = result.filePath;
      statusEl.textContent = `Saved to: ${result.filePath}`;
    } else {
      statusEl.textContent = 'Save As cancelled.';
    }
  });

  newNoteBtn.addEventListener('click', async () => {
    if (textarea.value === lastSavedText) {
      textarea.value = '';
      lastSavedText = '';
      statusEl.textContent = 'New note started.';
      return;
    }
    const result = await window.electronAPI.newNote();
    if (result.confirmed) {
      textarea.value = '';
      lastSavedText = '';
      statusEl.textContent = 'New note started.';
    } else {
      statusEl.textContent = 'New note cancelled.';
    }
  });

  openFileBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.openFile();
    if (result.success) {
      textarea.value = result.content;
      lastSavedText = result.content;
      currentFilePath = result.filePath;
      statusEl.textContent = `Opened: ${result.filePath}`;
    } else {
      statusEl.textContent = 'Open cancelled.';
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (confirm('Really delete ALL notes? This cannot be undone!')) {
      try {
        await window.electronAPI.deleteNote(currentNoteId);
        textarea.value = '';
        lastSavedText = '';
        statusEl.textContent = 'All notes deleted!';
        statusEl.style.color = 'red';
        loadNotes();
      } catch (err) {
        statusEl.textContent = 'Delete failed!';
      }
    }
  });

  textarea.addEventListener('input', () => {
    statusEl.textContent = 'Changes detected - auto-saving in 5s...';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(autoSave, 5000);
  });

  window.electronAPI.onMenuAction('menu-new', () => newNoteBtn.click());
  window.electronAPI.onMenuAction('menu-open', () => openFileBtn.click());
  window.electronAPI.onMenuAction('menu-save', () => saveBtn.click());
  window.electronAPI.onMenuAction('menu-save-as', () => saveAsBtn.click());

  loadNotes();
});