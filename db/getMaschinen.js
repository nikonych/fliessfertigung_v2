const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../manufacturing.db');

function getMaschineList() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`DB not found at ${dbPath}`);
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = db.prepare("SELECT Bezeichnung, verf_von, verf_bis, Kap_Tag FROM Maschine");
    const machines = stmt.all(); // сразу получаем весь список
    return machines;
  } finally {
    db.close(); // обязательно закрываем
  }
}

module.exports = { getMaschineList };
