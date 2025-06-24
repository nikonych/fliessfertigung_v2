// core/simulation.js
import {draw, startAnimation, stopAnimation} from "../ui/simulation/renderer.js";

function calculateDayFromDate(dateString) {
    const targetDate = new Date(dateString);
    const baseDate = new Date('2022-01-02');
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}


window.simulation = {
    simulationMinutesPerStep: 1,
    isRunning: false,
    currentTimeMinutes: calculateDayFromDate('2022-01-02') * 24 * 60,
    intervalMs: 1000,
    timer: null,
    auftraegeQueue: [],
    activeTasks: [],
    maschinenStatus: {},
    auftraege: [],
    maschinen: [],
    arbeitsplaene: [],
    recentActivities: [],
    startTime: null,
    auftraegeStatus: {},
    statistics: {
        completedTasks: 0,
        totalProcessingTime: 0,
        machineUtilization: {},
        // НОВЫЕ поля для детальной статистики
        orderStatistics: {}, // Статистика по каждому заказу
        machineIdleTime: {}, // Время простоя каждой машины
        bufferStatistics: {}, // Статистика буферных складов
        totalSimulationTime: 0,
        systemStartTime: null
    }
};

function setSimulationStartDate(dateString) {
    const dayNumber = calculateDayFromDate(dateString);
    window.simulation.currentTimeMinutes = dayNumber * 24 * 60;
}

// Функция для загрузки начальных данных
async function loadInitialData() {
    try {

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
                loadTestData();
                return;
            }
        }
        console.log("📋 Überprüfung der geladenen Daten:");
        console.log(`- Aufträge: ${window.simulation.auftraege.length}`);
        console.log(`- Maschinen: ${window.simulation.maschinen.length}`);
        console.log(`- Arbeitspläne: ${window.simulation.arbeitsplaene.length}`);


        // Инициализация машин
        initMaschinen(window.simulation.maschinen);

        // Фильтрация заказов по текущему дню (загружаем только активные заказы)
        filterAndLoadActiveAuftraege();

        // Инициализация состояния заказов
        initAuftraegeStatus();

        addActivity(`Es wurden ${window.simulation.auftraege.length} Aufträge und ${window.simulation.maschinen.length} Maschinen geladen`);

    } catch (error) {
        console.error("❌ Fehler beim Laden der Daten:", error);
        addActivity("Fehler beim Laden der Daten, Testdaten werden verwendet");
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
    console.log("🔍 Filterung der aktiven Aufträge...");

    const currentDay = getCurrentDay();
    console.log(`📅 Aktueller Simulations-Tag: ${currentDay}`);

    const allOrders = window.simulation.auftraege || [];
    console.log(`📦 Gesamtanzahl der zu prüfenden Aufträge: ${allOrders.length}`);

    // KORREKTUR: Erweiterung des Ladefensters für Aufträge
    window.simulation.auftraegeQueue = allOrders.filter(auftrag => {
        if (!auftrag.auftrag_nr) {
            console.warn(`⚠️ Auftrag ohne Nummer:`, auftrag);
            return false;
        }

        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        } else {
            console.warn(`⚠️ Ungültiges Startdatum für Auftrag ${auftrag.auftrag_nr}:`, auftrag.Start);
            return false;
        }

        const hasWorkPlan = window.simulation.arbeitsplaene.some(
            plan => plan.auftrag_nr === auftrag.auftrag_nr
        );

        if (!hasWorkPlan) {
            console.warn(`⚠️ Kein Arbeitsplan für Auftrag ${auftrag.auftrag_nr}`);
            return false;
        }

        // KORREKTUR: Alle Aufträge laden, nicht nur die mit Start in den nächsten 7 Tagen
        // Aufträge werden verarbeitet, sobald ihre Zeit gekommen ist
        const shouldBeLoaded = true; // Alle Aufträge werden geladen

        console.log(`  📋 Auftrag ${auftrag.auftrag_nr}: Start=${startDay}, geladen=${shouldBeLoaded}`);

        return shouldBeLoaded;
    });

    console.log(`✅ Geladene Aufträge: ${window.simulation.auftraegeQueue.length}`);
}

// Новая функция для инициализации состояния заказов
function initAuftraegeStatus() {
    console.log("🔄 Initialisierung der Auftragsstatus...");

    window.simulation.auftraegeStatus = {};

    if (!window.simulation.auftraegeQueue || window.simulation.auftraegeQueue.length === 0) {
        console.warn("⚠️ Keine Aufträge in der Warteschlange zur Initialisierung!");
        return;
    }

    for (const auftrag of window.simulation.auftraegeQueue) {
        // Hole die Arbeitspläne für den Auftrag
        const arbeitsplaene = getArbeitsplaeneFor(auftrag.auftrag_nr)
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));

        if (arbeitsplaene.length === 0) {
            console.warn(`⚠️ Keine Arbeitspläne für Auftrag ${auftrag.auftrag_nr}`);
            continue;
        }

        const currentTime = window.simulation.currentTimeMinutes;

        // Erstelle den Auftragsstatus
        window.simulation.auftraegeStatus[auftrag.auftrag_nr] = {
            currentStep: 0,
            arbeitsplaene: arbeitsplaene,
            completed: false,
            waiting: false,
            anzahl: auftrag.Anzahl || 1,
            enteredSystemTime: currentTime,
            waitingStartTime: currentTime, // Wartezeit beginnt sofort
            totalWaitingTime: 0,
            currentOperationStartTime: null,
            operationHistory: [],
            bufferEntryTime: null,
        };

        // Initialisiere Statistik für den Auftrag
        window.simulation.statistics.orderStatistics[auftrag.auftrag_nr] = {
            startTime: null,
            endTime: null,
            totalLeadTime: 0,
            operations: [],
            totalProcessingTime: 0,
            totalWaitingTime: 0,
            quantity: auftrag.Anzahl || 1,
            machinesUsed: [],
            operationHistory: [],
            enteredSystemTime: currentTime
        };

        console.log(`✅ Auftrag ${auftrag.auftrag_nr} mit ${arbeitsplaene.length} Operationen initialisiert`);
    }

    console.log(`✅ Insgesamt ${Object.keys(window.simulation.auftraegeStatus).length} Aufträge initialisiert`);
}

// Функция для получения рабочих планов для конкретного заказа
function getArbeitsplaeneFor(auftrag_nr) {
    return window.simulation.arbeitsplaene.filter(plan => plan.auftrag_nr === auftrag_nr);
}

// Тестовые данные на случай проблем с БД
function loadTestData() {

    window.simulation.maschinen = [
        {Nr: 1, Bezeichnung: "Maschine A", Kap_Tag: 8, verf_von: "2022-01-01", verf_bis: "2023-12-31"},
        {Nr: 2, Bezeichnung: "Maschine B", Kap_Tag: 6, verf_von: "2022-01-01", verf_bis: "2023-12-31"},
        {Nr: 3, Bezeichnung: "Maschine C", Kap_Tag: 10, verf_von: "2022-01-01", verf_bis: "2023-12-31"}
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
    addActivity("Testdaten wurden geladen");
}

function startSimulation() {
    if (window.simulation.isRunning) return;

    window.simulation.isRunning = true;
    window.simulation.startTime = Date.now();
    if (!window.simulation.statistics.systemStartTime) {
        window.simulation.statistics.systemStartTime = window.simulation.currentTimeMinutes;
    }

    // Создаем асинхронную функцию для цикла симуляции
    const runSimulationLoop = async () => {
        if (!window.simulation.isRunning) return;

        try {
            await simulationStep(); // Теперь можем использовать await
        } catch (error) {
            console.error('Ошибка в симуляции:', error);
        }

        // Планируем следующий шаг
        if (window.simulation.isRunning) {
            window.simulation.timer = setTimeout(runSimulationLoop, window.simulation.intervalMs);
        }
    };

    // Запускаем первый шаг
    runSimulationLoop();

    addActivity("Simulation gestartet");
    startAnimation();
}

function stopSimulation() {
    window.simulation.isRunning = false;
    if (window.simulation.timer) {
        clearTimeout(window.simulation.timer); // Теперь используем clearTimeout
        window.simulation.timer = null;
    }
    addActivity("Simulation gestoppt");
    stopAnimation();
}

async function resetSimulation() {
    console.log("🔄 Simulation zurücksetzen");
    stopSimulation();

    // Сброс состояния симуляции
    window.simulation.currentTimeMinutes = calculateDayFromDate('2022-01-02') * 24 * 60;

    window.simulation.activeTasks = [];
    window.simulation.auftraegeQueue = [];
    window.simulation.maschinenStatus = {};
    window.simulation.auftraegeStatus = {};
    window.simulation.recentActivities = [];
    window.simulation.startTime = null;
    window.simulation.statistics = {
        completedTasks: 0,
        totalProcessingTime: 0,
        machineUtilization: {},
        orderStatistics: {},
        machineIdleTime: {},
        bufferStatistics: {}, // ДОБАВИТЬ
        totalSimulationTime: 0,
        systemStartTime: null
    };

    // Перезагружаем данные
    await loadInitialData();
    console.log("🔄 Simulation zurücksetzen");
    // Обновляем отображение
    draw();
}

// Функция для получения текущей скорости симуляции
function getCurrentSimulationSpeed() {
    return window.simulation.simulationMinutesPerStep || 1;
}

function getCurrentDay() {
    return Math.floor(window.simulation.currentTimeMinutes / (24 * 60));
}

// Новая функция для преобразования дня симуляции в дату
function getCurrentDate() {
    const dayNumber = getCurrentDay();
    // Базовая дата - 1 января 2020 года (день 0)
    const baseDate = new Date('2022-01-02');
    const currentDate = new Date(baseDate);
    currentDate.setDate(baseDate.getDate() + dayNumber);
    return currentDate;
}

// Исправленная функция проверки доступности машины
function isMachineAvailable(machine) {
    const currentDate = getCurrentDate();

    let verfVon, verfBis;

    // Проверяем, в каком формате данные
    if (typeof machine.verf_von === 'number' && typeof machine.verf_bis === 'number') {
        verfVon = excelToDate(machine.verf_von);
        verfBis = excelToDate(machine.verf_bis);

    } else {
        // Если это строки
        verfVon = new Date(machine.verf_von);
        verfBis = new Date(machine.verf_bis);

        // Проверяем, корректно ли распарсились даты
        if (isNaN(verfVon.getTime()) || isNaN(verfBis.getTime())) {
            console.error(`❌ Ungültiges Datumsformat:`, machine.verf_von, machine.verf_bis);
            return false;
        }
    }

    // Сравниваем только даты (без времени)
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const verfVonOnly = new Date(verfVon.getFullYear(), verfVon.getMonth(), verfVon.getDate());
    const verfBisOnly = new Date(verfBis.getFullYear(), verfBis.getMonth(), verfBis.getDate());

    const isAvailable = currentDateOnly >= verfVonOnly && currentDateOnly <= verfBisOnly;

    return isAvailable;
}

function excelToDate(serial) {
    // Excel считает дни с 1 января 1900, но имеет ошибку с високосным годом
    // Поэтому используем 30 декабря 1899 как базовую дату
    const excelEpoch = new Date(1899, 11, 30); // 30 декабря 1899
    const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
    return date; // Возвращаем Date объект, а не строку
}

// Новая функция для получения текущего времени в дне (в минутах от начала дня)
function getCurrentTimeInDay() {
    return window.simulation.currentTimeMinutes % (24 * 60);
}

// Новая функция для проверки, работает ли машина в данное время
function isMachineWorkingTime(machine) {
    // Проверяем доступность машины по датам
    if (!isMachineAvailable(machine)) return false;

    // Проверяем, не выходной ли день (суббота = 6, воскресенье = 0)
    const currentDate = getCurrentDate();
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false; // Воскресенье или суббота - выходной
    }

    const timeInDay = getCurrentTimeInDay();
    const workingHours = machine.Kap_Tag * 60; // Переводим часы в минуты

    // Рабочий день начинается в 08:00 (480 минут от начала дня)
    const workStart = 8 * 60; // 08:00
    const workEnd = workStart + workingHours;

    const isWorkingTime = timeInDay >= workStart && timeInDay < workEnd;

    return isWorkingTime;
}

// Новая функция для проверки, работает ли машина в данное время с учетом доступности
function isMachineWorkingTimeAndAvailable(machine) {
    // Используем уже существующую функцию, которая проверяет все условия
    return isMachineWorkingTime(machine);
}

// Основные исправления для завершения симуляции

// 1. ИСПРАВЛЕННАЯ функция checkSimulationCompletion
function checkSimulationCompletion() {
    if (!window.simulation.isRunning) {
        return false;
    }

    const currentDay = getCurrentDay();
    const hasActiveTasks = window.simulation.activeTasks.length > 0;

    console.log(`🔍 Überprüfung des Simulationsendes (Tag ${currentDay}):`);
    console.log(`  - Aktive Aufgaben: ${window.simulation.activeTasks.length}`);


    // Получаем все заказы, которые уже должны были начаться
    const sortedOrders = window.simulation.auftraegeQueue
        .filter(auftrag => auftrag.Start && typeof auftrag.Start === 'number')
        .sort((a, b) => a.Start - b.Start);

// Определяем, сколько заказов нужно обработать (например, на основе текущего дня или другой логики)
    const ordersToProcess = Math.min(currentDay, sortedOrders.length); // или другая логика

// Получаем заказы, готовые к обработке
    const readyOrders = sortedOrders.slice(0, ordersToProcess);

    // Получаем незавершенные заказы из тех, что уже должны были начаться
    const incompleteReadyOrders = readyOrders.filter(auftrag => {
        const status = window.simulation.auftraegeStatus[auftrag.auftrag_nr];
        return status && !status.completed;
    });

    console.log(`  - Aufträge bereit zur Verarbeitung: ${readyOrders.length}`);
    console.log(`  - Nicht abgeschlossene, aber bereite Aufträge: ${incompleteReadyOrders.length}`);


    // Проверяем очереди машин на наличие готовых заказов
    let totalQueuedReadyOrders = 0;
    Object.values(window.simulation.maschinenStatus).forEach(machineStatus => {
        const queuedReadyOrders = machineStatus.queue.filter(queueItem => {
            const auftrag = window.simulation.auftraegeQueue.find(a => a.auftrag_nr === queueItem.auftrag_nr);
            if (!auftrag) return false;

            let startDay;
            if (typeof auftrag.Start === 'number') {
                startDay = auftrag.Start;
            } else if (typeof auftrag.Start === 'string') {
                startDay = calculateDayFromDate(auftrag.Start);
            }
            return startDay <= currentDay;
        });
        totalQueuedReadyOrders += queuedReadyOrders.length;
    });

    console.log(`  - Bereite Aufträge in den Maschinenwarteschlangen: ${totalQueuedReadyOrders}`);

    // Проверяем, есть ли заказы, которые еще не начались
    const futureOrders = window.simulation.auftraegeQueue.filter(auftrag => {
        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        }
        return startDay > currentDay;
    });

    console.log(`  - Aufträge in der Zukunft: ${futureOrders.length}`);

    // УСЛОВИЕ ЗАВЕРШЕНИЯ: нет активных задач, нет незавершенных готовых заказов, нет готовых заказов в очередях
    const shouldComplete = !hasActiveTasks &&
        incompleteReadyOrders.length === 0 &&
        totalQueuedReadyOrders === 0;

    if (shouldComplete) {
        if (futureOrders.length > 0) {
            // Есть заказы в будущем - переходим к следующему заказу
            const nextOrderStartDays = futureOrders.map(auftrag => {
                if (typeof auftrag.Start === 'number') {
                    return auftrag.Start;
                } else if (typeof auftrag.Start === 'string') {
                    return calculateDayFromDate(auftrag.Start);
                }
                return Infinity;
            }).filter(day => day !== Infinity);

            if (nextOrderStartDays.length > 0) {
                const nextOrderDay = Math.min(...nextOrderStartDays);
                const minutesToJump = (nextOrderDay - currentDay) * 24 * 60;

                console.log(`⏭️ Überspringe zu Tag ${nextOrderDay} (${minutesToJump} Minuten)`);
                window.simulation.currentTimeMinutes += minutesToJump;
                addActivity(`Wechsel zu Tag ${nextOrderDay}`);
                return false;
                // Продолжаем симуляцию
            }
        }

        // Все заказы завершены - НЕМЕДЛЕННО останавливаем
        const completedOrdersCount = Object.values(window.simulation.auftraegeStatus)
            .filter(status => status.completed).length;

        console.log("🎉 ALLE AUFTRÄGE ABGESCHLOSSEN! SIMULATION WIRD SOFORT GESTOPPT!");
        addActivity(`🎉 SIMULATION BEENDET! Verarbeitete Aufträge: ${completedOrdersCount}`);


        stopSimulation();
        return true; // Завершаем симуляцию
    }

    return false;
}

// 2. ИСПРАВЛЕННАЯ функция simulationStep с улучшенной логикой
// Простое исправление функции simulationStep
async function simulationStep() {
    console.log("🔄 === START DES SIMULATIONSSCHRITTS ===");
    console.log(`⏰ Aktuelle Zeit: ${window.simulation.currentTimeMinutes} Min (Tag ${getCurrentDay()})`);

    const totalSpeed = getCurrentSimulationSpeed();
    console.log(`🎯 Точно обрабатываем ${totalSpeed} минут (${(totalSpeed/1440).toFixed(2)} дней)`);

    // Определяем размер батча для асинхронной обработки
    let batchSize;
    if (totalSpeed <= 60) {
        batchSize = 10; // Маленькие батчи для медленных скоростей
    } else if (totalSpeed <= 1440) {
        batchSize = 60; // Средние батчи (1 час)
    } else if (totalSpeed <= 4320) {
        batchSize = 240; // Большие батчи (4 часа)
    } else {
        batchSize = 480; // Очень большие батчи (8 часов)
    }

    let remainingTime = totalSpeed;
    let processedTime = 0;
    const startProcessingTime = performance.now();

    // Обрабатываем ВСЕ время, разбивая на батчи с yield между ними
    while (remainingTime > 0) {
        const currentBatchSize = Math.min(remainingTime, batchSize);

        // Обрабатываем батч полностью
        await processBatch(currentBatchSize);

        processedTime += currentBatchSize;
        remainingTime -= currentBatchSize;

        console.log(`⚡ Обработан батч ${currentBatchSize} мин, осталось ${remainingTime} мин`);

        // Проверяем завершение симуляции
        const completed = checkSimulationCompletion();
        if (completed) {
            console.log("✅ Simulation beendet während Batch-Verarbeitung");
            draw();
            return;
        }

        // Yield контроль браузеру между батчами (только если есть еще время для обработки)
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    const processingTime = performance.now() - startProcessingTime;
    console.log(`✅ ТОЧНО обработано ${processedTime} минут за ${processingTime.toFixed(1)}мс`);

    draw();
    console.log("=== ENDE DES SIMULATIONSSCHRITTS ===\n");
}

// Функция для обработки одного батча синхронно
async function processBatch(batchTimeMinutes) {
    console.log(`📦 Обрабатываем батч ${batchTimeMinutes} минут`);

    // Определяем размер шага внутри батча
    const stepSize = batchTimeMinutes <= 60 ? 1 : (batchTimeMinutes <= 240 ? 5 : 15);
    let remainingBatchTime = batchTimeMinutes;

    while (remainingBatchTime > 0) {
        const currentStepSize = Math.min(remainingBatchTime, stepSize);

        // Вся логика симуляции для текущего шага
        updateMachineStatuses();
        processReadyOrders();
        startNewTasksWithTimeCheck();
        processActiveTasksWithTimeCheck(currentStepSize);
        cleanupCompletedOrders();
        updateMachineUtilization();

        // Обновляем время симуляции
        window.simulation.statistics.totalSimulationTime += currentStepSize;
        window.simulation.currentTimeMinutes += currentStepSize;
        remainingBatchTime -= currentStepSize;

        // Проверяем завершение симуляции внутри батча
        const completed = checkSimulationCompletion();
        if (completed) {
            return; // Возвращаемся, если симуляция завершена
        }
    }
}

// ИСПРАВЛЕННАЯ функция processActiveTasksWithTimeCheck с параметром stepSize
function processActiveTasksWithTimeCheck(stepSize = 1) {
    window.simulation.activeTasks = window.simulation.activeTasks.filter(task => {
        const machineData = window.simulation.maschinen.find(m => m.Nr == task.maschine);

        if (!machineData) {
            console.error(`❌ Maschine ${task.maschine} ist nicht gefunden!`);
            return false;
        }

        const canWork = isMachineWorkingTimeAndAvailable(machineData);

        if (!canWork) {
            if (!task.paused) {
                task.paused = true;
                task.pauseStartTime = window.simulation.currentTimeMinutes;
                console.log(`⏸️ Auftrag ${task.auftrag_nr} auf Maschine ${task.maschine} wurde pausiert`);
            }
            return true;
        } else {
            if (task.paused) {
                task.paused = false;
                const pauseDuration = window.simulation.currentTimeMinutes - (task.pauseStartTime || 0);
                task.pausedTotalTime = (task.pausedTotalTime || 0) + pauseDuration;
                console.log(`▶️ Auftrag ${task.auftrag_nr} wurde fortgesetzt (Pause: ${pauseDuration} Min)`);
            }
        }

        // Если задача на паузе, не обрабатываем её
        if (task.paused) {
            return true;
        }

        // ИСПРАВЛЕНИЕ: Используем переданный stepSize вместо фиксированного значения
        task.remaining -= stepSize;
        task.processedUnits = Math.floor((1 - task.remaining / task.totalDuration) * task.anzahl);

        if (task.remaining <= 0) {
            console.log(`✅ Aufgabe abgeschlossen: Auftrag ${task.auftrag_nr} auf Maschine ${task.maschine}`);

            // Остальная логика завершения задачи...
            const maschine = window.simulation.maschinenStatus[task.maschine];
            maschine.frei = true;
            maschine.hasUnfinishedTask = false;

            // Обновляем статистику
            const utilization = window.simulation.statistics.machineUtilization[task.maschine];
            if (utilization) {
                utilization.operationsCompleted++;
                utilization.totalPartsProcessed += task.anzahl;
            }

            const auftragStatus = window.simulation.auftraegeStatus[task.auftrag_nr];
            const orderStats = window.simulation.statistics.orderStatistics[task.auftrag_nr];

            if (auftragStatus && orderStats) {
                const operationRecord = {
                    operationNumber: auftragStatus.currentStep + 1,
                    machineId: task.maschine,
                    startTime: task.startTime,
                    endTime: window.simulation.currentTimeMinutes,
                    duration: task.totalDuration,
                    actualDuration: task.totalDuration + (task.pausedTotalTime || 0),
                    unitsProcessed: task.anzahl,
                    waitingTimeBefore: task.waitingTimeBefore || 0,
                    pausedTime: task.pausedTotalTime || 0
                };

                orderStats.operations.push(operationRecord);
                auftragStatus.operationHistory.push(operationRecord);
                auftragStatus.currentStep++;

                if (auftragStatus.currentStep >= auftragStatus.arbeitsplaene.length) {
                    auftragStatus.completed = true;
                    orderStats.endTime = window.simulation.currentTimeMinutes;
                    orderStats.totalLeadTime = orderStats.endTime - orderStats.enteredSystemTime;
                    orderStats.totalProcessingTime = orderStats.operations.reduce((sum, op) => sum + op.duration, 0);
                    orderStats.totalWaitingTime = orderStats.operations.reduce((sum, op) => sum + op.waitingTimeBefore, 0);

                    window.simulation.statistics.completedTasks++;
                    console.log(`🎉 Auftrag ${task.auftrag_nr} vollständig abgeschlossen!`);
                    addActivity(`Auftrag ${task.auftrag_nr} vollständig abgeschlossen`);
                } else {
                    auftragStatus.waitingStartTime = window.simulation.currentTimeMinutes;
                    console.log(`➡️ Auftrag ${task.auftrag_nr} переходит к операции ${auftragStatus.currentStep + 1}`);
                }
            }

            return false; // Удаляем завершенную задачу
        }
        return true; // Продолжаем обработку задачи
    });
}

// Новая функция startNewTasksWithTimeCheck с проверкой рабочего времени
function startNewTasksWithTimeCheck() {
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machineStatus = window.simulation.maschinenStatus[machineId];
        const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);
        console.log("gg")
        console.log(machineData)
        if (!machineData || machineStatus.queue.length === 0) {
            return;
        }

        // ИСПРАВЛЕНИЕ: Проверяем рабочее время ПЕРЕД запуском задачи
        const isWorkingTime = isMachineWorkingTimeAndAvailable(machineData);

        const canStart = machineStatus.canStartNewTask &&
            machineStatus.frei &&
            !machineStatus.hasUnfinishedTask &&
            isWorkingTime; // Добавляем проверку рабочего времени

        if (!canStart) {
            return;
        }
        console.log(canStart)

        const nextOrder = machineStatus.queue.shift();
        const totalDuration = nextOrder.anzahl * nextOrder.operation.dauer;
        const currentTime = window.simulation.currentTimeMinutes;

        // Записываем в буферную статистику
        updateBufferStatistics(machineId, nextOrder.auftrag_nr, 'start_processing', {
            queueWaitTime: currentTime - (nextOrder.queueEntryTime || currentTime),
            operationDuration: totalDuration
        });

        // Обновляем статус машины
        machineStatus.frei = false;
        machineStatus.hasUnfinishedTask = true;
        machineStatus.canStartNewTask = false;

        const auftragStatus = window.simulation.auftraegeStatus[nextOrder.auftrag_nr];
        const orderStats = window.simulation.statistics.orderStatistics[nextOrder.auftrag_nr];

        // Рассчитываем время ожидания
        let waitingTime = 0;
        if (auftragStatus.waitingStartTime) {
            waitingTime = currentTime - auftragStatus.waitingStartTime;
            auftragStatus.totalWaitingTime += waitingTime;
            auftragStatus.waitingStartTime = null;
        }

        auftragStatus.currentOperationStartTime = currentTime;

        if (orderStats.startTime === null) {
            orderStats.startTime = currentTime;
        }

        // Создаем активную задачу
        const newTask = {
            auftrag_nr: nextOrder.auftrag_nr,
            maschine: machineId,
            remaining: totalDuration,
            operation: auftragStatus.currentStep + 1,
            paused: false,
            anzahl: nextOrder.anzahl,
            dauerPerUnit: nextOrder.operation.dauer,
            processedUnits: 0,
            totalDuration: totalDuration,
            startTime: currentTime,
            waitingTimeBefore: waitingTime,
            pausedTotalTime: 0
        };

        window.simulation.activeTasks.push(newTask);

        if (!orderStats.machinesUsed.includes(machineId)) {
            orderStats.machinesUsed.push(machineId);
        }

        console.log(`🚀 AUFGABE GESTARTET: Auftrag ${nextOrder.auftrag_nr} auf Maschine ${machineId} um ${Math.floor(getCurrentTimeInDay() / 60)}:${String(getCurrentTimeInDay() % 60).padStart(2, '0')}`);
        addActivity(`Bearbeitung von Auftrag ${nextOrder.auftrag_nr} auf Maschine ${machineId} gestartet`);
    });
}


// 3. Вспомогательные функции для лучшей структуры кода
function updateMachineStatuses() {
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machineStatus = window.simulation.maschinenStatus[machineId];
        const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);

        if (machineData) {
            const isAvailable = isMachineAvailable(machineData);
            const isWorkingTime = isMachineWorkingTimeAndAvailable(machineData);
            const activeTask = window.simulation.activeTasks.find(task => task.maschine == machineId);
            const hasActiveTask = Boolean(activeTask);

            machineStatus.verfuegbar = isAvailable;
            machineStatus.hasUnfinishedTask = hasActiveTask;

            // ИСПРАВЛЕНИЕ: Корректная логика определения состояния машины
            if (hasActiveTask && !isWorkingTime) {
                // Есть задача, но не рабочее время - машина ждет
                machineStatus.waitingForWorkingTime = true;
                machineStatus.frei = false; // Машина занята (хотя и на паузе)
                machineStatus.canStartNewTask = false;
            } else if (hasActiveTask && isWorkingTime) {
                // Есть задача и рабочее время - машина работает
                machineStatus.waitingForWorkingTime = false;
                machineStatus.frei = false;
                machineStatus.canStartNewTask = false;
            } else if (!hasActiveTask && isWorkingTime && isAvailable) {
                // Нет задач, рабочее время, доступна - может начать новую задачу
                machineStatus.waitingForWorkingTime = false;
                machineStatus.frei = true;
                machineStatus.canStartNewTask = true;
            } else {
                // Все остальные случаи - не может начать новую задачу
                machineStatus.waitingForWorkingTime = false;
                machineStatus.frei = true;
                machineStatus.canStartNewTask = false;
            }
        }
    });
}

// Исправленная функция processActiveTasks с правильным сбором статистики

// Новая функция для записи в буферную статистику
function updateBufferStatistics(machineId, auftrag_nr, action, additionalData = {}) {
    const bufferStats = window.simulation.statistics.bufferStatistics[machineId];
    if (!bufferStats) return;

    const entry = {
        time: window.simulation.currentTimeMinutes,
        auftrag_nr: auftrag_nr,
        action: action, // 'enter_queue', 'start_processing', 'complete_processing'
        currentQueueLength: window.simulation.maschinenStatus[machineId]?.queue?.length || 0,
        ...additionalData
    };

    bufferStats.orderHistory.push(entry);
}


// Исправленная функция processReadyOrders с временными метками
function processReadyOrders() {
    const currentDay = getCurrentDay();
    const currentTime = window.simulation.currentTimeMinutes;

    for (const auftrag of window.simulation.auftraegeQueue) {
        const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];

        if (!auftragStatus || auftragStatus.completed) {
            continue;
        }

        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        } else {
            continue;
        }

        if (startDay > currentDay) {
            continue;
        }

        const hasActiveTask = window.simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
        if (hasActiveTask) {
            continue;
        }

        const currentOperation = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
        if (!currentOperation) {
            continue;
        }

        const machineId = currentOperation.maschine;
        const machineStatus = window.simulation.maschinenStatus[machineId];

        if (!machineStatus) {
            console.warn(`⚠️ Машина ${machineId} не найдена!`);
            continue;
        }

        const alreadyInQueue = machineStatus.queue.some(item => item.auftrag_nr === auftrag.auftrag_nr);
        if (!alreadyInQueue) {
            // ИСПРАВЛЕНИЕ: Добавляем временную метку входа в очередь
            const queueItem = {
                auftrag_nr: auftrag.auftrag_nr,
                operation: currentOperation,
                anzahl: auftrag.Anzahl || 1,
                queueEntryTime: currentTime // Новое поле
            };

            machineStatus.queue.push(queueItem);

            // ИСПРАВЛЕНИЕ: Записываем в буферную статистику
            updateBufferStatistics(machineId, auftrag.auftrag_nr, 'enter_queue', {
                operationNumber: auftragStatus.currentStep + 1,
                queuePosition: machineStatus.queue.length
            });

            console.log(`📝 Заказ ${auftrag.auftrag_nr} добавлен в очередь машины ${machineId}`);
        }
    }
}

function cleanupCompletedOrders() {
    // Удаляем завершенные заказы из основной очереди
    const initialQueueLength = window.simulation.auftraegeQueue.length;
    window.simulation.auftraegeQueue = window.simulation.auftraegeQueue.filter(auftrag => {
        const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];
        const isCompleted = auftragStatus && auftragStatus.completed;

        if (isCompleted) {
            console.log(`🗑️ Удаляем завершенный заказ ${auftrag.auftrag_nr} из очереди`);
        }

        return !isCompleted;
    });

    // Очищаем очереди машин от завершенных заказов
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machineStatus = window.simulation.maschinenStatus[machineId];
        machineStatus.queue = machineStatus.queue.filter(queueItem => {
            const auftragStatus = window.simulation.auftraegeStatus[queueItem.auftrag_nr];
            return auftragStatus && !auftragStatus.completed;
        });
    });
}

function debugDataLoading() {
    console.log("=== ДИАГНОСТИКА ДАННЫХ ===");

    // Проверяем загруженные данные
    console.log("📦 Заказы (auftraege):", window.simulation.auftraege);
    console.log("📋 Рабочие планы (arbeitsplaene):", window.simulation.arbeitsplaene);
    console.log("🏭 Машины (maschinen):", window.simulation.maschinen);

    // Проверяем отфильтрованные заказы
    console.log("📋 Заказы в очереди (auftraegeQueue):", window.simulation.auftraegeQueue);
    console.log("📊 Статусы заказов (auftraegeStatus):", window.simulation.auftraegeStatus);

    // Проверяем текущий день
    const currentDay = getCurrentDay();
    console.log("📅 Текущий день симуляции:", currentDay);
    console.log("📅 Текущая дата:", getCurrentDate().toISOString().split('T')[0]);

    // Проверяем каждый заказ индивидуально
    if (window.simulation.auftraege.length > 0) {
        console.log("🔍 Детальная проверка заказов:");
        window.simulation.auftraege.forEach(auftrag => {
            const shouldBeActive = auftrag.Start <= currentDay;
            const hasArbeitsplan = window.simulation.arbeitsplaene.some(
                plan => plan.auftrag_nr === auftrag.auftrag_nr
            );

            console.log(`  Заказ ${auftrag.auftrag_nr}:`);
            console.log(`    - Старт: ${auftrag.Start}, Текущий день: ${currentDay}`);
            console.log(`    - Должен быть активен: ${shouldBeActive}`);
            console.log(`    - Есть рабочий план: ${hasArbeitsplan}`);
            console.log(`    - Количество: ${auftrag.Anzahl}`);
        });
    }

    console.log("==============================");
}

function initMaschinen(maschinen) {
    console.log("🏭 Инициализация машин...");
    window.simulation.maschinenStatus = {};
    window.simulation.statistics.machineUtilization = {};

    for (const m of maschinen) {
        const isAvailable = isMachineAvailable(m);
        const isWorkingTime = isMachineWorkingTimeAndAvailable(m);

        // Для каждой машины создать буферную статистику

        window.simulation.maschinenStatus[m.Nr] = {
            frei: true, // Изначально все машины свободны
            kapTag: m.Kap_Tag,
            bezeichnung: m.Bezeichnung,
            verfuegbar: isAvailable,
            canStartNewTask: isWorkingTime && isAvailable,
            hasUnfinishedTask: false, // Есть ли незаконченная задача
            waitingForWorkingTime: false, // Ждет ли начала рабочего времени с незаконченной задачей
            queue: [] // Добавить очередь заказов для каждой машины
        };

        window.simulation.statistics.machineUtilization[m.Nr] = {
            totalTime: 0,
            workingTime: 0,
            availableTime: 0,
            utilization: 0,

            // НОВЫЕ ПОЛЯ
            idleTime: 0,
            unavailableTime: 0,
            operationsCompleted: 0,
            totalPartsProcessed: 0,
            utilizationHistory: []
        };

        window.simulation.statistics.bufferStatistics[m.Nr] = {
            orderHistory: [], // ЗАМЕНИТЬ все поля на это
        };
        const currentDate = getCurrentDate().toISOString().split('T')[0];
        const currentTime = `${Math.floor(getCurrentTimeInDay() / 60)}:${String(getCurrentTimeInDay() % 60).padStart(2, '0')}`;

        console.log(`🔧 Машина ${m.Nr} (${m.Bezeichnung}): доступна=${isAvailable}, рабочее время=${isWorkingTime}, дата=${currentDate}, время=${currentTime}`);
    }
}

function updateMachineUtilization() {
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machine = window.simulation.maschinenStatus[machineId];
        const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);
        const utilization = window.simulation.statistics.machineUtilization[machineId];

        if (utilization && machineData) {
            const isAvailable = isMachineAvailable(machineData);
            const isWorkingTimeAndAvailable = isMachineWorkingTimeAndAvailable(machineData);

            if (isWorkingTimeAndAvailable) {
                utilization.availableTime++;

                if (!machine.frei) {
                    utilization.workingTime++;
                } else {
                    // НОВОЕ: машина доступна, в рабочее время, но простаивает
                    utilization.idleTime++;
                }
            } else if (!isAvailable) {
                // НОВОЕ: машина недоступна по датам
                utilization.unavailableTime++;
            }

            utilization.totalTime++;

            // Обновленный расчет утилизации
            utilization.utilization = utilization.availableTime > 0 ?
                (utilization.workingTime / utilization.availableTime * 100).toFixed(1) : 0;

            // НОВОЕ: сохраняем историю загрузки (каждые 60 минут)
            if (window.simulation.currentTimeMinutes % 60 === 0) {
                utilization.utilizationHistory.push({
                    time: window.simulation.currentTimeMinutes,
                    utilization: parseFloat(utilization.utilization),
                    isWorking: !machine.frei && isWorkingTimeAndAvailable
                });
            }
        }
    });
}

// Инициализация при загрузке модуля
async function initialize() {
    await loadInitialData();
    debugDataLoading();
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
                window.simulation.simulationMinutesPerStep = value;

                let timeLabel;
                if (value < 60) {
                    timeLabel = `${value} Min`;
                } else if (value < 1440) {
                    timeLabel = `${Math.floor(value / 60)} Std`;
                } else {
                    timeLabel = `${Math.floor(value / 1440)} Tag`;
                }

                console.log(`⚙️ Simulationsgeschwindigkeit: ${timeLabel} pro Sekunde реального времени`);
            });

        }

        if (startBtn) startBtn.addEventListener("click", startSimulation);
        if (stopBtn) stopBtn.addEventListener("click", stopSimulation);
        if (resetBtn) resetBtn.addEventListener("click", resetSimulation);
    });
}

// НОВЫЕ ФУНКЦИИ ДЛЯ АНАЛИЗА СТАТИСТИКИ

function getMachineEfficiency(machineId) {
    const stats = window.simulation.statistics.machineUtilization[machineId];
    if (!stats) return null;

    return {
        utilization: parseFloat(stats.utilization),
        operationsCompleted: stats.operationsCompleted,
        totalPartsProcessed: stats.totalPartsProcessed,
        idleTime: stats.idleTime,
        workingTime: stats.workingTime,
        efficiency: stats.totalPartsProcessed / Math.max(1, stats.availableTime)
    };
}

function getAverageLeadTime() {
    const completedOrders = Object.values(window.simulation.statistics.orderStatistics)
        .filter(order => order.endTime !== null);

    if (completedOrders.length === 0) return 0;

    const totalLeadTime = completedOrders.reduce((sum, order) => sum + order.totalLeadTime, 0);
    return totalLeadTime / completedOrders.length;
}

function exportStatistics() {
    return {
        simulation: {
            totalTime: window.simulation.currentTimeMinutes,
            completedOrders: window.simulation.statistics.completedTasks,
            averageLeadTime: getAverageLeadTime()
        },
        orders: window.simulation.statistics.orderStatistics,
        machines: Object.keys(window.simulation.statistics.machineUtilization).map(id => ({
            id: parseInt(id),
            ...getMachineEfficiency(id)
        }))
    };
}

// Экспортируем функции для использования в других модулях
export {
    loadInitialData,
    getArbeitsplaeneFor,
    initialize,
    startSimulation,
    stopSimulation,
    resetSimulation,
    addActivity,
    getCurrentTimeInDay,
    isMachineWorkingTime,
    getCurrentDate,
    isMachineAvailable,
    isMachineWorkingTimeAndAvailable,
    checkSimulationCompletion,
    simulationStep,
    updateMachineStatuses,
    processReadyOrders,
    cleanupCompletedOrders,
    // НОВЫЕ ФУНКЦИИ СТАТИСТИКИ
    getMachineEfficiency,
    getAverageLeadTime,
    exportStatistics,
};

// Автоматическая инициализация при загрузке (если не в модульной среде)
if (typeof window !== 'undefined') {
    initialize().catch(console.error);
    window.isMachineAvailable = isMachineAvailable;
    window.isMachineWorkingTimeAndAvailable = isMachineWorkingTimeAndAvailable;
    window.isMachineWorkingTime = isMachineWorkingTime;
}