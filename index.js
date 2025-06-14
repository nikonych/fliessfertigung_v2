const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
app.commandLine.appendSwitch("gtk-version", "3");
const dbService = require('./db/databaseService.js');

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
    // Важно: Инициализируем базу данных при запуске приложения
    dbService.initializeDatabase();

    ipcMain.handle('get-maschinen', async () => {
        try {
            return await dbService.getMaschinen();
        } catch (err) {
            console.error("DB error:", err);
            return [];
        }
    });

    ipcMain.handle('get-auftraege', async () => {
        try {
            return await dbService.getAuftraege();
        } catch (err) {
            console.error("DB error:", err);
            return [];
        }
    });

    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData');
    });

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
