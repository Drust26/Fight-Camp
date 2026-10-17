// Prints the CHANGELOG.md section for one version (used as the GitHub release text and shown in the in-game
// update prompt). Falls back to a short line when the version has no section.
const fs = require('fs');
const path = require('path');
const version = (process.argv[2] || '').replace(/^v/, '');
const text = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const lines = text.split(/\r?\n/);
const start = lines.findIndex((l) => new RegExp(`^##\\s+v?${version.replace(/\./g, '\\.')}\\b`).test(l));
if (start < 0) { console.log(`Fight Camp ${version}`); process.exit(0); }
const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
console.log(lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim());
