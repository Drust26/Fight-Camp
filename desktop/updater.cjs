// Auto-update from GitHub Releases.
//
// On launch the packaged Windows app asks GitHub for the latest release of Drust26/Fight-Camp. When it is newer than
// the running version, its installer (FightCamp-Setup-<version>.exe) is downloaded in the background, checked against
// the SHA-256 published with the release, and the game is told an update is ready. "Restart and update" closes the
// game, runs the installer silently over the current install and reopens the game. If the player picks "Later", the
// update installs silently when they quit. Saves live in Documents/FightCamp and are never touched.
//
// Testing: FIGHTCAMP_UPDATE_URL points the check at another releases/latest JSON, and FIGHTCAMP_UPDATE_DRYRUN=1 records
// the install command in <temp>/FightCamp-update/dryrun.json instead of running it (for non-Windows test runs).
const { app, net, ipcMain, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = 'Drust26/Fight-Camp';
const API = process.env.FIGHTCAMP_UPDATE_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const DRYRUN = process.env.FIGHTCAMP_UPDATE_DRYRUN === '1';
const ENABLED = !!process.env.FIGHTCAMP_UPDATE_URL || (app.isPackaged && process.platform === 'win32');
const DIR = path.join(app.getPath('temp'), 'FightCamp-update');

let state = { status: 'idle', current: app.getVersion() }; // idle | checking | none | downloading | ready | error | disabled
let file = null; // the verified installer
let installOnQuit = false;
let installing = false;

const parse = (v) => String(v || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
function newer(a, b) { // a > b
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

function send() {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('fc-update-state', state);
}
function set(patch) { state = { ...state, ...patch }; send(); }

async function getJSON(url) {
  const r = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FightCamp-Updater' } });
  if (r.status === 404) return null; // no release published yet
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
  return r.json();
}

async function expectedHash(release, asset) {
  if (typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')) return asset.digest.slice(7).toLowerCase();
  const side = (release.assets || []).find((a) => a.name === `${asset.name}.sha256`);
  if (!side) return null;
  const r = await net.fetch(side.browser_download_url, { headers: { 'User-Agent': 'FightCamp-Updater' } });
  if (!r.ok) throw new Error(`Checksum download failed (${r.status})`);
  return (await r.text()).trim().split(/\s+/)[0].toLowerCase();
}

async function download(url, dest, size, onProgress) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'FightCamp-Updater' } });
  if (!r.ok || !r.body) throw new Error(`Download failed (${r.status})`);
  const total = Number(r.headers.get('content-length')) || size || 0;
  const hash = crypto.createHash('sha256');
  const tmp = `${dest}.partial`;
  const out = fs.createWriteStream(tmp);
  const reader = r.body.getReader();
  let got = 0, last = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      hash.update(buf);
      if (!out.write(buf)) await new Promise((res) => out.once('drain', res));
      got += buf.length;
      const now = Date.now();
      if (now - last > 250) { last = now; onProgress(got, total); }
    }
  } finally {
    await new Promise((res) => out.end(res));
  }
  onProgress(got, total);
  return { tmp, sha256: hash.digest('hex'), bytes: got };
}

async function check() {
  if (!ENABLED) { set({ status: 'disabled' }); return; }
  if (['checking', 'downloading', 'ready'].includes(state.status)) return;
  set({ status: 'checking', error: undefined });
  try {
    const rel = await getJSON(API);
    if (!rel) { set({ status: 'none' }); return; }
    const version = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
    if (!version || rel.draft || rel.prerelease || !newer(version, app.getVersion())) { set({ status: 'none', latest: version || undefined }); return; }
    const asset = (rel.assets || []).find((a) => /^FightCamp-Setup-.*\.exe$/i.test(a.name));
    if (!asset) { set({ status: 'none', latest: version }); return; }
    const sha = await expectedHash(rel, asset);
    if (!sha) throw new Error('The release has no checksum, so the download cannot be verified');
    const notes = String(rel.body || '').slice(0, 1500);
    set({ status: 'downloading', version, notes, progress: 0, total: asset.size || 0 });
    fs.mkdirSync(DIR, { recursive: true });
    const dest = path.join(DIR, asset.name);
    if (fs.existsSync(dest) && crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === sha) {
      file = dest; set({ status: 'ready', progress: 1 }); return; // already downloaded earlier
    }
    const res = await download(asset.browser_download_url, dest, asset.size, (got, total) => set({ progress: total ? got / total : 0, received: got, total }));
    if (res.sha256 !== sha) { fs.rmSync(res.tmp, { force: true }); throw new Error('The downloaded update did not match its checksum and was discarded'); }
    fs.renameSync(res.tmp, dest);
    file = dest;
    set({ status: 'ready', progress: 1 });
  } catch (e) {
    set({ status: 'error', error: String((e && e.message) || e) });
  }
}

function runInstaller(relaunch) {
  if (!file || installing) return false;
  installing = true;
  const args = ['/S', ...(relaunch ? ['/RELAUNCH'] : [])];
  if (DRYRUN) fs.writeFileSync(path.join(DIR, 'dryrun.json'), JSON.stringify({ file, args, at: Date.now() }));
  else spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  return true;
}

function init() {
  ipcMain.handle('fc-update-get', () => state);
  ipcMain.handle('fc-update-check', async () => { await check(); return state; });
  ipcMain.handle('fc-update-install', () => { if (runInstaller(true)) setTimeout(() => app.quit(), 150); return state.status; });
  ipcMain.handle('fc-update-later', () => { installOnQuit = state.status === 'ready'; return installOnQuit; });
  app.on('will-quit', () => { if (installOnQuit && !installing) runInstaller(false); });
  // first check shortly after launch, then every 4 hours while the game stays open
  setTimeout(check, 4000);
  setInterval(() => { if (state.status === 'none' || state.status === 'error') check(); }, 4 * 3600 * 1000);
}

module.exports = { init, check, newer, _state: () => state };
