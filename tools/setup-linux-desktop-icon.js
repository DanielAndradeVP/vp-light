const fs = require('fs');
const path = require('path');
const os = require('os');

if (process.platform !== 'linux') {
  console.log('[VP Light] setup-linux-desktop-icon ignorado: não é Linux.');
  process.exit(0);
}

const projectRoot = process.cwd();
const applicationsDir = path.join(os.homedir(), '.local', 'share', 'applications');
const desktopFilePath = path.join(applicationsDir, 'vp-light.desktop');
const iconPath = path.join(projectRoot, 'assets', 'icons', 'icon.png');

fs.mkdirSync(applicationsDir, { recursive: true });

const desktopContent = `[Desktop Entry]
Name=VP Light
Comment=VP Light - Lighting Control Software
Exec=sh -c "cd ${projectRoot} && npm run dev"
Icon=${iconPath}
Terminal=true
Type=Application
Categories=Development;Utility;
StartupNotify=true
StartupWMClass=vp-light
`;

fs.writeFileSync(desktopFilePath, desktopContent, 'utf8');
fs.chmodSync(desktopFilePath, 0o755);

console.log('[VP Light] arquivo .desktop criado/atualizado:');
console.log(desktopFilePath);
console.log('[VP Light] ícone usado:');
console.log(iconPath);
