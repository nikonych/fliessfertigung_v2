import {draw} from "../ui/simulation/renderer.js";

export const simulation = {
    isRunning: false,
    currentDay: 45000,
    intervalMs: 60000,
    timer: 0,
    auftraegeQueue: [],  // Aufträge, ожидающие обработки
    activeTasks: [],     // Запущенные Arbeitsplan-операции
    maschinenStatus: {}, // { maschineNr: { frei: true/false, verbleibend: x } }
    // Добавляем кэш для данных
    auftraege: [],       // Все загруженные заказы
    maschinen: [],       // Все загруженные машины
    arbeitsplaene: []    // Все рабочие планы
};
window.simulation = simulation;

// Функция для загрузки начальных данных
async function loadInitialData() {
    try {
        console.log("🔄 Загрузка начальных данных...");

        // Если это Electron приложение, используем IPC для получения данных
        if (window.electronAPI) {
            simulation.auftraege = await window.electronAPI.getAuftraege();
            simulation.maschinen = await window.electronAPI.getMaschinen();
            simulation.arbeitsplaene = await window.electronAPI.getArbeitsplaene();
        } else {
            // Для веб-версии можно использовать fetch API
            const [auftraegeRes, maschinenRes, arbeitsplaeneRes] = await Promise.all([
                fetch('/api/auftraege'),
                fetch('/api/maschinen'),
                fetch('/api/arbeitsplaene')
            ]);

            simulation.auftraege = await auftraegeRes.json();
            simulation.maschinen = await maschinenRes.json();
            simulation.arbeitsplaene = await arbeitsplaeneRes.json();
        }

        console.log(`✅ Загружено: ${simulation.auftraege.length} заказов, ${simulation.maschinen.length} машин`);

        // Инициализация машин
        initMaschinen(simulation.maschinen);

        // Фильтрация заказов по текущему дню (загружаем только активные заказы)
        filterAndLoadActiveAuftraege();

        console.log(`📋 В очереди ${simulation.auftraegeQueue.length} заказов для обработки`);

    } catch (error) {
        console.error("❌ Ошибка при загрузке данных:", error);
        // Можно загрузить тестовые данные в случае ошибки
        loadTestData();
    }
}

// Функция для фильтрации и загрузки активных заказов
function filterAndLoadActiveAuftraege() {
    simulation.auftraegeQueue = simulation.auftraege.filter(auftrag => {
        // Загружаем заказы, которые должны начаться до или в текущий день
        return auftrag.Start <= simulation.currentDay;
    });
}

// Функция для получения рабочих планов для конкретного заказа
function getArbeitsplaeneFor(auftrag_nr) {
    return simulation.arbeitsplaene.filter(plan => plan.auftrag_nr === auftrag_nr);
}

// Тестовые данные на случай проблем с БД
function loadTestData() {
    console.log("🧪 Загрузка тестовых данных...");

    simulation.maschinen = [
        { Nr: 1, Bezeichnung: "Станок А", Kap_Tag: 8, verf_von: 45000, verf_bis: 46000 },
        { Nr: 2, Bezeichnung: "Станок Б", Kap_Tag: 6, verf_von: 45000, verf_bis: 46000 },
        { Nr: 3, Bezeichnung: "Станок В", Kap_Tag: 10, verf_von: 45000, verf_bis: 46000 }
    ];

    simulation.auftraege = [
        { auftrag_nr: "A001", Anzahl: 100, Start: 45000 },
        { auftrag_nr: "A002", Anzahl: 50, Start: 45001 },
        { auftrag_nr: "A003", Anzahl: 75, Start: 45002 }
    ];

    simulation.arbeitsplaene = [
        { auftrag_nr: "A001", maschine: 1, dauer: 16, reihenfolge: 1 },
        { auftrag_nr: "A001", maschine: 2, dauer: 12, reihenfolge: 2 },
        { auftrag_nr: "A002", maschine: 2, dauer: 10, reihenfolge: 1 },
        { auftrag_nr: "A002", maschine: 3, dauer: 8, reihenfolge: 2 },
        { auftrag_nr: "A003", maschine: 1, dauer: 20, reihenfolge: 1 }
    ];

    initMaschinen(simulation.maschinen);
    filterAndLoadActiveAuftraege();
}

function startSimulation() {
    console.log("🚀 Запуск симуляции");
    if (simulation.isRunning) return;
    simulation.isRunning = true;
    simulation.timer = setInterval(simulationStep, simulation.intervalMs);
}

function stopSimulation() {
    console.log("⏸️ Остановка симуляции");
    simulation.isRunning = false;
    clearInterval(simulation.timer);
}

async function resetSimulation() {
    console.log("🔄 Сброс симуляции");
    stopSimulation();
    simulation.currentDay = 45000;
    simulation.activeTasks = [];
    simulation.maschinenStatus = {};

    // Перезагружаем данные
    await loadInitialData();

    // Обновляем отображение
    draw();
}

function simulationStep() {
    simulation.currentDay++;
    console.log(`📅 Tag ${simulation.currentDay}: Simulationsschritt gestartet`);

    // Завершение активных задач
    simulation.activeTasks = simulation.activeTasks.filter(task => {
        const maschine = simulation.maschinenStatus[task.maschine];
        if (!maschine) {
            console.warn(`⚠️ Машина ${task.maschine} не найдена!`);
            return false;
        }

        task.remaining -= maschine.kapTag;
        console.log(`⏳ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} hat noch ${task.remaining}h übrig`);

        if (task.remaining <= 0) {
            maschine.frei = true;
            console.log(`✅ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} abgeschlossen`);
            return false;
        }
        return true;
    });

    // Проверяем, есть ли новые заказы для текущего дня
    const newAuftraege = simulation.auftraege.filter(auftrag =>
        auftrag.Start === simulation.currentDay &&
        !simulation.auftraegeQueue.find(existing => existing.auftrag_nr === auftrag.auftrag_nr)
    );

    if (newAuftraege.length > 0) {
        simulation.auftraegeQueue.push(...newAuftraege);
        console.log(`📥 Добавлено ${newAuftraege.length} новых заказов в очередь`);
    }

    // Назначение новых задач
    for (const auftrag of simulation.auftraegeQueue) {
        const pläne = getArbeitsplaeneFor(auftrag.auftrag_nr)
            .sort((a, b) => a.reihenfolge - b.reihenfolge); // Сортируем по порядку выполнения

        for (const plan of pläne) {
            const m = plan.maschine;
            if (simulation.maschinenStatus[m]?.frei) {
                simulation.maschinenStatus[m].frei = false;
                simulation.activeTasks.push({
                    auftrag_nr: auftrag.auftrag_nr,
                    maschine: m,
                    remaining: plan.dauer
                });
                console.log(`🚀 Starte Auftrag ${auftrag.auftrag_nr} auf Maschine ${m} (Dauer: ${plan.dauer}h)`);
                break; // Запускаем только первую доступную операцию
            }
        }
    }

    // Удаляем завершенные заказы из очереди
    simulation.auftraegeQueue = simulation.auftraegeQueue.filter(auftrag => {
        const pläne = getArbeitsplaeneFor(auftrag.auftrag_nr);
        const hasActiveTasks = simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
        const hasWaitingTasks = pläne.some(plan =>
            !simulation.activeTasks.some(task =>
                task.auftrag_nr === auftrag.auftrag_nr && task.maschine === plan.maschine
            )
        );

        return hasActiveTasks || hasWaitingTasks;
    });

    draw();
}

function initMaschinen(maschinen) {
    console.log("🏭 Инициализация машин...");
    simulation.maschinenStatus = {};

    for (const m of maschinen) {
        // Проверяем, доступна ли машина в текущий день
        const isAvailable = simulation.currentDay >= m.verf_von && simulation.currentDay <= m.verf_bis;

        simulation.maschinenStatus[m.Nr] = {
            frei: isAvailable,
            kapTag: m.Kap_Tag,
            bezeichnung: m.Bezeichnung,
            verfuegbar: isAvailable
        };

        console.log(`🔧 Машина ${m.Nr} (${m.Bezeichnung}): ${isAvailable ? 'доступна' : 'недоступна'}`);
    }
}

// Инициализация при загрузке модуля
async function initialize() {
    await loadInitialData();
    draw(); // Обновляем отображение после загрузки данных
}

// Event listeners
document.getElementById("speedSlider").addEventListener("change", (e) => {
    const value = parseInt(e.target.value);
    simulation.intervalMs = value * 1000;
    console.log(`⚙️ Simulationsintervall auf ${value} Min (→ ${simulation.intervalMs} ms) gesetzt`);

    if (simulation.isRunning) {
        stopSimulation();
        startSimulation();
    }
});

document.getElementById("startBtn").addEventListener("click", startSimulation);
document.getElementById("stopBtn").addEventListener("click", stopSimulation);
document.getElementById("resetBtn").addEventListener("click", resetSimulation);

// Экспортируем функции для использования в других модулях
export {
    loadInitialData,
    getArbeitsplaeneFor,
    initialize,
    startSimulation,
    stopSimulation,
    resetSimulation
};

// Автоматическая инициализация при загрузке
initialize().catch(console.error);