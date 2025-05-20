const fs = require('fs');
const path = require('path');
const { remote } = require('electron');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const dbPath = path.join(__dirname, '..', 'data', 'manufacturing.db');
const TABLE_NAME = 'maschine';

function isDatabaseMissing() {
  return !fs.existsSync(dbPath);
}

function isDatabaseEmpty() {
  try {
    const db = new Database(dbPath);
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${TABLE_NAME}`).get();
    db.close();
    return row.count === 0;
  } catch (err) {
    console.error(`Fehler bei der Datenbanküberprüfung: ${err.message}`);
    return true;
  }
}

function importExcelToDatabase(excelPath, dbPath) {
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  const db = new Database(dbPath);
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      typ TEXT,
      status TEXT
    )
  `).run();

  const insert = db.prepare(`INSERT INTO ${TABLE_NAME} (name, typ, status) VALUES (?, ?, ?)`);
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.name, row.typ, row.status);
    }
  });

  insertMany(data);
  db.close();
}

window.onload = async () => {
  const importBtn = document.getElementById('importBtn');

  if (isDatabaseMissing() || isDatabaseEmpty()) {
    importBtn.style.display = 'inline-block';

    importBtn.addEventListener('click', async () => {
      const result = await remote.dialog.showOpenDialog({
        title: 'Excel-Datei auswählen',
        filters: [{ name: 'Excel-Dateien', extensions: ['xlsx'] }],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const excelPath = result.filePaths[0];

        try {
          importExcelToDatabase(excelPath, dbPath);
          alert('✅ Import war erfolgreich!');
          importBtn.style.display = 'none';
        } catch (err) {
          alert('❌ Fehler beim Importieren: ' + err.message);
        }
      }
    });
  } else {
    importBtn.style.display = 'none';
  }
};
