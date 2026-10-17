// Builds release/FightCamp-Setup-<version>.exe from release/win-unpacked with NSIS (no Wine needed: the
// uninstaller is written at install time). Per-user install, no admin rights; saves in Documents\FightCamp are
// never touched by the installer or the uninstaller.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const pkg = require('./package.json');
const version = pkg.version;
const unpacked = path.join(__dirname, 'release', 'win-unpacked');
if (!fs.existsSync(path.join(unpacked, 'FightCamp.exe'))) { console.error('Run electron-builder --win dir first'); process.exit(1); }
const nsisDir = process.env.NSISDIR || path.join(os.homedir(), '.cache', 'electron-builder', 'nsis', 'nsis-3.0.4.1');
function findMakensis() {
  if (process.env.MAKENSIS) return process.env.MAKENSIS;
  if (process.platform === 'win32') {
    const c = [path.join(nsisDir, 'Bin', 'makensis.exe'), 'C:\\Program Files (x86)\\NSIS\\makensis.exe', 'C:\\Program Files\\NSIS\\makensis.exe'];
    return c.find((f) => fs.existsSync(f)) || 'makensis';
  }
  return path.join(nsisDir, process.platform === 'darwin' ? 'mac' : 'linux', 'makensis');
}
const makensis = findMakensis();

const top = fs.readdirSync(unpacked);
const files = top.filter((f) => fs.statSync(path.join(unpacked, f)).isFile());
const dirs = top.filter((f) => fs.statSync(path.join(unpacked, f)).isDirectory());
const sizeKB = Math.round(dirSize(unpacked) / 1024);
function dirSize(d) { return fs.readdirSync(d).reduce((s, f) => { const p = path.join(d, f); const st = fs.statSync(p); return s + (st.isDirectory() ? dirSize(p) : st.size); }, 0); }
const win = (p) => p.split('/').join('\\');

const nsi = `Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!define APPNAME "Fight Camp"
!define EXENAME "FightCamp.exe"
!define VERSION "${version}"
!define UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\FightCamp"
Name "\${APPNAME}"
Caption "\${APPNAME} \${VERSION} Setup"
BrandingText "Fight Camp"
OutFile "${path.join(__dirname, 'release', `FightCamp-Setup-${version}.exe`)}"
InstallDir "$LOCALAPPDATA\\Programs\\Fight Camp"
InstallDirRegKey HKCU "Software\\FightCamp" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ManifestDPIAware true

VIProductVersion "${version}.0"
VIAddVersionKey "ProductName" "Fight Camp"
VIAddVersionKey "FileDescription" "Fight Camp Setup"
VIAddVersionKey "CompanyName" "Fight Camp"
VIAddVersionKey "LegalCopyright" "Fight Camp"
VIAddVersionKey "FileVersion" "${version}"
VIAddVersionKey "ProductVersion" "${version}"

!define MUI_ICON "${path.join(__dirname, 'build', 'icon.ico')}"
!define MUI_UNICON "${path.join(__dirname, 'build', 'icon.ico')}"
!define MUI_WELCOMEPAGE_TITLE "Welcome to Fight Camp"
!define MUI_WELCOMEPAGE_TEXT "This will install Fight Camp \${VERSION}, the MMA career simulator, for your Windows account (no administrator rights needed).$\\r$\\n$\\r$\\nYour careers are saved in Documents\\FightCamp\\saves. That folder is created the first time you save and is kept if you uninstall or update the game."
!define MUI_FINISHPAGE_RUN "$INSTDIR\\\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Fight Camp"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Fight Camp" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  ; the game must be closed to replace its files (an auto-update starts this right as the game exits: give it a moment)
  IfSilent 0 +2
    Sleep 2000
  nsExec::Exec 'taskkill /IM "\${EXENAME}" /F'
${files.map((f) => `  File "${path.join(unpacked, f)}"`).join('\n')}
${dirs.map((d) => `  File /r "${path.join(unpacked, d)}"`).join('\n')}
  WriteUninstaller "$INSTDIR\\Uninstall Fight Camp.exe"
  CreateShortcut "$SMPROGRAMS\\Fight Camp.lnk" "$INSTDIR\\\${EXENAME}" "" "$INSTDIR\\\${EXENAME}" 0
  CreateShortcut "$DESKTOP\\Fight Camp.lnk" "$INSTDIR\\\${EXENAME}" "" "$INSTDIR\\\${EXENAME}" 0
  WriteRegStr HKCU "Software\\FightCamp" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayName" "Fight Camp"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayVersion" "\${VERSION}"
  WriteRegStr HKCU "\${UNINST_KEY}" "Publisher" "Fight Camp"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayIcon" "$INSTDIR\\\${EXENAME}"
  WriteRegStr HKCU "\${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "\${UNINST_KEY}" "UninstallString" '"$INSTDIR\\Uninstall Fight Camp.exe"'
  WriteRegDWORD HKCU "\${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "\${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "\${UNINST_KEY}" "EstimatedSize" ${sizeKB}
SectionEnd

; /RELAUNCH (passed by the in-game updater) reopens the game after a silent update
Function .onInstSuccess
  \${GetParameters} $R0
  ClearErrors
  \${GetOptions} $R0 "/RELAUNCH" $R1
  IfErrors +2 0
    Exec '"$INSTDIR\\\${EXENAME}"'
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "\${EXENAME}" /F'
  Delete "$SMPROGRAMS\\Fight Camp.lnk"
  Delete "$DESKTOP\\Fight Camp.lnk"
  ; only the game's own files; saves in Documents\\FightCamp are kept
${files.map((f) => `  Delete "$INSTDIR\\${win(f)}"`).join('\n')}
${dirs.map((d) => `  RMDir /r "$INSTDIR\\${win(d)}"`).join('\n')}
  Delete "$INSTDIR\\Uninstall Fight Camp.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "\${UNINST_KEY}"
  DeleteRegKey HKCU "Software\\FightCamp"
SectionEnd
`;
const nsiPath = path.join(__dirname, 'release', 'installer.nsi');
fs.writeFileSync(nsiPath, nsi);
execFileSync(makensis, ['-V2', nsiPath], { stdio: 'inherit', env: process.platform === 'win32' ? process.env : { ...process.env, NSISDIR: nsisDir } });
console.log('installer:', `release/FightCamp-Setup-${version}.exe`);
