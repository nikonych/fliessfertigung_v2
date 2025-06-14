const fs = require('fs');
const remote = require('@electron/remote');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const {ipcRenderer} = require("electron");
const path = require("path");

async function resolveDbPath() {
    const userDataPath = await ipcRenderer.invoke('get-user-data-path');
    const DB_PATH = path.join(userDataPath, 'manufacturing.db');
    console.log('DB path:', DB_PATH);
    return DB_PATH;
}

// Константы
const DATA_DIR = "data";
let DB_PATH;

// Убедимся, что директория для БД существует
function ensureDatabaseDirExists() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, {recursive: true});
    }
}

// Проверка существования БД
function isDatabaseMissing() {
    try {
        return !fs.existsSync(DB_PATH);
    } catch (err) {
        console.error('Ошибка проверки существования БД:', err);
        return true;
    }
}

// Проверка, содержит ли БД данные
function isDatabaseEmpty() {
    if (isDatabaseMissing()) return true;

    let db;
    try {
        db = new Database(DB_PATH);

        // Проверяем существование всех таблиц
        const requiredTables = ['Maschine', 'Auftrag', 'Arbeitsplan'];
        const tableCheck = db.prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name IN (${requiredTables.map(() => '?').join(',')})
        `).all(...requiredTables);

        // Если не все таблицы существуют
        if (tableCheck.length !== requiredTables.length) return true;

        // Проверяем наличие данных хотя бы в одной таблице
        const hasData = requiredTables.some(table => {
            try {
                return db.prepare(`SELECT COUNT(*) as count
                                   FROM ${table}`).get().count > 0;
            } catch (e) {
                return false;
            }
        });

        return !hasData;
    } catch (err) {
        console.error('Ошибка проверки содержимого БД:', err);
        return true;
    } finally {
        if (db) db.close();
    }
}

// Создание таблиц
function createTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS Maschine
        (
            Nr
            TEXT
            PRIMARY
            KEY,
            Bezeichnung
            TEXT,
            verf_von
            INTEGER,
            verf_bis
            INTEGER,
            Kap_Tag
            INTEGER
        );

        CREATE TABLE IF NOT EXISTS Auftrag
        (
            auftrag_nr
            TEXT
            PRIMARY
            KEY,
            Anzahl
            INTEGER,
            Start
            INTEGER
        );

        CREATE TABLE IF NOT EXISTS Arbeitsplan
        (
            auftrag_nr
            TEXT,
            ag_nr
            TEXT,
            maschine
            TEXT,
            dauer
            INTEGER,
            PRIMARY
            KEY
        (
            auftrag_nr,
            ag_nr
        ),
            FOREIGN KEY
        (
            auftrag_nr
        ) REFERENCES Auftrag
        (
            auftrag_nr
        ),
            FOREIGN KEY
        (
            maschine
        ) REFERENCES Maschine
        (
            Nr
        )
            );
    `);
}

// Функция для форматирования чисел (добавление ведущих нулей)
function formatNumber(num, digits = 3) {
    if (isNaN(num)) return '0'.repeat(digits);
    return String(num).padStart(digits, '0');
}

// Функции для вставки данных с проверкой внешних ключей
function insertMaschinen(db, rows) {
    const stmt = db.prepare(`
        INSERT
        OR REPLACE INTO Maschine (Nr, Bezeichnung, verf_von, verf_bis, Kap_Tag)
    VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            try {
                stmt.run(
                    formatNumber(row.Nr, 3),
                    row.Bezeichnung || '',
                    row.verf_von || 0,
                    row.verf_bis || 0,
                    row.Kap_Tag || 0
                );
            } catch (err) {
                console.error('Ошибка вставки Maschine:', row, err);
            }
        }
    });

    insertMany(rows);
}

function insertAuftraege(db, rows) {
    const stmt = db.prepare(`
        INSERT
        OR REPLACE INTO Auftrag (auftrag_nr, Anzahl, Start)
    VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            try {
                stmt.run(
                    String(row.auftrag_nr || ''),
                    row.Anzahl || 0,
                    row.Start || 0
                );
            } catch (err) {
                console.error('Ошибка вставки Auftrag:', row, err);
            }
        }
    });

    insertMany(rows);
}

function insertArbeitsplaene(db, rows) {
    // Проверочные запросы для внешних ключей
    const checkAuftrag = db.prepare('SELECT 1 FROM Auftrag WHERE auftrag_nr = ?');
    const checkMaschine = db.prepare('SELECT 1 FROM Maschine WHERE Nr = ?');

    const stmt = db.prepare(`
        INSERT
        OR REPLACE INTO Arbeitsplan (auftrag_nr, ag_nr, maschine, dauer)
    VALUES (?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            try {
                // Проверка существования Auftrag
                if (!checkAuftrag.get(row.auftrag_nr)) {
                    console.error(`Auftrag ${row.auftrag_nr} не существует, пропускаем`);
                    continue;
                }

                // Проверка существования Maschine
                if (!checkMaschine.get(formatNumber(row.maschine, 3))) {
                    console.error(`Maschine ${row.maschine} не существует, пропускаем`);
                    continue;
                }

                stmt.run(
                    String(row.auftrag_nr || ''),
                    formatNumber(row.ag_nr, 2),
                    formatNumber(row.maschine, 3),
                    row.dauer || 0
                );
            } catch (err) {
                console.error('Ошибка вставки Arbeitsplan:', row, err);
            }
        }
    });

    insertMany(rows);
}

// Основная функция импорта
async function importExcelToDatabase(excelPath) {
    let db;
    try {
        ensureDatabaseDirExists();
        db = new Database(DB_PATH);

        // Временно отключаем проверку внешних ключей для надежности
        db.pragma('foreign_keys = OFF');

        createTables(db);

        // Читаем Excel файл
        const workbook = XLSX.readFile(excelPath);

        // Сначала собираем все данные
        const sheetsData = {};
        workbook.SheetNames.forEach(sheetName => {
            sheetsData[sheetName.toLowerCase()] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });

        // Импортируем в строгом порядке
        if (sheetsData['maschine']) {
            console.log('Импорт Maschine...');
            insertMaschinen(db, sheetsData['maschine']);
        }

        if (sheetsData['auftrag']) {
            console.log('Импорт Auftrag...');
            insertAuftraege(db, sheetsData['auftrag']);
        }

        if (sheetsData['arbeitsplan']) {
            console.log('Импорт Arbeitsplan...');
            insertArbeitsplaene(db, sheetsData['arbeitsplan']);
        }

        // Включаем проверку обратно
        db.pragma('foreign_keys = ON');

        console.log('Импорт завершен успешно');
        return true;
    } catch (err) {
        console.error('Ошибка импорта:', err);
        throw err;
    } finally {
        if (db) db.close();
    }
}

// Обработчик загрузки окна
window.onload = async () => {
    DB_PATH = path.join(await ipcRenderer.invoke('get-user-data-path'), 'manufacturing.db');

    const importBtn = document.getElementById('importBtn');

    try {
        console.log('Проверка состояния БД...');
        const missing = isDatabaseMissing();
        const empty = isDatabaseEmpty();

        console.log(`DB exists: ${!missing}, contains data: ${!empty}`);

        if (missing || empty) {
            console.log('Требуется импорт данных');
            importBtn.style.display = 'inline-block';

            importBtn.addEventListener('click', async () => {
                try {
                    const result = await remote.dialog.showOpenDialog({
                        title: 'Выберите файл Excel для импорта',
                        properties: ['openFile'],
                        filters: [
                            {name: 'Excel Files', extensions: ['xlsx', 'xls']},
                            {name: 'All Files', extensions: ['*']}
                        ]
                    });

                    if (!result.canceled && result.filePaths.length > 0) {
                        await importExcelToDatabase(result.filePaths[0]);
                        alert('✅ Данные успешно импортированы!');
                        importBtn.style.display = 'none';
                        location.reload();
                    }
                } catch (err) {
                    alert(`❌ Ошибка импорта: ${err.message}`);
                    console.error(err);
                }
            });
        } else {
            console.log('БД существует и содержит данные');
            importBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('Ошибка инициализации:', err);
        alert('Произошла ошибка при инициализации приложения');
    }
};