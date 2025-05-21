const { app, BrowserWindow} = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
app.commandLine.appendSwitch("gtk-version", "3");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // win.removeMenu();


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
