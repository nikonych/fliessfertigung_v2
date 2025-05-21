const { app, BrowserWindow} = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
app.commandLine.appendSwitch("gtk-version", "3");

const remoteMain = require('@electron/remote/main');
remoteMain.initialize();
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  // win.removeMenu();

  require('@electron/remote/main').enable(win.webContents);
  win.loadFile(path.join(__dirname, 'pages', 'home.html'));
}



app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
