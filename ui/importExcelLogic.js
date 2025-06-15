const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

function formatNumber(num, digits = 3) {
    return String(Math.floor(Number(num))).padStart(digits, '0');
}

function isValidRow(row, fields) {
    return fields.every(f => row[f] !== null && row[f] !== undefined && row[f] !== '');
}

function insertMaschinen(db, maschinen) {
    const stmt = db.prepare(`INSERT OR REPLACE INTO Maschine (Nr, Bezeichnung, verf_von, verf_bis, Kap_Tag)
                             VALUES (?, ?, ?, ?, ?)`);
    const insertMany = db.transaction(rows => {
        for (const row of rows) {
            if (!isValidRow(row, ['Nr', 'Bezeichnung'])) continue;
            stmt.run(
                formatNumber(row.Nr, 3),
                String(row.Bezeichnung),
                parseInt(row.verf_von) || 0,
                parseInt(row.verf_bis) || 0,
                parseInt(row.Kap_Tag) || 0
            );
        }
    });
    insertMany(maschinen);
}

function insertAuftraege(db, auftraege) {
    const stmt = db.prepare(`INSERT OR REPLACE INTO Auftrag (auftrag_nr, Anzahl, Start)
                             VALUES (?, ?, ?)`);
    const insertMany = db.transaction(rows => {
        for (const row of rows) {
            if (!isValidRow(row, ['auftrag_nr', 'Anzahl', 'Start'])) continue;
            stmt.run(
                String(row.auftrag_nr),
                parseInt(row.Anzahl) || 0,
                parseInt(row.Start) || 0
            );
        }
    });
    insertMany(auftraege);
}

function insertArbeitsplaene(db, arbeitsplaene) {
    const checkAuftrag = db.prepare('SELECT 1 FROM Auftrag WHERE auftrag_nr = ?');
    const checkMaschine = db.prepare('SELECT 1 FROM Maschine WHERE Nr = ?');
    const stmt = db.prepare(`INSERT OR REPLACE INTO Arbeitsplan (auftrag_nr, ag_nr, maschine, dauer)
                             VALUES (?, ?, ?, ?)`);
    const insertMany = db.transaction(rows => {
        for (const row of rows) {
            if (!isValidRow(row, ['auftrag_nr', 'ag_nr', 'maschine', 'dauer'])) continue;
            const aNr = String(row.auftrag_nr);
            const mNr = formatNumber(row.maschine, 3);
            if (!checkAuftrag.get(aNr) || !checkMaschine.get(mNr)) continue;

            stmt.run(
                aNr,
                formatNumber(row.ag_nr, 2),
                mNr,
                parseInt(row.dauer) || 0
            );
        }
    });
    insertMany(arbeitsplaene);
}

function createTables(db) {
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
        );
        CREATE TABLE IF NOT EXISTS Arbeitsplan (
            auftrag_nr TEXT,
            ag_nr TEXT,
            maschine TEXT,
            dauer INTEGER,
            PRIMARY KEY (auftrag_nr, ag_nr),
            FOREIGN KEY (auftrag_nr) REFERENCES Auftrag(auftrag_nr),
            FOREIGN KEY (maschine) REFERENCES Maschine(Nr)
        );
    `);
}

module.exports = function importExcelLogic(filePath) {
    const dbPath = path.join(require('electron').app.getPath('userData'), 'manufacturing.db');
    if (!fs.existsSync(filePath)) throw new Error('File existiert nicht: ' + filePath);

    const db = new Database(dbPath);
    db.pragma('foreign_keys = OFF');
    createTables(db);

    const workbook = XLSX.readFile(filePath);
    const maschinen = XLSX.utils.sheet_to_json(workbook.Sheets['Maschine'] || {});
    const auftraege = XLSX.utils.sheet_to_json(workbook.Sheets['Auftrag'] || {});
    const arbeitsplaene = XLSX.utils.sheet_to_json(workbook.Sheets['Arbeitsplan'] || {});

    insertMaschinen(db, maschinen);
    insertAuftraege(db, auftraege);
    insertArbeitsplaene(db, arbeitsplaene);

    db.pragma('foreign_keys = ON');
    db.close();
    return true;
};
