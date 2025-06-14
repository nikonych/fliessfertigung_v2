// core/simulation.js
import {draw, startAnimation, stopAnimation} from "../ui/simulation/renderer.js";

window.simulation = {
    isRunning: false,
    currentDay: 45000,
    intervalMs: 60000,
    timer: 0,
    auftraegeQueue: [],
    activeTasks: [],
    maschinenStatus: {},
    // Дополнительные данные для Canvas
    auftraege: [],
    maschinen: [],
    arbeitsplaene: [],
    recentActivities: [],
    startTime: null,
    // Новое: отслеживание состояния заказов
    auftraegeStatus: {}, // Состояние каждого заказа
    statistics: {
        completedTasks: 0,
        totalProcessingTime: 0,
        machineUtilization: {}
    }
};

// Функция для загрузки начальных данных
async function loadInitialData() {
    try {
        console.log("🔄 Загрузка начальных данных...");

        // Если это Electron приложение, используем IPC для получения данных
        if (window.electronAPI) {
            window.simulation.auftraege = await window.electronAPI.getAuftraege();
            window.simulation.maschinen = await window.electronAPI.getMaschinen();
            window.simulation.arbeitsplaene = await window.electronAPI.getArbeitsplaene();
        } else {
            // Для веб-версии можно использовать fetch API
            try {
                const [auftraegeRes, maschinenRes, arbeitsplaeneRes] = await Promise.all([
                    fetch('/api/auftraege'),
                    fetch('/api/maschinen'),
                    fetch('/api/arbeitsplaene')
                ]);

                window.simulation.auftraege = await auftraegeRes.json();
                window.simulation.maschinen = await maschinenRes.json();
                window.simulation.arbeitsplaene = await arbeitsplaeneRes.json();
            } catch (fetchError) {
                console.log("🧪 API недоступен, используем тестовые данные");
                loadTestData();
                return;
            }
        }

        console.log(`✅ Загружено: ${window.simulation.auftraege.length} заказов, ${window.simulation.maschinen.length} машин`);

        // Инициализация машин
        initMaschinen(window.simulation.maschinen);

        // Фильтрация заказов по текущему дню (загружаем только активные заказы)
        filterAndLoadActiveAuftraege();

        // Инициализация состояния заказов
        initAuftraegeStatus();

        console.log(`📋 В очереди ${window.simulation.auftraegeQueue.length} заказов для обработки`);
        addActivity(`Загружено ${window.simulation.auftraege.length} заказов и ${window.simulation.maschinen.length} машин`);

    } catch (error) {
        console.error("❌ Ошибка при загрузке данных:", error);
        addActivity("Ошибка загрузки данных, используются тестовые данные");
        loadTestData();
    }
}

function addActivity(message) {
    const timestamp = new Date().toLocaleTimeString();
    window.simulation.recentActivities.push(`[${timestamp}] ${message}`);

    // Сохраняем только последние 10 событий
    if (window.simulation.recentActivities.length > 10) {
        window.simulation.recentActivities = window.simulation.recentActivities.slice(-10);
    }
}

// Функция для фильтрации и загрузки активных заказов
function filterAndLoadActiveAuftraege() {
    window.simulation.auftraegeQueue = window.simulation.auftraege.filter(auftrag => {
        // Загружаем заказы, которые должны начаться до или в текущий день
        return auftrag.Start <= window.simulation.currentDay;
    });
}

// Новая функция для инициализации состояния заказов
function initAuftraegeStatus() {
    window.simulation.auftraegeStatus = {};

    for (const auftrag of window.simulation.auftraegeQueue) {
        const arbeitsplaene = getArbeitsplaeneFor(auftrag.auftrag_nr)
            .sort((a, b) => a.reihenfolge - b.reihenfolge);

        window.simulation.auftraegeStatus[auftrag.auftrag_nr] = {
            currentStep: 0, // Текущий шаг в рабочем плане
            arbeitsplaene: arbeitsplaene,
            completed: false,
            waiting: false // Ждет ли заказ освобождения машины
        };
    }
}

// Функция для получения рабочих планов для конкретного заказа
function getArbeitsplaeneFor(auftrag_nr) {
    return window.simulation.arbeitsplaene.filter(plan => plan.auftrag_nr === auftrag_nr);
}

// Тестовые данные на случай проблем с БД
function loadTestData() {
    console.log("🧪 Загрузка тестовых данных...");

    window.simulation.maschinen = [
        {Nr: 1, Bezeichnung: "Станок А", Kap_Tag: 8, verf_von: 45000, verf_bis: 46000},
        {Nr: 2, Bezeichnung: "Станок Б", Kap_Tag: 6, verf_von: 45000, verf_bis: 46000},
        {Nr: 3, Bezeichnung: "Станок В", Kap_Tag: 10, verf_von: 45000, verf_bis: 46000}
    ];

    window.simulation.auftraege = [
        {auftrag_nr: "A001", Anzahl: 100, Start: 45000},
        {auftrag_nr: "A002", Anzahl: 50, Start: 45001},
        {auftrag_nr: "A003", Anzahl: 75, Start: 45002}
    ];

    window.simulation.arbeitsplaene = [
        {auftrag_nr: "A001", maschine: 1, dauer: 16, reihenfolge: 1},
        {auftrag_nr: "A001", maschine: 2, dauer: 12, reihenfolge: 2},
        {auftrag_nr: "A002", maschine: 2, dauer: 10, reihenfolge: 1},
        {auftrag_nr: "A002", maschine: 3, dauer: 8, reihenfolge: 2},
        {auftrag_nr: "A003", maschine: 1, dauer: 20, reihenfolge: 1}
    ];

    initMaschinen(window.simulation.maschinen);
    filterAndLoadActiveAuftraege();
    initAuftraegeStatus();
    addActivity("Тестовые данные загружены");
}

function startSimulation() {
    console.log("🚀 Запуск симуляции");
    if (window.simulation.isRunning) return;

    window.simulation.isRunning = true;
    window.simulation.startTime = Date.now();
    window.simulation.timer = setInterval(simulationStep, window.simulation.intervalMs);

    addActivity("Симуляция запущена");
    startAnimation();
}

function stopSimulation() {
    console.log("⏸️ Остановка симуляции");
    window.simulation.isRunning = false;
    clearInterval(window.simulation.timer);

    addActivity("Симуляция остановлена");
    stopAnimation();
    draw(); // Финальная отрисовка
}

async function resetSimulation() {
    console.log("🔄 Сброс симуляции");
    stopSimulation();

    // Сброс состояния симуляции
    window.simulation.currentDay = 45000;
    window.simulation.activeTasks = [];
    window.simulation.auftraegeQueue = [];
    window.simulation.maschinenStatus = {};
    window.simulation.auftraegeStatus = {};
    window.simulation.recentActivities = [];
    window.simulation.startTime = null;
    window.simulation.statistics = {
        completedTasks: 0,
        totalProcessingTime: 0,
        machineUtilization: {}
    };

    // Перезагружаем данные
    await loadInitialData();
    addActivity("Симуляция сброшена");

    // Обновляем отображение
    draw();
}

function simulationStep() {
    window.simulation.currentDay++;
    console.log(`📅 Tag ${window.simulation.currentDay}: Simulationsschritt gestartet`);

    // Завершение активных задач
    window.simulation.activeTasks = window.simulation.activeTasks.filter(task => {
        const maschine = window.simulation.maschinenStatus[task.maschine];
        if (!maschine) {
            console.warn(`⚠️ Машина ${task.maschine} не найдена!`);
            return false;
        }

        task.remaining -= maschine.kapTag;
        console.log(`⏳ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} hat noch ${task.remaining}h übrig`);

        if (task.remaining <= 0) {
            // Освобождаем машину
            maschine.frei = true;
            console.log(`✅ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} abgeschlossen`);
            addActivity(`Операция заказа ${task.auftrag_nr} завершена на машине ${task.maschine}`);

            // Обновляем состояние заказа - переходим к следующему шагу
            const auftragStatus = window.simulation.auftraegeStatus[task.auftrag_nr];
            if (auftragStatus) {
                auftragStatus.currentStep++;
                auftragStatus.waiting = false;

                // Проверяем, завершен ли весь заказ
                if (auftragStatus.currentStep >= auftragStatus.arbeitsplaene.length) {
                    auftragStatus.completed = true;
                    console.log(`🎉 Заказ ${task.auftrag_nr} полностью завершен!`);
                    addActivity(`Заказ ${task.auftrag_nr} полностью завершен`);
                    window.simulation.statistics.completedTasks++;
                }
            }

            return false; // Удаляем выполненную задачу
        }
        return true;
    });

    // Проверяем, есть ли новые заказы для текущего дня
    const newAuftraege = window.simulation.auftraege.filter(auftrag =>
        auftrag.Start === window.simulation.currentDay &&
        !window.simulation.auftraegeQueue.find(existing => existing.auftrag_nr === auftrag.auftrag_nr)
    );

    if (newAuftraege.length > 0) {
        window.simulation.auftraegeQueue.push(...newAuftraege);

        // Инициализируем состояние для новых заказов
        for (const auftrag of newAuftraege) {
            const arbeitsplaene = getArbeitsplaeneFor(auftrag.auftrag_nr)
                .sort((a, b) => a.reihenfolge - b.reihenfolge);

            window.simulation.auftraegeStatus[auftrag.auftrag_nr] = {
                currentStep: 0,
                arbeitsplaene: arbeitsplaene,
                completed: false,
                waiting: false
            };
        }

        console.log(`📥 Добавлено ${newAuftraege.length} новых заказов в очередь`);
        addActivity(`Добавлено ${newAuftraege.length} новых заказов`);
    }

    // Назначение новых задач - исправленная логика
    for (const auftrag of window.simulation.auftraegeQueue) {
        const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];

        // Пропускаем завершенные заказы
        if (!auftragStatus || auftragStatus.completed) continue;

        // Проверяем, есть ли уже активная задача для этого заказа
        const hasActiveTask = window.simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
        if (hasActiveTask) continue;

        // Получаем текущую операцию для выполнения
        const currentOperation = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
        if (!currentOperation) continue;

        const machineId = currentOperation.maschine;
        const machine = window.simulation.maschinenStatus[machineId];

        if (machine && machine.frei && machine.verfuegbar) {
            // Запускаем текущую операцию
            machine.frei = false;
            window.simulation.activeTasks.push({
                auftrag_nr: auftrag.auftrag_nr,
                maschine: machineId,
                remaining: currentOperation.dauer,
                operation: auftragStatus.currentStep + 1 // Для отображения
            });

            console.log(`🚀 Starte Auftrag ${auftrag.auftrag_nr} Schritt ${auftragStatus.currentStep + 1} auf Maschine ${machineId} (Dauer: ${currentOperation.dauer}h)`);
            addActivity(`Запущен заказ ${auftrag.auftrag_nr} (шаг ${auftragStatus.currentStep + 1}) на машине ${machineId}`);
        } else if (machine && !machine.frei) {
            // Машина занята - заказ ждет
            if (!auftragStatus.waiting) {
                auftragStatus.waiting = true;
                console.log(`⏳ Заказ ${auftrag.auftrag_nr} ждет освобождения машины ${machineId}`);
                addActivity(`Заказ ${auftrag.auftrag_nr} ждет машину ${machineId}`);
            }
        }
    }

    // Удаляем завершенные заказы из очереди
    window.simulation.auftraegeQueue = window.simulation.auftraegeQueue.filter(auftrag => {
        const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];
        return auftragStatus && !auftragStatus.completed;
    });

    // Обновление статистики использования машин
    updateMachineUtilization();

    // Проверка на завершение симуляции
    if (window.simulation.activeTasks.length === 0 && window.simulation.auftraegeQueue.length === 0) {
        stopSimulation();
        addActivity("Все заказы завершены");
        console.log("🏁 Симуляция завершена - все заказы обработаны");
    }

    console.log("Активные задачи:", window.simulation.activeTasks);
    console.log("Состояние заказов:", window.simulation.auftraegeStatus);

    draw();
}

function initMaschinen(maschinen) {
    console.log("🏭 Инициализация машин...");
    window.simulation.maschinenStatus = {};
    window.simulation.statistics.machineUtilization = {};

    for (const m of maschinen) {
        // Проверяем, доступна ли машина в текущий день
        const isAvailable = window.simulation.currentDay >= m.verf_von && window.simulation.currentDay <= m.verf_bis;

        window.simulation.maschinenStatus[m.Nr] = {
            frei: isAvailable,
            kapTag: m.Kap_Tag,
            bezeichnung: m.Bezeichnung,
            verfuegbar: isAvailable
        };

        // Инициализация статистики использования
        window.simulation.statistics.machineUtilization[m.Nr] = {
            totalTime: 0,
            workingTime: 0,
            utilization: 0
        };

        console.log(`🔧 Машина ${m.Nr} (${m.Bezeichnung}): ${isAvailable ? 'доступна' : 'недоступна'}`);
    }
}

function updateMachineUtilization() {
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machine = window.simulation.maschinenStatus[machineId];
        const utilization = window.simulation.statistics.machineUtilization[machineId];
        
        if (utilization) {
            utilization.totalTime++;
            
            if (!machine.frei) {
                utilization.workingTime++;
            }
            
            utilization.utilization = utilization.totalTime > 0 ? 
                (utilization.workingTime / utilization.totalTime * 100).toFixed(1) : 0;
        }
    });
}

// Инициализация при загрузке модуля
async function initialize() {
    await loadInitialData();
    draw(); // Обновляем отображение после загрузки данных
}

// Event listeners для кнопок (если они существуют)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const speedSlider = document.getElementById("speedSlider");
        const startBtn = document.getElementById("startBtn");
        const stopBtn = document.getElementById("stopBtn");
        const resetBtn = document.getElementById("resetBtn");

        if (speedSlider) {
            speedSlider.addEventListener("change", (e) => {
                const value = parseInt(e.target.value);
                window.simulation.intervalMs = value * 1000;
                console.log(`⚙️ Simulationsintervall auf ${value} Min (→ ${window.simulation.intervalMs} ms) gesetzt`);

                if (window.simulation.isRunning) {
                    stopSimulation();
                    startSimulation();
                }
            });
        }

        if (startBtn) startBtn.addEventListener("click", startSimulation);
        if (stopBtn) stopBtn.addEventListener("click", stopSimulation);
        if (resetBtn) resetBtn.addEventListener("click", resetSimulation);
    });
}

// Экспортируем функции для использования в других модулях
export {
    loadInitialData,
    getArbeitsplaeneFor,
    initialize,
    startSimulation,
    stopSimulation,
    resetSimulation,
    addActivity
};

// Автоматическая инициализация при загрузке (если не в модульной среде)
if (typeof window !== 'undefined') {
    initialize().catch(console.error);
}