/* Taking a picture of the drop.

   Lives on its own so the shell and the smoke test register exactly the same
   handler — a capture that only works in one of them is not worth having. */
const { ipcMain, desktopCapturer, screen } = require('electron');

/* Grabs the screen the game is on and hands back a data URL the renderer can
   store on the delivery record. Returns null when the capture is refused —
   a locked session, a headless run, or a display that will not share. */
async function captureScreen() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  /* half size keeps the record small without losing the plate or the sign */
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width / 2), height: Math.round(height / 2) },
  });
  const shot = sources[0] && sources[0].thumbnail;
  if (!shot || shot.isEmpty()) return null;
  const jpeg = shot.toJPEG(72);
  return { dataUrl: 'data:image/jpeg;base64,' + jpeg.toString('base64'), bytes: jpeg.length };
}

function register() {
  ipcMain.handle('capture:screen', async () => {
    try { return await captureScreen(); } catch (err) { return null; }
  });
}

module.exports = { register, captureScreen };
