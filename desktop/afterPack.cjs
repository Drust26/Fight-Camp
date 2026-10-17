// Sets the Windows exe's icon and version info without Wine (electron-builder's own editing is turned off).
const fs = require('fs');
const path = require('path');
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const exePath = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const candidates = [exePath, path.join(ctx.appOutDir, 'FightCamp.exe')];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error('afterPack: exe not found in ' + ctx.appOutDir);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const v = ctx.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
  vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Fight Camp', FileDescription: 'Fight Camp', CompanyName: 'Fight Camp', LegalCopyright: 'Fight Camp',
    OriginalFilename: path.basename(file), InternalName: 'FightCamp', ProductVersion: ctx.packager.appInfo.version, FileVersion: ctx.packager.appInfo.version,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(file, Buffer.from(exe.generate()));
  console.log('afterPack: icon and version info set on', path.basename(file));
};
