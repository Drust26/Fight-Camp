// Exposes the save bridge to the game (window.fightcampNative). Calls are synchronous so the game's save code
// works the same as with browser storage; every call returns { ok, value | error }.
const { contextBridge, ipcRenderer } = require('electron');
const call = (op, ...args) => {
  const r = ipcRenderer.sendSync('fc-storage', op, ...args);
  if (!r || !r.ok) throw new Error(r?.error || 'Storage error');
  return r.value;
};
const info = ipcRenderer.sendSync('fc-info');
contextBridge.exposeInMainWorld('fightcampNative', {
  isDesktop: true,
  appVersion: info.version,
  dataDir: () => info.base,
  savesDir: () => info.saves,
  openSavesFolder: () => ipcRenderer.send('fc-open-saves'),
  updates: {
    get: () => ipcRenderer.invoke('fc-update-get'),
    check: () => ipcRenderer.invoke('fc-update-check'),
    install: () => ipcRenderer.invoke('fc-update-install'),
    later: () => ipcRenderer.invoke('fc-update-later'),
    onState: (cb) => { const h = (_e, st) => cb(st); ipcRenderer.on('fc-update-state', h); return () => ipcRenderer.removeListener('fc-update-state', h); },
  },
  storage: {
    getItem: (k) => call('getItem', String(k)),
    setItem: (k, v) => { call('setItem', String(k), String(v)); },
    removeItem: (k) => { call('removeItem', String(k)); },
    keys: () => call('keys'),
  },
});
