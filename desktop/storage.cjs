// File storage for the desktop app. The game's storage keys map to files under Documents/FightCamp:
//   saves/career-N.fcsave           a career (slot N)
//   saves/backups/career-N.backup.fcsave   the previous save of that slot
//   saves/fights/career-N.checkpoint|.replay   mid-fight checkpoint and last fight's replay
//   settings.json, look-presets.json, data/<key>.dat   everything else
// Folders are created on the first write. Writes are atomic (temp file, then rename).
const fs = require('fs');
const path = require('path');

function createStore(base) {
  const SAVES = path.join(base, 'saves');
  const rules = [
    [/^fightcamp\.slot\.(\d+)$/, (n) => path.join(SAVES, `career-${n}.fcsave`)],
    [/^fightcamp\.slot\.(\d+)\.bak$/, (n) => path.join(SAVES, 'backups', `career-${n}.backup.fcsave`)],
    [/^fightcamp\.fight\.(\d+)$/, (n) => path.join(SAVES, 'fights', `career-${n}.checkpoint`)],
    [/^fightcamp\.replay\.(\d+)$/, (n) => path.join(SAVES, 'fights', `career-${n}.replay`)],
    [/^fightcamp\.meta$/, () => path.join(base, 'settings.json')],
    [/^fightcamp\.lookPresets$/, () => path.join(base, 'look-presets.json')],
  ];
  const fileFor = (key) => {
    for (const [re, f] of rules) { const m = re.exec(key); if (m) return f(m[1]); }
    return path.join(base, 'data', encodeURIComponent(key) + '.dat');
  };
  const keyFor = (file) => {
    const rel = path.relative(base, file).split(path.sep).join('/');
    let m;
    if ((m = /^saves\/career-(\d+)\.fcsave$/.exec(rel))) return `fightcamp.slot.${m[1]}`;
    if ((m = /^saves\/backups\/career-(\d+)\.backup\.fcsave$/.exec(rel))) return `fightcamp.slot.${m[1]}.bak`;
    if ((m = /^saves\/fights\/career-(\d+)\.checkpoint$/.exec(rel))) return `fightcamp.fight.${m[1]}`;
    if ((m = /^saves\/fights\/career-(\d+)\.replay$/.exec(rel))) return `fightcamp.replay.${m[1]}`;
    if (rel === 'settings.json') return 'fightcamp.meta';
    if (rel === 'look-presets.json') return 'fightcamp.lookPresets';
    if ((m = /^data\/(.+)\.dat$/.exec(rel))) return decodeURIComponent(m[1]);
    return null;
  };
  const list = (dir) => { try { return fs.readdirSync(dir).map((f) => path.join(dir, f)); } catch { return []; } };
  return {
    base, saves: SAVES, fileFor,
    getItem(key) {
      try { return fs.readFileSync(fileFor(key), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    setItem(key, value) {
      const f = fileFor(key);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const tmp = `${f}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, String(value), 'utf8');
      fs.renameSync(tmp, f);
    },
    removeItem(key) { try { fs.unlinkSync(fileFor(key)); } catch (e) { if (e.code !== 'ENOENT') throw e; } },
    keys() {
      const files = [path.join(base, 'settings.json'), path.join(base, 'look-presets.json'), ...list(SAVES), ...list(path.join(SAVES, 'backups')), ...list(path.join(SAVES, 'fights')), ...list(path.join(base, 'data'))];
      return files.filter((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } }).map(keyFor).filter(Boolean);
    },
  };
}
module.exports = { createStore };
