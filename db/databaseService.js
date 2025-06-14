// src/main/databaseService.js
const knex = require('knex');
const path = require('path');
const { app } = require('electron'); // Для получения пути к данным приложения

// Путь к вашей базе данных в папке userData
const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');

let db; // Переменная для хранения экземпляра Knex

function initializeDatabase() {
    if (!db) {
        db = knex({
            client: 'better-sqlite3',
            connection: {
                filename: dbPath
            },
            useNullAsDefault: true // Рекомендуется для SQLite
        });

        console.log(`Database service initialized at: ${dbPath}`);

        // Выполнение миграций или создание таблиц
        // Это можно сделать один раз при запуске приложения
        // db.schema.hasTable('Auftrag').then(exists => {
        //     if (!exists) {
        //         return db.schema.createTable('Auftrag', table => {
        //             table.text('auftrag_nr').primary();
        //             table.integer('Anzahl');
        //             table.integer('Start');
        //         })
        //         .then(() => {
        //             console.log('Table "Auftrag" created.');
        //         })
        //         .then(() => console.log('Initial Auftrag data inserted.'))
        //         .catch(err => console.error('Error creating or inserting into Auftrag:', err));
        //     }
        // });
        //
        // db.schema.hasTable('Maschine').then(exists => {
        //     if (!exists) {
        //         return db.schema.createTable('Maschine', table => {
        //             table.text('Bezeichnung').primary();
        //             table.integer('verf_von');
        //             table.integer('verf_bis');
        //             table.integer('Kap_Tag');
        //         })
        //         .then(() => {
        //             console.log('Table "Maschine" created.');
        //         })
        //         .then(() => console.log('Initial Maschine data inserted.'))
        //         .catch(err => console.error('Error creating or inserting into Maschine:', err));
        //     }
        // });

        // Закрытие соединения с БД при выходе из приложения
        app.on('before-quit', async () => {
            if (db) {
                await db.destroy();
                console.log('Database connection destroyed.');
            }
        });
    }
}

// Вызовите эту функцию в main.js перед использованием DB
initializeDatabase();

// --- Функции для взаимодействия с данными (без SQL!) ---

async function getAuftraege() {
    // Получить все записи из таблицы 'Auftrag'
    return await db('Auftrag').select('*');
}

async function getMaschinen() {
    // Получить все записи из таблицы 'Maschine'
    return await db('Maschine').select('*');
}

async function addAuftrag(auftrag) {
    // Добавить новую запись в таблицу 'Auftrag'
    // auftrag должен быть объектом: { auftrag_nr: '...', Anzahl: ..., Start: ... }
    return await db('Auftrag').insert(auftrag);
}

async function updateAuftrag(auftrag_nr, updates) {
    // Обновить запись в таблице 'Auftrag' по auftrag_nr
    // updates должен быть объектом: { Anzahl: ..., Start: ... }
    return await db('Auftrag').where({ auftrag_nr }).update(updates);
}

async function deleteAuftrag(auftrag_nr) {
    // Удалить запись из таблицы 'Auftrag' по auftrag_nr
    return await db('Auftrag').where({ auftrag_nr }).del();
}


module.exports = {
    initializeDatabase, // Экспортируем для вызова в main.js
    getAuftraege,
    getMaschinen,
    addAuftrag,
    updateAuftrag,
    deleteAuftrag
};