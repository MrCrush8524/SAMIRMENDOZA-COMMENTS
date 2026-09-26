// Tells the AMB web app it is running as the desktop app (shown in About / Settings).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ambDesktop', {
  platform: process.platform,
  electron: process.versions.electron,
});
