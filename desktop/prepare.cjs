// Copies the single-file game build and the icons into the desktop package.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'dist-single', 'index.html');
if (!fs.existsSync(src)) { console.error('Build the game first: SINGLE=1 npx vite build --outDir dist-single'); process.exit(1); }
fs.mkdirSync(path.join(__dirname, 'app'), { recursive: true });
fs.copyFileSync(src, path.join(__dirname, 'app', 'index.html'));
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
fs.copyFileSync(path.join(root, 'branding', 'icon.ico'), path.join(__dirname, 'build', 'icon.ico'));
fs.copyFileSync(path.join(root, 'branding', 'png', 'icon-512.png'), path.join(__dirname, 'build', 'icon.png'));
console.log('desktop app prepared');
