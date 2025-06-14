import * as XLSX from 'xlsx';
import Database from 'better-sqlite3';
import { Maschine } from './Maschine.js';
import { Auftrag } from './Auftrag.js';
import { Arbeitsplan } from './Arbeitsplan.js';
import path from "path";
import {app} from "electron";

function excelDateToSerial(dateStr) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const jsDate = new Date(dateStr);
  return Math.floor((jsDate - excelEpoch) / (1000 * 60 * 60 * 24));
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

function insertMaschinen(db, rows) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Maschine (Nr, Bezeichnung, verf_von, verf_bis, Kap_Tag)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    const m = new Maschine(row.Nr, row.Bezeichnung, row.verf_von, row.verf_bis, row.Kap_Tag);
    stmt.run(m.nr, m.bezeichnung, m.verf_von, m.verf_bis, m.kap_tag);
  }
}

function insertAuftraege(db, rows) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Auftrag (auftrag_nr, Anzahl, Start)
    VALUES (?, ?, ?)
  `);
  for (const row of rows) {
    const a = new Auftrag(row.auftrag_nr, row.Anzahl, row.Start);
    stmt.run(a.auftrag_nr, a.anzahl, a.start);
  }
}

function insertArbeitsplaene(db, rows) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Arbeitsplan (auftrag_nr, ag_nr, maschine, dauer)
    VALUES (?, ?, ?, ?)
  `);
  for (const row of rows) {
    const ap = new Arbeitsplan(row.auftrag_nr, row.ag_nr, row.maschine, row.dauer);
    stmt.run(ap.auftrag_nr, ap.ag_nr, ap.maschine, ap.dauer);
  }
}

function importExcelToDatabase(excelPath, dbPath) {
  const db = new Database(dbPath);
  createTables(db);

  const workbook = XLSX.readFile(excelPath);
  const sheets = workbook.SheetNames;

  sheets.forEach(sheet => {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

    console.log(`Processing: ${sheet} (${data.length} rows)`);

    switch (sheet.toLowerCase()) {
      case 'maschine':
        insertMaschinen(db, data);
        break;
      case 'auftrag':
        insertAuftraege(db, data);
        break;
      case 'arbeitsplan':
        insertArbeitsplaene(db, data);
        break;
      default:
        console.log(`Skipping unknown sheet: ${sheet}`);
    }
  });

  console.log("✔ Import completed.");
  db.close();
}

const excelPath = './21_Simulation_Fliessfertigung (2).xlsx';
const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');

importExcelToDatabase(excelPath, dbPath);
