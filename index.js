const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
app.commandLine.appendSwitch("gtk-version", "3");

const remoteMain = require('@electron/remote/main');
const {
    initializeDatabase,
    reinitializeDatabase,
    getAuftraege,
    getMaschinen,
    deleteMaschinen,
    getArbeitsplaene,
    getArbeitsplaeneForAuftrag,
    addAuftrag,
    updateAuftrag,
    deleteAuftrag,
    addMaschine,
    updateMaschine,
    addArbeitsplan,
    getSimulationStats
} = require('./db/databaseService.js');
const fs = require("node:fs");
const {updateArbeitsplan, deleteArbeitsplan, getLastAuftragNr} = require("./db/databaseService");
remoteMain.initialize();

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    // win.removeMenu();

    require('@electron/remote/main').enable(win.webContents);
    win.loadFile(path.join(__dirname, 'pages', 'home.html'));
}


app.whenReady().then(() => {
    // Важно: Инициализируем базу данных при запуске приложения
    initializeDatabase();

    registerIpcHandlers();


    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

function registerIpcHandlers() {
    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData');
    });

    ipcMain.handle('get-db-path', () => {
        const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');
        return dbPath;
    });


    ipcMain.handle('select-excel-file', async () => {
        const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
            title: 'Выберите файл Excel для импорта',
            properties: ['openFile'],
            filters: [
                {name: 'Excel Files', extensions: ['xlsx', 'xls']},
                {name: 'All Files', extensions: ['*']}
            ]
        });
        return result;
    });

    ipcMain.handle('close-db', async () => {
        const {closeDatabase} = require('./db/databaseService.js');
        await closeDatabase();
        return true;
    });


    ipcMain.handle('is-db-empty', async () => {
        const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');
        if (!fs.existsSync(dbPath)) return true;

        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        try {
            const tableExists = db.prepare(`SELECT name
                                            FROM sqlite_master
                                            WHERE type = 'table'
                                              AND name IN ('Maschine', 'Auftrag', 'Arbeitsplan')`).all();
            if (tableExists.length < 3) return true;

            const maschinen = db.prepare('SELECT COUNT(*) AS count FROM Maschine').get().count;
            const auftraege = db.prepare('SELECT COUNT(*) AS count FROM Auftrag').get().count;
            const arbeitsplaene = db.prepare('SELECT COUNT(*) AS count FROM Arbeitsplan').get().count;

            return (maschinen + auftraege + arbeitsplaene === 0);
        } catch {
            return true;
        } finally {
            db.close();
        }
    });


    ipcMain.handle('create-empty-database', async (event, dbPath) => {

        try {
            const Database = require('better-sqlite3');
            const db = new Database(dbPath);
            db.exec(`
        CREATE TABLE IF NOT EXISTS Maschine (
                Nr TEXT PRIMARY KEY,
                Bezeichnung TEXT,
                verf_von INTEGER,
                verf_bis INTEGER,
                Kap_Tag INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS Auftrag (
                auftrag_nr TEXT PRIMARY KEY,
                Anzahl INTEGER,
                Start INTEGER
                -- можно добавить später FOREIGN KEY auf maschine, если нужно
            );
            
            CREATE TABLE IF NOT EXISTS Arbeitsplan (
                auftrag_nr TEXT,
                ag_nr TEXT,
                maschine TEXT,
                dauer INTEGER,
                PRIMARY KEY (auftrag_nr, ag_nr),
                FOREIGN KEY (auftrag_nr) REFERENCES Auftrag(auftrag_nr) ON DELETE CASCADE,
                FOREIGN KEY (maschine) REFERENCES Maschine(Nr) ON DELETE SET NULL
            );

        `);
            db.close();

            await reinitializeDatabase();

            return '✅ База данных создана успешно';
        } catch (error) {
            console.error('Ошибка создания базы данных:', error);
            throw error;
        }
    });

    ipcMain.handle('import-excel', async (event, filePath) => {
        try {
            const importExcel = require(path.join(__dirname, 'ui', 'importExcelLogic.js'));
            const result = await importExcel(filePath);

            // После импорта переинициализируем базу данных
            await reinitializeDatabase();

            return result;
        } catch (e) {
            console.error('Ошибка импорта Excel:', e);
            throw e;
        }
    });

    ipcMain.handle('reinitialize-database', async () => {
        try {
            await reinitializeDatabase();
            return '✅ База данных переинициализирована успешно';
        } catch (error) {
            console.error('Ошибка переинициализации базы данных:', error);
            throw error;
        }
    });

    ipcMain.handle('delete-db', async () => {
        try {
            // Сначала закрываем соединение с базой данных
            const {closeDatabase} = require('./db/databaseService.js');
            await closeDatabase();

            const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                console.log('База данных удалена:', dbPath);
            } else {
                console.log('Файл БД не найден, нечего удалять');
            }

            return true;
        } catch (err) {
            console.error('Ошибка при удалении БД:', err);
            throw err;
        }
    });

    // Получение данных
    ipcMain.handle('get-auftraege', async () => {
        try {
            return await getAuftraege();
        } catch (error) {
            console.error('IPC Error - get-auftraege:', error);
            return [];
        }
    });

    ipcMain.handle('get-maschinen', async () => {
        try {
            return await getMaschinen();
        } catch (error) {
            console.error('IPC Error - get-maschinen:', error);
            return [];
        }
    });

    ipcMain.handle('get-arbeitsplaene', async () => {
        try {
            return await getArbeitsplaene();
        } catch (error) {
            console.error('IPC Error - get-arbeitsplaene:', error);
            return [];
        }
    });

    ipcMain.handle('get-arbeitsplaene-for-auftrag', async (event, auftrag_nr) => {
        try {
            return await getArbeitsplaeneForAuftrag(auftrag_nr);
        } catch (error) {
            console.error(`IPC Error - get-arbeitsplaene-for-auftrag ${auftrag_nr}:`, error);
            return [];
        }
    });

    // Добавление данных
    ipcMain.handle('add-auftrag', async (event, auftrag) => {
        try {
            return await addAuftrag(auftrag);
        } catch (error) {
            console.error('IPC Error - add-auftrag:', error);
            throw error;
        }
    });

    ipcMain.handle('generate-auftrag-nr', async () => {
        return await getLastAuftragNr();
    });

    ipcMain.handle('add-maschine', async (event, maschine) => {
        try {
            return await addMaschine(maschine);
        } catch (error) {
            console.error('IPC Error - add-maschine:', error);
            throw error;
        }
    });

    ipcMain.handle('add-arbeitsplan', async (event, arbeitsplan) => {
        try {
            return await addArbeitsplan(arbeitsplan);
        } catch (error) {
            console.error('IPC Error - add-arbeitsplan:', error);
            throw error;
        }
    });

    // Обновление данных
    ipcMain.handle('update-auftrag', async (event, auftrag_nr, updates) => {
        try {
            return await updateAuftrag(auftrag_nr, updates);
        } catch (error) {
            console.error('IPC Error - update-auftrag:', error);
            throw error;
        }
    });

    ipcMain.handle('update-maschine', async (event, nr, updates) => {
        try {
            return await updateMaschine(nr, updates);
        } catch (error) {
            console.error('IPC Error - update-maschine:', error);
            throw error;
        }
    });
    // Удаление данных
    ipcMain.handle('delete-auftrag', async (event, auftrag_nr) => {
        try {
            return await deleteAuftrag(auftrag_nr);
        } catch (error) {
            console.error('IPC Error - delete-auftrag:', error);
            throw error;
        }
    });


    ipcMain.handle("update-arbeitsplan", async (event, auftrag_nr, ag_nr, updates) => {
        try {
            return await updateArbeitsplan(auftrag_nr, ag_nr, updates);
        } catch (error) {
            console.error('IPC Error - update-Arbeitsplan:', error);
            throw error;
        }
    });

    ipcMain.handle("delete-arbeitsplan", async (event, auftrag_nr, ag_nr) => {
        try {
            return await deleteArbeitsplan(auftrag_nr, ag_nr);
        } catch (error) {
            console.error('IPC Error - delete-Arbeitsplan:', error);
            throw error;
        }
    });


    ipcMain.handle("delete-maschine", async (event, nr) => {
        try {
            return await deleteMaschinen(nr);
        } catch (err) {
            console.error("Error deleting Maschine:", err);
            throw err;
        }
    });


    // Статистика
    ipcMain.handle('get-simulation-stats', async () => {
        try {
            return await getSimulationStats();
        } catch (error) {
            console.error('IPC Error - get-simulation-stats:', error);
            return {auftraege: 0, maschinen: 0, arbeitsplaene: 0};
        }
    });

    console.log('✅ IPC handlers registered successfully');
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
