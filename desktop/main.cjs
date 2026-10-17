// Fight Camp desktop shell: one window running the game, saves as files in Documents/FightCamp/saves.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { createStore } = require('./storage.cjs');
const updater = require('./updater.cjs');

app.setName('Fight Camp');
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// FIGHTCAMP_DATA_DIR overrides the location (used by tests); otherwise Documents/FightCamp
function documentsDir() {
  const docs = app.getPath('documents');
  // some Linux setups report the home folder itself; use ~/Documents there
  const homes = [app.getPath('home'), require('os').homedir(), process.env.HOME].filter(Boolean).map((h) => path.resolve(h));
  return homes.includes(path.resolve(docs)) ? path.join(docs, 'Documents') : docs;
}
const base = process.env.FIGHTCAMP_DATA_DIR || path.join(documentsDir(), 'FightCamp');
const store = createStore(base);

ipcMain.on('fc-info', (e) => { e.returnValue = { base: store.base, saves: store.saves, version: app.getVersion() }; });
ipcMain.on('fc-storage', (e, op, ...args) => {
  try {
    if (!['getItem', 'setItem', 'removeItem', 'keys'].includes(op)) throw new Error('Unknown storage call');
    e.returnValue = { ok: true, value: store[op](...args) ?? null };
  } catch (err) {
    e.returnValue = { ok: false, error: String(err && err.message || err) };
  }
});
ipcMain.on('fc-open-saves', () => { fs.mkdirSync(store.saves, { recursive: true }); shell.openPath(store.saves); });

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    title: 'Fight Camp', backgroundColor: '#0b0d12', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // links open in the system browser; the game window never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); updater.init(); });
app.on('window-all-closed', () => app.quit());
