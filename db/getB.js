//Arbeitsplan

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../manufacturing.db');

function getArbeitsplanList() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`DB not found at ${dbPath}`);
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    const stmt = db.prepare("SELECT auftrag_nr, ag_nr, maschine, dauer from Arbeitsplan");
    const arbeitsplans = stmt.all(); // сразу получаем весь список
    return arbeitsplans;
  } finally {
    db.close(); // обязательно закрываем
  }
}

module.exports = { getArbeitsplanList };
