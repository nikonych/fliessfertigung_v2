// 📅 renderer/importHandler.js

// Hauptfunktion zum Importieren von Excel
async function importExcelToDatabase(excelPath) {
    const result = await window.electronAPI.importExcel(excelPath);
    console.log("Import abgeschlossen:", result);
    return result;
}

// Leere Datenbank und Tabellen nach dem Löschen neu erstellen
async function createEmptyDatabase() {
    const dbPath = await window.electronAPI.getDbPath();
    const result = await window.electronAPI.createEmptyDatabase(dbPath);
    console.log(result);
}

// Initialisierung
window.onload = async () => {
    const importBtn = document.getElementById('importBtn');

    try {
        console.log('Abrufen des Datenbankpfads...');
        const DB_PATH = await window.electronAPI.getDbPath();
        console.log('Datenbankpfad:', DB_PATH);

        console.log('Überprüfung des Datenbankzustands...');
        const isEmpty = await window.electronAPI.isDbEmpty();
        console.log('Datenbank ist leer:', isEmpty);

        // Schaltfläche immer anzeigen, um Überschreiben zu ermöglichen
        importBtn.style.display = 'inline-block';

        importBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectExcelFile();

                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];

                    console.log('Schließe Datenbank vor dem Löschen...');
                    await window.electronAPI.closeDb();

                    console.log('Lösche alte Datenbank...');
                    await window.electronAPI.deleteDb();

                    console.log('Erstelle neue Datenbank...');
                    await createEmptyDatabase();

                    console.log('Starte Import der Datei:', filePath);
                    await importExcelToDatabase(filePath);

                    alert('✅ Daten wurden erfolgreich importiert!');
                    importBtn.style.display = 'none';
                    location.reload();
                }
            } catch (err) {
                console.error('Fehler beim Importieren:', err);
                alert(`❌ Fehler beim Import: ${err.message}`);
            }
        });

    } catch (err) {
        console.error('Fehler bei der Initialisierung:', err);
        alert('Beim Initialisieren der Anwendung ist ein Fehler aufgetreten');
    }
};
