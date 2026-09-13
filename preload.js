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
  /* the game's own icon, read out of its executable on this machine */
  gameIcon:   (exe)  => ipcRenderer.invoke('game:icon', exe),
  /* the game profiles on this machine, newest-saved first */
  gameProfiles: (kind) => ipcRenderer.invoke('game:profiles', kind),
  /* the map mods installed for a game - ProMods and the rest */
  gameMods: (kind) => ipcRenderer.invoke('game:mods', kind),
  exists:     (p)    => ipcRenderer.invoke('fs:exists', p),
  /* the build the website is offering, so this copy can say it is behind */
  latestVersion: (feed) => ipcRenderer.invoke('app:latest', feed),
  /* the crew's Discord webhook. Never read back as a value - only
     whether one is set, and which host it points at. */
  discordGet: () => ipcRenderer.invoke('service:discordGet'),
  discordSet: (hook) => ipcRenderer.invoke('service:discordSet', hook),
  /* which of the games are running right now */
  gameRunning: ()    => ipcRenderer.invoke('game:running'),

  /* how the telemetry adapter — the process that reads the game — is
     getting on, so the client can say something better than "no signal" */
  adapterStatus: () => ipcRenderer.invoke('telemetry:adapter'),

  /* put the telemetry plugin into the game's own plugins folder, which is
     the only thing that makes the game report anything at all */
  installPlugin: () => ipcRenderer.invoke('telemetry:installPlugin'),

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
