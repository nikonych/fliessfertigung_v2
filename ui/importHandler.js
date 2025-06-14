// 📅 renderer/importHandler.js

// Основная функция импорта Excel
async function importExcelToDatabase(excelPath) {
    const result = await window.electronAPI.importExcel(excelPath);
    console.log("Импорт завершен:", result);
    return result;
}

// Создание новой БД и таблиц после удаления
async function createEmptyDatabase() {
    const dbPath = await window.electronAPI.getDbPath();
    const result = await window.electronAPI.createEmptyDatabase(dbPath);
    console.log(result);
}

// Инициализация
window.onload = async () => {
    const importBtn = document.getElementById('importBtn');

    try {
        console.log('Получение пути к БД...');
        const DB_PATH = await window.electronAPI.getDbPath();
        console.log('Путь к БД:', DB_PATH);

        console.log('Проверка состояния БД...');
        const isEmpty = await window.electronAPI.isDbEmpty();
        console.log('БД пуста:', isEmpty);

        // Всегда отображаем кнопку для возможности перезаписи
        importBtn.style.display = 'inline-block';

        importBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.selectExcelFile();

                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    console.log('Удаляем старую БД...');
                    await window.electronAPI.deleteDb();

                    console.log('Создаем новую БД...');
                    await createEmptyDatabase();

                    console.log('Начинаем импорт файла:', filePath);
                    await importExcelToDatabase(filePath);

                    alert('✅ Данные успешно импортированы!');
                    importBtn.style.display = 'none';
                    location.reload();
                }
            } catch (err) {
                console.error('Ошибка во время импорта:', err);
                alert(`❌ Ошибка импорта: ${err.message}`);
            }
        });

    } catch (err) {
        console.error('Ошибка инициализации:', err);
        alert('Произошла ошибка при инициализации приложения');
    }
};