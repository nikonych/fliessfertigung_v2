// dbAdapter.js - Adapter for CommonJS database modules
// Этот файл работает как мост между ES6 модулями и CommonJS

// Поскольку мы не можем использовать require() в ES6 модулях напрямую,
// создадим функции-обертки, которые будут работать через динамический импорт

const {ipcRenderer} = require('electron');

export async function getMachineList() {
    try {
        let maschinen;
        try {
            maschinen = await ipcRenderer.invoke('get-maschinen');
            console.log(maschinen);
        } catch (e) {
            return;
        }
        return await maschinen;
    } catch (error) {
        console.error('Error loading machines:', error);
        // Возвращаем тестовые данные
        return [
            {Bezeichnung: "Maschine 1", verf_von: 45000, verf_bis: 45365, Kap_Tag: 8},
            {Bezeichnung: "Maschine 2", verf_von: 45000, verf_bis: 45365, Kap_Tag: 10},
            {Bezeichnung: "Maschine 3", verf_von: 45000, verf_bis: 45365, Kap_Tag: 6}
        ];
    }
}

export async function getOrderList() {
    try {
        let auftraege;
        try {
            auftraege = await ipcRenderer.invoke('get-auftraege');
            console.log(auftraege);
        } catch (e) {
            console.log(e)
            return;
        }
        return await auftraege;
    } catch (error) {
        console.error('Error loading orders:', error);
        // Возвращаем тестовые данные
        return [
            {auftrag_nr: "Auftrag 001", Anzahl: 100, Start: 45100},
            {auftrag_nr: "Auftrag 002", Anzahl: 50, Start: 45110},
            {auftrag_nr: "Auftrag 003", Anzahl: 200, Start: 45120},
            {auftrag_nr: "Auftrag 004", Anzahl: 75, Start: 45130}
        ];
    }
}