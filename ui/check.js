const fs = require('fs');
const path = require('path');
const remote = require('@electron/remote');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

// Константы
const DB_PATH = path.join(__dirname, '..', 'manufacturing.db');

// Убедимся, что можем создать файл БД
function ensureDatabaseDirExists() {
  const projectRoot = path.join(__dirname, '..');
  // Проверяем права доступа к корневой директории проекта
  try {
    fs.accessSync(projectRoot, fs.constants.W_OK);
    console.log('Корневая директория проекта доступна для записи:', projectRoot);
  } catch (err) {
    console.error('Нет прав на запись в корневую директорию:', projectRoot, err);
    throw new Error('Невозможно создать БД в корневой директории проекта');
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
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
    `).all(...requiredTables);

    // Если не все таблицы существуют
    if (tableCheck.length !== requiredTables.length) return true;

    // Проверяем наличие данных хотя бы в одной таблице
    const hasData = requiredTables.some(table => {
      try {
        return db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count > 0;
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

// Функция для форматирования чисел (добавление ведущих нулей)
function formatNumber(num, digits = 3) {
  if (num === null || num === undefined || isNaN(num)) return '0'.repeat(digits);
  return String(Math.floor(Number(num))).padStart(digits, '0');
}

// Функция для проверки и очистки данных
function isValidRow(row, requiredFields) {
  return requiredFields.every(field =>
      row[field] !== null &&
      row[field] !== undefined &&
      row[field] !== '' &&
      !isNaN(row[field]) // для числовых полей
  );
}

// Функции для вставки данных
function insertMaschinen(db, rows) {
  if (!rows || rows.length === 0) {
    console.log('Нет данных для импорта Maschine');
    return;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Maschine (Nr, Bezeichnung, verf_von, verf_bis, Kap_Tag)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    let insertedCount = 0;
    for (const row of rows) {
      try {
        // Проверяем обязательные поля
        if (!row.Nr || !row.Bezeichnung) {
          console.log('Пропускаем строку Maschine с пустыми обязательными полями:', row);
          continue;
        }

        stmt.run(
            formatNumber(row.Nr, 3),
            String(row.Bezeichnung || ''),
            parseInt(row.verf_von) || 0,
            parseInt(row.verf_bis) || 0,
            parseInt(row.Kap_Tag) || 0
        );
        insertedCount++;
      } catch (err) {
        console.error('Ошибка вставки Maschine:', row, err);
      }
    }
    console.log(`Вставлено записей Maschine: ${insertedCount}`);
  });

  insertMany(rows);
}

function insertAuftraege(db, rows) {
  if (!rows || rows.length === 0) {
    console.log('Нет данных для импорта Auftrag');
    return;
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Auftrag (auftrag_nr, Anzahl, Start)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    let insertedCount = 0;
    for (const row of rows) {
      try {
        // Проверяем обязательные поля
        if (!row.auftrag_nr || !row.Anzahl || !row.Start) {
          console.log('Пропускаем строку Auftrag с пустыми обязательными полями:', row);
          continue;
        }

        stmt.run(
            String(row.auftrag_nr),
            parseInt(row.Anzahl) || 0,
            parseInt(row.Start) || 0
        );
        insertedCount++;
      } catch (err) {
        console.error('Ошибка вставки Auftrag:', row, err);
      }
    }
    console.log(`Вставлено записей Auftrag: ${insertedCount}`);
  });

  insertMany(rows);
}

function insertArbeitsplaene(db, rows) {
  if (!rows || rows.length === 0) {
    console.log('Нет данных для импорта Arbeitsplan');
    return;
  }

  // Проверочные запросы для внешних ключей
  const checkAuftrag = db.prepare('SELECT 1 FROM Auftrag WHERE auftrag_nr = ?');
  const checkMaschine = db.prepare('SELECT 1 FROM Maschine WHERE Nr = ?');

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO Arbeitsplan (auftrag_nr, ag_nr, maschine, dauer)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    let insertedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      try {
        // Проверяем обязательные поля
        if (!row.auftrag_nr || !row.ag_nr || !row.maschine || !row.dauer) {
          console.log('Пропускаем строку Arbeitsplan с пустыми обязательными полями:', row);
          skippedCount++;
          continue;
        }

        const auftragNr = String(row.auftrag_nr);
        const maschineNr = formatNumber(row.maschine, 3);

        // Проверка существования Auftrag
        if (!checkAuftrag.get(auftragNr)) {
          console.error(`Auftrag ${auftragNr} не существует, пропускаем`);
          skippedCount++;
          continue;
        }

        // Проверка существования Maschine
        if (!checkMaschine.get(maschineNr)) {
          console.error(`Maschine ${maschineNr} не существует, пропускаем`);
          skippedCount++;
          continue;
        }

        stmt.run(
            auftragNr,
            formatNumber(row.ag_nr, 2),
            maschineNr,
            parseInt(row.dauer) || 0
        );
        insertedCount++;
      } catch (err) {
        console.error('Ошибка вставки Arbeitsplan:', row, err);
        skippedCount++;
      }
    }
    console.log(`Вставлено записей Arbeitsplan: ${insertedCount}, пропущено: ${skippedCount}`);
  });

  insertMany(rows);
}

// Основная функция импорта
async function importExcelToDatabase(excelPath) {
  let db;
  try {
    ensureDatabaseDirExists();
    db = new Database(DB_PATH);

    // Временно отключаем проверку внешних ключей
    db.pragma('foreign_keys = OFF');

    createTables(db);

    // Читаем Excel файл
    console.log('Чтение Excel файла:', excelPath);
    const workbook = XLSX.readFile(excelPath);
    console.log('Доступные листы:', workbook.SheetNames);

    // Собираем данные из всех листов
    const sheetsData = {};
    workbook.SheetNames.forEach(sheetName => {
      console.log(`Обработка листа: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,  // Значение по умолчанию для пустых ячеек
        raw: false     // Не преобразовывать типы автоматически
      });

      console.log(`Лист ${sheetName}: найдено ${jsonData.length} строк`);
      if (jsonData.length > 0) {
        console.log(`Первая строка листа ${sheetName}:`, jsonData[0]);
      }

      sheetsData[sheetName.toLowerCase()] = jsonData;
    });

    // Импортируем в правильном порядке (сначала родительские таблицы)

    // 1. Сначала Maschine
    const maschineData = sheetsData['maschine'];
    if (maschineData && maschineData.length > 0) {
      console.log('Импорт Maschine...');
      insertMaschinen(db, maschineData);
    } else {
      console.log('Данные Maschine не найдены или пусты');
    }

    // 2. Затем Auftrag
    const auftragData = sheetsData['auftrag'];
    if (auftragData && auftragData.length > 0) {
      console.log('Импорт Auftrag...');
      insertAuftraege(db, auftragData);
    } else {
      console.log('Данные Auftrag не найдены или пусты');
    }

    // 3. Наконец Arbeitsplan
    const arbeitsplanData = sheetsData['arbeitsplan'];
    if (arbeitsplanData && arbeitsplanData.length > 0) {
      console.log('Импорт Arbeitsplan...');
      insertArbeitsplaene(db, arbeitsplanData);
    } else {
      console.log('Данные Arbeitsplan не найдены или пусты');
    }

    // Включаем проверку внешних ключей обратно
    db.pragma('foreign_keys = ON');

    // Проверяем результат
    const maschineCount = db.prepare('SELECT COUNT(*) as count FROM Maschine').get().count;
    const auftragCount = db.prepare('SELECT COUNT(*) as count FROM Auftrag').get().count;
    const arbeitsplanCount = db.prepare('SELECT COUNT(*) as count FROM Arbeitsplan').get().count;

    console.log(`Результат импорта:`);
    console.log(`- Maschine: ${maschineCount} записей`);
    console.log(`- Auftrag: ${auftragCount} записей`);
    console.log(`- Arbeitsplan: ${arbeitsplanCount} записей`);

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
              { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });

          if (!result.canceled && result.filePaths.length > 0) {
            console.log('Начинаем импорт файла:', result.filePaths[0]);
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