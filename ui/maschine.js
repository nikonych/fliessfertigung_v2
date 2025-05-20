const sqlite3 = require('sqlite3').verbose();
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, "../manufacturing.db");

function getMaschineList() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      return reject(new Error(`DB not found at ${dbPath}`));
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(new Error("Error opening DB: " + err.message));
      }

      db.all("SELECT Bezeichnung, verf_von, verf_bis, Kap_Tag FROM Maschine", (err, machines) => {
        db.close();

        if (err) {
          return reject(new Error("Failed to read Maschine: " + err.message));
        }

        resolve(machines); // This is an array of plain JS objects
      });
    });
  });
}

// Just for testing to run it!
getMaschineList()
  .then((machines) => {
    machines.forEach((m, i) =>
      console.log(`[${i + 1}]`, JSON.stringify(m, null, 2))
    );
  })
  .catch((err) => {
    console.error("DB error:", err.message);
  });
