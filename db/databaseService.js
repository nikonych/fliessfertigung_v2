const knex = require('knex');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'manufacturing.db');
let db;

function getDb() {
    if (!db) throw new Error('База данных не инициализирована');
    return db;
}

async function initializeDatabase() {
    if (!db) {
        db = knex({
            client: 'better-sqlite3',
            connection: {
                filename: dbPath
            },
            useNullAsDefault: true
        });

        console.log(`Database service initialized at: ${dbPath}`);

        await createTablesIfNotExist(); // обязательно ждать

        app.on('before-quit', async () => {
            if (db) {
                await db.destroy();
                console.log('Database connection destroyed.');
            }
        });
    }
}

async function reinitializeDatabase() {
    try {
        console.log('🔄 Переинициализация базы данных...');

        if (db) {
            await db.destroy();
            db = null;
            console.log('Старое соединение закрыто');
        }

        db = knex({
            client: 'better-sqlite3',
            connection: {
                filename: dbPath
            },
            useNullAsDefault: true
        });

        console.log('✅ Новое соединение создано');

        await createTablesIfNotExist();

        console.log('✅ База данных переинициализирована успешно');
        return true;
    } catch (error) {
        console.error('❌ Ошибка переинициализации базы данных:', error);
        throw error;
    }
}


async function createTablesIfNotExist() {
    const db = getDb();

    try {
        const auftraegeExists = await db.schema.hasTable('Auftrag');
        if (!auftraegeExists) {
            await db.schema.createTable('Auftrag', table => {
                table.text('auftrag_nr').primary();
                table.integer('Anzahl');
                table.integer('Start');
            });
            console.log('Table "Auftrag" created.');
            await db('Auftrag').insert([
                { auftrag_nr: 'A001', Anzahl: 100, Start: 45000 },
                { auftrag_nr: 'A002', Anzahl: 50, Start: 45001 },
                { auftrag_nr: 'A003', Anzahl: 75, Start: 45002 },
                { auftrag_nr: 'A004', Anzahl: 120, Start: 45003 }
            ]);
        }

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
            await db('Maschine').insert([
                { Nr: 1, Bezeichnung: 'Станок А', verf_von: 45000, verf_bis: 46000, Kap_Tag: 8 },
                { Nr: 2, Bezeichnung: 'Станок Б', verf_von: 45000, verf_bis: 46000, Kap_Tag: 6 },
                { Nr: 3, Bezeichnung: 'Станок В', verf_von: 45000, verf_bis: 46000, Kap_Tag: 10 },
                { Nr: 4, Bezeichnung: 'Станок Г', verf_von: 45000, verf_bis: 46000, Kap_Tag: 12 }
            ]);
        }

        const arbeitsplanExists = await db.schema.hasTable('Arbeitsplan');
        if (!arbeitsplanExists) {
            await db.schema.createTable('Arbeitsplan', table => {
                table.increments('id').primary();
                table.text('auftrag_nr').references('auftrag_nr').inTable('Auftrag');
                table.integer('maschine').references('Nr').inTable('Maschine');
                table.integer('dauer');
                table.integer('reihenfolge');
            });
            console.log('Table "Arbeitsplan" created.');
            await db('Arbeitsplan').insert([
                { auftrag_nr: 'A001', maschine: 1, dauer: 16, reihenfolge: 1 },
                { auftrag_nr: 'A001', maschine: 2, dauer: 12, reihenfolge: 2 },
                { auftrag_nr: 'A002', maschine: 2, dauer: 10, reihenfolge: 1 },
                { auftrag_nr: 'A002', maschine: 3, dauer: 8, reihenfolge: 2 },
                { auftrag_nr: 'A003', maschine: 1, dauer: 20, reihenfolge: 1 },
                { auftrag_nr: 'A004', maschine: 3, dauer: 15, reihenfolge: 1 },
                { auftrag_nr: 'A004', maschine: 4, dauer: 10, reihenfolge: 2 },
                { auftrag_nr: 'A004', maschine: 1, dauer: 8, reihenfolge: 3 }
            ]);
        }

    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

// CRUD и статистика
async function getAuftraege() {
    try {
        return await getDb()('Auftrag').select('*').orderBy('Start');
    } catch (error) {
        console.error('Error getting Auftraege:', error);
        return [];
    }
}

async function getMaschinen() {
    try {
        return await getDb()('Maschine').select('*').orderBy('Nr');
    } catch (error) {
        console.error('Error getting Maschinen:', error);
        return [];
    }
}
async function deleteMaschinen(nr) {
    const db = getDb();

    try {


        return await db("Maschine").where({ Nr: nr }).del();

    } catch (error) {
        console.error("Error deleting Maschinen:", error);
        throw error; // пробрасываем для обработки на фронте
    }
}


async function getArbeitsplaene() {
    try {
        return await getDb()('Arbeitsplan').select('*').orderBy(['auftrag_nr', 'ag_nr']);
    } catch (error) {
        console.error('Error getting Arbeitsplaene:', error);
        return [];
    }
}

async function getArbeitsplaeneForAuftrag(auftrag_nr) {
    try {
        return await getDb()('Arbeitsplan')
            .where('auftrag_nr', auftrag_nr)
            .select('*')
            .orderBy('ag_nr');
    } catch (error) {
        console.error(`Error getting Arbeitsplaene for ${auftrag_nr}:`, error);
        return [];
    }
}



async function updateAuftrag(auftrag_nr, updates) {
    try {
        return await getDb()('Auftrag').where({ auftrag_nr }).update(updates);
    } catch (error) {
        console.error('Error updating Auftrag:', error);
        throw error;
    }
}


async function updateArbeitsplan( auftrag_nr, ag_nr, updates) {
    try {
        return await getDb()('Arbeitsplan').where({ auftrag_nr, ag_nr }).update(updates);
    } catch (error) {
        console.error('Error updating Arbeitsplan:', error);
        throw error;
    }
}

async function deleteArbeitsplan(auftrag_nr, ag_nr) {
    try {
        return await db("Arbeitsplan")
            .where({ auftrag_nr, ag_nr })
            .del();
    } catch (error) {
        console.error('Error updating Arbeitsplan:', error);
        throw error;
    }
}

async function deleteAuftrag(auftrag_nr) {
    try {
        const db = getDb();
        await db('Arbeitsplan').where({ auftrag_nr }).del();
        return await db('Auftrag').where({ auftrag_nr }).del();
    } catch (error) {
        console.error('Error deleting Auftrag:', error);
        throw error;
    }
}

async function addMaschine(maschine) {
    try {
        return await getDb()('Maschine').insert(maschine);
    } catch (error) {
        console.error('Error adding Maschine:', error);
        throw error;
    }
}

async function updateMaschine(nr, updates) {
    try {
        if (!updates || Object.keys(updates).length === 0) {
            throw new Error('No update fields provided');
        }

        const result = await getDb()('Maschine').where({ Nr: nr }).update(updates);
        return result; // обычно возвращает количество затронутых строк
    } catch (error) {
        console.error('Error updating Maschine:', error);
        throw error;
    }
}
async function addArbeitsplan(arbeitsplan) {
    try {
        return await getDb()('Arbeitsplan').insert(arbeitsplan);
    } catch (error) {
        console.error('Error adding Arbeitsplan:', error);
        throw error;
    }
}

async function getLastAuftragNr() {
    const last = await getDb()("Auftrag")
        .orderBy("auftrag_nr", "desc")
        .first();
    return last?.auftrag_nr || "A00000";
}



async function addAuftrag(data) {
    return await getDb()("Auftrag").insert(data);
}



async function getSimulationStats() {
    try {
        const db = getDb();
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

async function closeDatabase() {
    if (db) {
        await db.destroy();
        db = null;
        console.log('🔌 Соединение с БД уничтожено');
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
    getSimulationStats,
    closeDatabase,
    reinitializeDatabase,
    deleteMaschinen,
    deleteArbeitsplan,
    updateArbeitsplan,
    getLastAuftragNr
};
