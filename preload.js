// preload.js
const {contextBridge, ipcRenderer} = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
    // Получение данных
    getAuftraege: () => ipcRenderer.invoke('get-auftraege'),
    getMaschinen: () => ipcRenderer.invoke('get-maschinen'),
    getArbeitsplaene: () => ipcRenderer.invoke('get-arbeitsplaene'),
    getArbeitsplaeneForAuftrag: (auftrag_nr) =>
        ipcRenderer.invoke('get-arbeitsplaene-for-auftrag', auftrag_nr),

    // Добавление данных
    addAuftrag: (auftrag) => ipcRenderer.invoke('add-auftrag', auftrag),
    addMaschine: (maschine) => ipcRenderer.invoke('add-maschine', maschine),
    addArbeitsplan: (arbeitsplan) => ipcRenderer.invoke('add-arbeitsplan', arbeitsplan),

    // Обновление данных
    updateAuftrag: (auftrag_nr, updates) =>
        ipcRenderer.invoke('update-auftrag', auftrag_nr, updates),
    updateMaschine: (nr, updates) =>
        ipcRenderer.invoke('update-maschine', nr, updates),

    // Удаление данных
    deleteAuftrag: (auftrag_nr) => ipcRenderer.invoke('delete-auftrag', auftrag_nr),

    // Статистика
    getSimulationStats: () => ipcRenderer.invoke('get-simulation-stats'),

    // Добавим вспомогательные функции
    joinPath: (...args) => path.join(...args),
    fileExists: (filePath) => fs.existsSync(filePath),
    createDir: (dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {recursive: true});
        }
    },

    // Получить путь к userData
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    getDbPath: () => ipcRenderer.invoke('get-db-path'),
    isDbEmpty: () => ipcRenderer.invoke('is-db-empty'),
    selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
    deleteDb: () => ipcRenderer.invoke('delete-db'),            // ❌ Удаление старой БД
    importExcel: (filePath) => ipcRenderer.invoke('import-excel', filePath), // Импорт из Excel
    createEmptyDatabase: (dbPath) => ipcRenderer.invoke('create-empty-database', dbPath),
    // Проверка доступности Electron API
    isElectron: true
});