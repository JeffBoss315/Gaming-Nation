/* Bridges the desktop-only capabilities to the renderer.
   tracker.js feature-detects window.gmnDesktop and falls back to a
   browser-friendly explanation when a call is not available. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmnDesktop', {
  isDesktop: true,

  /* window chrome */
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),

  /* file pickers and game launching */
  pickFile:   (opts) => ipcRenderer.invoke('fs:pickFile', opts),
  autoDetect: (kind) => ipcRenderer.invoke('game:autoDetect', kind),
  launch:     (exe)  => ipcRenderer.invoke('game:launch', exe),
  exists:     (p)    => ipcRenderer.invoke('fs:exists', p),
  /* which of the games are running right now */
  gameRunning: ()    => ipcRenderer.invoke('game:running'),

  /* a real photo of the drop, taken from the screen the game is on */
  captureScreen: () => ipcRenderer.invoke('capture:screen'),

  /* hosting the company service on this machine, so messages and calls
     do not need somebody to open a terminal */
  startService:  (opts) => ipcRenderer.invoke('service:start', opts),
  stopService:   ()     => ipcRenderer.invoke('service:stop'),
  serviceStatus: ()     => ipcRenderer.invoke('service:status'),

  /* startup + tray behaviour */
  setAutoLaunch:  (on, minimized) => ipcRenderer.invoke('app:autoLaunch', on, minimized),
  getAutoLaunch:  ()   => ipcRenderer.invoke('app:autoLaunchState'),
  setTrayEnabled: (on) => ipcRenderer.invoke('app:tray', on),
});
