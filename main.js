const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let tray = null;
const notesFilePath = path.join(app.getPath('userData'), 'notes.json');

function readNotes() {
  if (!fs.existsSync(notesFilePath)) return [];
  const raw = fs.readFileSync(notesFilePath, 'utf-8');
  return JSON.parse(raw);
}
function writeNotes(notes) {
  fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });
}

app.whenReady().then(() => {
  createWindow();

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { label: 'New Note', accelerator: 'CmdOrCtrl+N',
          click: () => BrowserWindow.getFocusedWindow().webContents.send('menu-new') },
        { label: 'Open File', accelerator: 'CmdOrCtrl+O',
          click: () => BrowserWindow.getFocusedWindow().webContents.send('menu-open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S',
          click: () => BrowserWindow.getFocusedWindow().webContents.send('menu-save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S',
          click: () => BrowserWindow.getFocusedWindow().webContents.send('menu-save-as') },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => BrowserWindow.getAllWindows()[0].show() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Quick Note Taker');
  tray.setContextMenu(trayMenu);
  tray.on('double-click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isVisible()) win.hide();
    else win.show();
  });
});

ipcMain.handle('get-notes', async () => readNotes());
ipcMain.handle('delete-note', async (event, id) => {
  const notes = readNotes().filter(n => n.id !== id);
  writeNotes(notes);
  return { success: true };
});
ipcMain.handle('save-note-json', async (event, note) => {
  const notes = readNotes();
  const index = notes.findIndex(n => n.id === note.id);
  const now = new Date().toISOString();
  if (index === -1) notes.push({ ...note, createdAt: now, updatedAt: now });
  else notes[index] = { ...notes[index], ...note, updatedAt: now };
  writeNotes(notes);
  return { success: true };
});

ipcMain.handle('save-as', async (event, text) => {
  const result = await dialog.showSaveDialog({
    defaultPath: 'mynote.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, text, 'utf-8');
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('new-note', async () => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Discard Changes', 'Cancel'],
    defaultId: 1,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Start a new note anyway?'
  });
  return { confirmed: result.response === 0 };
});

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (result.canceled) return { success: false };
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { success: true, content, filePath };
});

ipcMain.handle('smart-save', async (event, text, filePath) => {
  const targetPath = filePath || path.join(app.getPath('documents'), 'quicknote.txt');
  fs.writeFileSync(targetPath, text, 'utf-8');
  return { success: true, filePath: targetPath };
});
