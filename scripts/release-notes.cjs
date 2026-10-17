// Prints the CHANGELOG section for one version (used as the GitHub release text and shown in the in-game update
// prompt). `--lang fr` reads CHANGELOG.fr.md instead (published as release-notes-fr.md, which the French game shows).
// Falls back to a short line when the version has no section.
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const li = args.indexOf('--lang');
const lang = li >= 0 ? args.splice(li, 2)[1] : 'en';
const version = (args[0] || '').replace(/^v/, '');
const file = path.join(__dirname, '..', lang === 'en' ? 'CHANGELOG.md' : `CHANGELOG.${lang}.md`);
const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const lines = text.split(/\r?\n/);
const start = lines.findIndex((l) => new RegExp(`^##\\s+v?${version.replace(/\./g, '\\.')}\\b`).test(l));
if (start < 0) { console.log(`Fight Camp ${version}`); process.exit(0); }
const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
console.log(lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim());
