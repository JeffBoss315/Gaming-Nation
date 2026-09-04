const { app, BrowserWindow } = require('electron');
const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]);
const PAGE = process.argv[4] || 'index.html';
const W = Number(process.argv[5] || 1360), H = Number(process.argv[6] || 880);
app.setPath('userData', path.join(app.getPath('temp'), 'hll-brand-shot'));
app.disableHardwareAcceleration(); app.on('window-all-closed', () => {});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: W, height: H, show: true, backgroundColor: '#070910' });
  await win.loadURL('file:///' + path.join(ROOT, PAGE).split(path.sep).join('/'));
  await wait(2000);
  await win.webContents.executeJavaScript(`
    (function(){ var s=document.getElementById('splash'); if(s) s.classList.add('gone');
      try { var a=(typeof Accounts!=='undefined'?Accounts.all():[]).find(x=>/jeffboss/.test(x.email))||(typeof Accounts!=='undefined'?Accounts.all()[0]:null);
        if(a){ state.user=Store.driver(a.driverId); Store.writeSession({id:a.driverId}); } } catch(e){}
      try { var b=(typeof Auth!=='undefined'?Auth.accounts():[]); if(b.length) Auth.signIn(b[0], Auth.driverRecord(b[0].driverId), false); } catch(e){}
      try { render(); } catch(e){}
    })();`, true);
  await wait(1600);
  const img = await win.webContents.capturePage();
  const name = 'brand-' + PAGE.replace(/\..*$/,'') + '-' + W + '.png';
  fs.writeFileSync(path.join(OUT, name), img.toPNG());
  console.log('wrote ' + name);
  app.exit(0);
});
