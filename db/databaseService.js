// src/main/databaseService.js
const knex = require('knex');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');
let db;

function initializeDatabase() {
    if (!db) {
        db = knex({
            client: 'better-sqlite3',
            connection: {
                filename: dbPath
            },
            useNullAsDefault: true
        });

        console.log(`Database service initialized at: ${dbPath}`);

        // Создание таблиц при первом запуске
        createTablesIfNotExist();

        // Закрытие соединения с БД при выходе из приложения
        app.on('before-quit', async () => {
            if (db) {
                await db.destroy();
                console.log('Database connection destroyed.');
            }
        });
    }
}

async function createTablesIfNotExist() {
    try {
        // Создание таблицы Auftrag
        const auftraegeExists = await db.schema.hasTable('Auftrag');
        if (!auftraegeExists) {
            await db.schema.createTable('Auftrag', table => {
                table.text('auftrag_nr').primary();
                table.integer('Anzahl');
                table.integer('Start');
            });
            console.log('Table "Auftrag" created.');

            // Вставка тестовых данных
            await db('Auftrag').insert([
                { auftrag_nr: 'A001', Anzahl: 100, Start: 45000 },
                { auftrag_nr: 'A002', Anzahl: 50, Start: 45001 },
                { auftrag_nr: 'A003', Anzahl: 75, Start: 45002 },
                { auftrag_nr: 'A004', Anzahl: 120, Start: 45003 }
            ]);
            console.log('Initial Auftrag data inserted.');
        }

        // Создание таблицы Maschine
        const maschinenExists = await db.schema.hasTable('Maschine');
        if (!maschinenExists) {
            await db.schema.createTable('Maschine', table => {
                table.integer('Nr').primary();
                table.text('Bezeichnung');
                table.integer('verf_von');
                table.integer('verf_bis');
                table.integer('Kap_Tag');
            });
            console.log('Table "Maschine" created.');

            // Вставка тестовых данных
            await db('Maschine').insert([
                { Nr: 1, Bezeichnung: 'Станок А', verf_von: 45000, verf_bis: 46000, Kap_Tag: 8 },
                { Nr: 2, Bezeichnung: 'Станок Б', verf_von: 45000, verf_bis: 46000, Kap_Tag: 6 },
                { Nr: 3, Bezeichnung: 'Станок В', verf_von: 45000, verf_bis: 46000, Kap_Tag: 10 },
                { Nr: 4, Bezeichnung: 'Станок Г', verf_von: 45000, verf_bis: 46000, Kap_Tag: 12 }
            ]);
            console.log('Initial Maschine data inserted.');
        }

        // Создание таблицы Arbeitsplan
        const arbeitsplanExists = await db.schema.hasTable('Arbeitsplan');
        if (!arbeitsplanExists) {
            await db.schema.createTable('Arbeitsplan', table => {
                table.increments('id').primary();
                table.text('auftrag_nr').references('auftrag_nr').inTable('Auftrag');
                table.integer('maschine').references('Nr').inTable('Maschine');
                table.integer('dauer'); // продолжительность в часах
                table.integer('reihenfolge'); // порядок выполнения операций
            });
            console.log('Table "Arbeitsplan" created.');

            // Вставка тестовых данных
            await db('Arbeitsplan').insert([
                // Заказ A001: Станок А (16ч) -> Станок Б (12ч)
                { auftrag_nr: 'A001', maschine: 1, dauer: 16, reihenfolge: 1 },
                { auftrag_nr: 'A001', maschine: 2, dauer: 12, reihenfolge: 2 },

                // Заказ A002: Станок Б (10ч) -> Станок В (8ч)
                { auftrag_nr: 'A002', maschine: 2, dauer: 10, reihenfolge: 1 },
                { auftrag_nr: 'A002', maschine: 3, dauer: 8, reihenfolge: 2 },

                // Заказ A003: Станок А (20ч)
                { auftrag_nr: 'A003', maschine: 1, dauer: 20, reihenfolge: 1 },

                // Заказ A004: Станок В (15ч) -> Станок Г (10ч) -> Станок А (8ч)
                { auftrag_nr: 'A004', maschine: 3, dauer: 15, reihenfolge: 1 },
                { auftrag_nr: 'A004', maschine: 4, dauer: 10, reihenfolge: 2 },
                { auftrag_nr: 'A004', maschine: 1, dauer: 8, reihenfolge: 3 }
            ]);
            console.log('Initial Arbeitsplan data inserted.');
        }

    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

// --- Функции для взаимодействия с данными ---

async function getAuftraege() {
    try {
        return await db('Auftrag').select('*').orderBy('Start');
    } catch (error) {
        console.error('Error getting Auftraege:', error);
        return [];
    }
}

async function getMaschinen() {
    try {
        return await db('Maschine').select('*').orderBy('Nr');
    } catch (error) {
        console.error('Error getting Maschinen:', error);
        return [];
    }
}

async function getArbeitsplaene() {
    try {
        return await db('Arbeitsplan')
            .select('*')
            .orderBy(['auftrag_nr', 'ag_nr']);
    } catch (error) {
        console.error('Error getting Arbeitsplaene:', error);
        return [];
    }
}

async function getArbeitsplaeneForAuftrag(auftrag_nr) {
    try {
        return await db('Arbeitsplan')
            .where('auftrag_nr', auftrag_nr)
            .select('*')
            .orderBy('ag_nr');
    } catch (error) {
        console.error(`Error getting Arbeitsplaene for ${auftrag_nr}:`, error);
        return [];
    }
}

async function addAuftrag(auftrag) {
    try {
        return await db('Auftrag').insert(auftrag);
    } catch (error) {
        console.error('Error adding Auftrag:', error);
        throw error;
    }
}

async function updateAuftrag(auftrag_nr, updates) {
    try {
        return await db('Auftrag').where({ auftrag_nr }).update(updates);
    } catch (error) {
        console.error('Error updating Auftrag:', error);
        throw error;
    }
}

async function deleteAuftrag(auftrag_nr) {
    try {
        // Сначала удаляем связанные рабочие планы
        await db('Arbeitsplan').where({ auftrag_nr }).del();
        // Затем удаляем сам заказ
        return await db('Auftrag').where({ auftrag_nr }).del();
    } catch (error) {
        console.error('Error deleting Auftrag:', error);
        throw error;
    }
}

async function addMaschine(maschine) {
    try {
        return await db('Maschine').insert(maschine);
    } catch (error) {
        console.error('Error adding Maschine:', error);
        throw error;
    }
}

async function updateMaschine(nr, updates) {
    try {
        return await db('Maschine').where({ Nr: nr }).update(updates);
    } catch (error) {
        console.error('Error updating Maschine:', error);
        throw error;
    }
}

async function addArbeitsplan(arbeitsplan) {
    try {
        return await db('Arbeitsplan').insert(arbeitsplan);
    } catch (error) {
        console.error('Error adding Arbeitsplan:', error);
        throw error;
    }
}

// Функция для получения статистики симуляции
async function getSimulationStats() {
    try {
        const auftraegeCount = await db('Auftrag').count('* as count').first();
        const maschinenCount = await db('Maschine').count('* as count').first();
        const arbeitsplaeneCount = await db('Arbeitsplan').count('* as count').first();

        return {
            auftraege: auftraegeCount.count,
            maschinen: maschinenCount.count,
            arbeitsplaene: arbeitsplaeneCount.count
        };
    } catch (error) {
        console.error('Error getting simulation stats:', error);
        return { auftraege: 0, maschinen: 0, arbeitsplaene: 0 };
    }
}

module.exports = {
    initializeDatabase,
    getAuftraege,
    getMaschinen,
    getArbeitsplaene,
    getArbeitsplaeneForAuftrag,
    addAuftrag,
    updateAuftrag,
    deleteAuftrag,
    addMaschine,
    updateMaschine,
    addArbeitsplan,
    getSimulationStats
};