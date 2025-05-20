const sqlite3 = require('sqlite3').verbose();

// Path to your database
const db = new sqlite3.Database('./manufacturing.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("Error opening DB:", err.message);
  } else {
    console.log("Connected to DB.");
  }
});

// Get all table names
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error("Failed to fetch table list:", err.message);
    return;
  }

  tables.forEach((table) => {
    const tableName = table.name;
    console.log(`\n--- ${tableName} ---`);

    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
      if (err) {
        console.error(`Error reading ${tableName}:`, err.message);
        return;
      }

      if (rows.length === 0) {
        console.log("(empty)");
        return;
      }

      rows.forEach((row, index) => {
        console.log(`[Row ${index + 1}]`, JSON.stringify(row, null, 2));
      });
    });
  });
});
