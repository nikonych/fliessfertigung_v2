// core/simulation.js
import {draw, startAnimation, stopAnimation} from "../ui/simulation/renderer.js";

function calculateDayFromDate(dateString) {
    const targetDate = new Date(dateString);
    const baseDate = new Date('2022-01-01');
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}


window.simulation = {
    simulationMinutesPerStep: 1,
    isRunning: false,
    currentTimeMinutes: calculateDayFromDate('2022-01-01') * 24 * 60,
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

        console.log("📋 Проверка загруженных данных:");
        console.log(`- Заказов: ${window.simulation.auftraege.length}`);
        console.log(`- Машин: ${window.simulation.maschinen.length}`);
        console.log(`- Планов работ: ${window.simulation.arbeitsplaene.length}`);


        // Инициализация машин
        initMaschinen(window.simulation.maschinen);

        // Фильтрация заказов по текущему дню (загружаем только активные заказы)
        filterAndLoadActiveAuftraege();

        // Инициализация состояния заказов
        initAuftraegeStatus();

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
    console.log("🔍 Фильтрация активных заказов...");

    const currentDay = getCurrentDay();
    console.log(`📅 Текущий день симуляции: ${currentDay}`);

    const allOrders = window.simulation.auftraege || [];
    console.log(`📦 Всего заказов для проверки: ${allOrders.length}`);

    // ИСПРАВЛЕНИЕ: Увеличиваем окно загрузки заказов
    window.simulation.auftraegeQueue = allOrders.filter(auftrag => {
        if (!auftrag.auftrag_nr) {
            console.warn(`⚠️ Заказ без номера:`, auftrag);
            return false;
        }

        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        } else {
            console.warn(`⚠️ Неправильный формат даты старта для заказа ${auftrag.auftrag_nr}:`, auftrag.Start);
            return false;
        }

        const hasWorkPlan = window.simulation.arbeitsplaene.some(
            plan => plan.auftrag_nr === auftrag.auftrag_nr
        );

        if (!hasWorkPlan) {
            console.warn(`⚠️ Нет рабочего плана для заказа ${auftrag.auftrag_nr}`);
            return false;
        }

        // ИСПРАВЛЕНИЕ: Загружаем ВСЕ заказы, не только те что должны стартовать в ближайшие 7 дней
        // Заказы будут обрабатываться когда придет их время
        const shouldBeLoaded = true; // Загружаем все заказы

        console.log(`  📋 Заказ ${auftrag.auftrag_nr}: старт=${startDay}, загружен=${shouldBeLoaded}`);

        return shouldBeLoaded;
    });

    console.log(`✅ Загружено заказов: ${window.simulation.auftraegeQueue.length}`);
}

// Новая функция для инициализации состояния заказов
function initAuftraegeStatus() {
    console.log("🔄 Инициализация статусов заказов...");

    window.simulation.auftraegeStatus = {};

    if (!window.simulation.auftraegeQueue || window.simulation.auftraegeQueue.length === 0) {
        console.warn("⚠️ Нет заказов в очереди для инициализации!");
        return;
    }

    for (const auftrag of window.simulation.auftraegeQueue) {
        // Получаем рабочие планы для заказа
        const arbeitsplaene = getArbeitsplaeneFor(auftrag.auftrag_nr)
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));

        if (arbeitsplaene.length === 0) {
            console.warn(`⚠️ Нет рабочих планов для заказа ${auftrag.auftrag_nr}`);
            continue;
        }

        const currentTime = window.simulation.currentTimeMinutes;

        // Создаем статус заказа
        window.simulation.auftraegeStatus[auftrag.auftrag_nr] = {
            currentStep: 0,
            arbeitsplaene: arbeitsplaene,
            completed: false,
            waiting: false,
            anzahl: auftrag.Anzahl || 1,
            enteredSystemTime: currentTime,
            waitingStartTime: currentTime, // Начинаем ожидание сразу
            totalWaitingTime: 0,
            currentOperationStartTime: null,
            operationHistory: [],
            bufferEntryTime: null,
        };

        // Инициализируем статистику заказа
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

        console.log(`✅ Инициализирован заказ ${auftrag.auftrag_nr} с ${arbeitsplaene.length} операциями`);
    }

    console.log(`✅ Инициализировано ${Object.keys(window.simulation.auftraegeStatus).length} заказов`);
}

// Функция для получения рабочих планов для конкретного заказа
function getArbeitsplaeneFor(auftrag_nr) {
    return window.simulation.arbeitsplaene.filter(plan => plan.auftrag_nr === auftrag_nr);
}

function calculateOperationDuration(auftrag, arbeitsplan) {
    const anzahl = auftrag.Anzahl || 1; // Количество товара
    const dauerPerUnit = arbeitsplan.dauer || 0; // Время на единицу товара в минутах
    const totalDauer = anzahl * dauerPerUnit; // Общее время операции

    console.log(`📊 Расчет времени для заказа ${auftrag.auftrag_nr}: ${anzahl} шт × ${dauerPerUnit} мин = ${totalDauer} мин`);

    return totalDauer;
}

// Тестовые данные на случай проблем с БД
function loadTestData() {

    window.simulation.maschinen = [
        {Nr: 1, Bezeichnung: "Станок А", Kap_Tag: 8, verf_von: "2022-01-01", verf_bis: "2023-12-31"},
        {Nr: 2, Bezeichnung: "Станок Б", Kap_Tag: 6, verf_von: "2022-01-01", verf_bis: "2023-12-31"},
        {Nr: 3, Bezeichnung: "Станок В", Kap_Tag: 10, verf_von: "2022-01-01", verf_bis: "2023-12-31"}
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
    if (window.simulation.isRunning) return;

    window.simulation.isRunning = true;
    window.simulation.startTime = Date.now();
    if (!window.simulation.statistics.systemStartTime) {
        window.simulation.statistics.systemStartTime = window.simulation.currentTimeMinutes;
    }
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
    window.simulation.currentTimeMinutes = calculateDayFromDate('2022-01-01') * 24 * 60;

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
    addActivity("Симуляция сброшена");

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
    const baseDate = new Date('2022-01-01');
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
            console.error(`❌ Неправильный формат дат:`, machine.verf_von, machine.verf_bis);
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

    console.log(`🔍 Проверка завершения симуляции (день ${currentDay}):`);
    console.log(`  - Активных задач: ${window.simulation.activeTasks.length}`);

    // Получаем все заказы, которые уже должны были начаться
    const readyOrders = window.simulation.auftraegeQueue.filter(auftrag => {
        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        } else {
            return false;
        }
        return startDay <= currentDay;
    });

    // Получаем незавершенные заказы из тех, что уже должны были начаться
    const incompleteReadyOrders = readyOrders.filter(auftrag => {
        const status = window.simulation.auftraegeStatus[auftrag.auftrag_nr];
        return status && !status.completed;
    });

    console.log(`  - Заказов готовых к обработке: ${readyOrders.length}`);
    console.log(`  - Незавершенных готовых заказов: ${incompleteReadyOrders.length}`);

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

    console.log(`  - Готовых заказов в очередях машин: ${totalQueuedReadyOrders}`);

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

    console.log(`  - Заказов в будущем: ${futureOrders.length}`);

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

                console.log(`⏭️ Перепрыгиваем на день ${nextOrderDay} (${minutesToJump} минут)`);
                window.simulation.currentTimeMinutes += minutesToJump;
                addActivity(`Переход ко дню ${nextOrderDay}`);
                return false; // Продолжаем симуляцию
            }
        }

        // Все заказы завершены - НЕМЕДЛЕННО останавливаем
        const completedOrdersCount = Object.values(window.simulation.auftraegeStatus)
            .filter(status => status.completed).length;

        console.log("🎉 ВСЕ ЗАКАЗЫ ЗАВЕРШЕНЫ! ОСТАНАВЛИВАЕМ СИМУЛЯЦИЮ НЕМЕДЛЕННО!");
        addActivity(`🎉 СИМУЛЯЦИЯ ЗАВЕРШЕНА! Обработано заказов: ${completedOrdersCount}`);

        stopSimulation();
        return true; // Завершаем симуляцию
    }

    return false;
}

// 2. ИСПРАВЛЕННАЯ функция simulationStep с улучшенной логикой
function simulationStep() {
    console.log("🔄 === НАЧАЛО ШАГА СИМУЛЯЦИИ ===");
    console.log(`⏰ Текущее время: ${window.simulation.currentTimeMinutes} мин (день ${getCurrentDay()})`);

    const totalSpeed = getCurrentSimulationSpeed();
    const maxStepSize = 60;
    let remainingTime = totalSpeed;

    while (remainingTime > 0) {
        const currentStepSize = Math.min(remainingTime, maxStepSize);
        window.simulation.statistics.totalSimulationTime += currentStepSize;
        window.simulation.currentTimeMinutes += currentStepSize;
        remainingTime -= currentStepSize;

        // Обновляем статус машин
        updateMachineStatuses();

        // Добавляем готовые заказы в очереди машин
        processReadyOrders();

        // Запускаем задачи с машин
        startNewTasks();

        // Обрабатываем активные задачи
        processActiveTasks();

        // Очищаем завершенные заказы
        cleanupCompletedOrders();

        updateMachineUtilization();

        // *** ДОБАВЛЯЕМ ПРОВЕРКУ ЗАВЕРШЕНИЯ ВНУТРИ ЦИКЛА ***
        // Проверяем завершение симуляции после каждого мини-шага
        const completed = checkSimulationCompletion();
        if (completed) {
            console.log("✅ Симуляция завершена внутри шага, прерываем обработку");
            return; // Выходим из функции немедленно
        }
    }

    // Если дошли до конца без завершения - обновляем отображение
    draw();

    console.log("=== КОНЕЦ ШАГА СИМУЛЯЦИИ ===\n");
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

function processReadyOrders() {
    const currentDay = getCurrentDay();

    for (const auftrag of window.simulation.auftraegeQueue) {
        const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];

        // Пропускаем завершенные заказы
        if (!auftragStatus || auftragStatus.completed) {
            continue;
        }

        // Проверяем, пришло ли время для начала заказа
        let startDay;
        if (typeof auftrag.Start === 'number') {
            startDay = auftrag.Start;
        } else if (typeof auftrag.Start === 'string') {
            startDay = calculateDayFromDate(auftrag.Start);
        } else {
            continue;
        }

        if (startDay > currentDay) {
            continue; // Заказ еще не готов
        }

        // Пропускаем заказы с активными задачами
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

        // Добавляем в очередь если еще не там
        const alreadyInQueue = machineStatus.queue.some(item => item.auftrag_nr === auftrag.auftrag_nr);
        if (!alreadyInQueue) {
            machineStatus.queue.push({
                auftrag_nr: auftrag.auftrag_nr,
                operation: currentOperation,
                anzahl: auftrag.Anzahl || 1
            });
            console.log(`📝 Заказ ${auftrag.auftrag_nr} добавлен в очередь машины ${machineId}`);
        }
    }
}

function startNewTasks() {
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const machineStatus = window.simulation.maschinenStatus[machineId];

        if (machineStatus.queue.length === 0) {
            return;
        }

        const canStart = machineStatus.canStartNewTask &&
            machineStatus.frei &&
            !machineStatus.hasUnfinishedTask;

        if (!canStart) {
            return;
        }

        const nextOrder = machineStatus.queue.shift();
        const totalDuration = nextOrder.anzahl * nextOrder.operation.dauer;
        const currentTime = window.simulation.currentTimeMinutes;

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

        console.log(`🚀 ЗАДАЧА ЗАПУЩЕНА: Заказ ${nextOrder.auftrag_nr} на машине ${machineId}, длительность: ${totalDuration} мин`);
        addActivity(`Запущена обработка заказа ${nextOrder.auftrag_nr} на машине ${machineId}`);
    });
}

function processActiveTasks() {
    window.simulation.activeTasks = window.simulation.activeTasks.filter(task => {
        const machineData = window.simulation.maschinen.find(m => m.Nr == task.maschine);

        if (!machineData) {
            console.error(`❌ Машина ${task.maschine} не найдена!`);
            return false; // Удаляем задачу с несуществующей машиной
        }

        // ИСПРАВЛЕНИЕ: Проверяем, может ли машина работать сейчас
        const canWork = isMachineWorkingTimeAndAvailable(machineData);

        if (!canWork) {
            // Машина не может работать - ставим задачу на паузу
            if (!task.paused) {
                task.paused = true;
                task.pauseStartTime = window.simulation.currentTimeMinutes;
                console.log(`⏸️ Задача ${task.auftrag_nr} на машине ${task.maschine} поставлена на паузу (нерабочее время)`);
            }
            return true; // Сохраняем задачу, но не обрабатываем
        } else {
            // Машина может работать - снимаем с паузы если нужно
            if (task.paused) {
                task.paused = false;
                const pauseDuration = window.simulation.currentTimeMinutes - (task.pauseStartTime || 0);
                task.pausedTotalTime = (task.pausedTotalTime || 0) + pauseDuration;
                console.log(`▶️ Задача ${task.auftrag_nr} на машине ${task.maschine} снята с паузы (продолжительность паузы: ${pauseDuration} мин)`);
            }
        }

        // ИСПРАВЛЕНИЕ: Обрабатываем только НЕ приостановленные задачи
        if (task.paused) {
            return true; // Сохраняем, но не обрабатываем
        }

        const currentStepSize = Math.min(window.simulation.simulationMinutesPerStep, 60);
        task.remaining -= currentStepSize;
        task.processedUnits = Math.floor((1 - task.remaining / task.totalDuration) * task.anzahl);

        if (task.remaining <= 0) {
            console.log(`✅ Задача завершена: ${task.auftrag_nr} на машине ${task.maschine}`);

            // Освобождаем машину
            const maschine = window.simulation.maschinenStatus[task.maschine];
            maschine.frei = true;
            maschine.hasUnfinishedTask = false;

            // Обновляем статус заказа
            const auftragStatus = window.simulation.auftraegeStatus[task.auftrag_nr];
            const orderStats = window.simulation.statistics.orderStatistics[task.auftrag_nr];

            if (auftragStatus) {
                auftragStatus.currentStep++;

                if (auftragStatus.currentStep >= auftragStatus.arbeitsplaene.length) {
                    // Заказ полностью завершен
                    auftragStatus.completed = true;

                    // Обновляем статистику заказа
                    if (orderStats) {
                        orderStats.endTime = window.simulation.currentTimeMinutes;
                        orderStats.totalLeadTime = orderStats.endTime - orderStats.enteredSystemTime;
                        orderStats.totalProcessingTime += task.totalDuration;
                        orderStats.totalWaitingTime = auftragStatus.totalWaitingTime;
                    }

                    window.simulation.statistics.completedTasks++;
                    console.log(`🎉 Заказ ${task.auftrag_nr} полностью завершен!`);
                    addActivity(`Заказ ${task.auftrag_nr} завершен полностью`);
                } else {
                    // Переходим к следующей операции
                    auftragStatus.waitingStartTime = window.simulation.currentTimeMinutes;
                    console.log(`➡️ Заказ ${task.auftrag_nr} переходит к операции ${auftragStatus.currentStep + 1}`);
                }
            }

            return false; // Удаляем завершенную задачу
        }
        return true;
    });
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

// 4. Дополнительная функция диагностики для отладки
function debugSimulationState() {
    console.log("🔍 === ДИАГНОСТИКА СОСТОЯНИЯ СИМУЛЯЦИИ ===");

    const currentDay = getCurrentDay();
    console.log(`📅 Текущий день: ${currentDay}`);
    console.log(`⚡ Активных задач: ${window.simulation.activeTasks.length}`);
    console.log(`📦 Заказов в очереди: ${window.simulation.auftraegeQueue.length}`);

    // Анализ заказов по статусу
    const ordersByStatus = {
        notStarted: 0,
        inProgress: 0,
        completed: 0
    };

    Object.keys(window.simulation.auftraegeStatus).forEach(auftragNr => {
        const status = window.simulation.auftraegeStatus[auftragNr];
        const auftrag = window.simulation.auftraegeQueue.find(a => a.auftrag_nr === auftragNr);

        if (status.completed) {
            ordersByStatus.completed++;
        } else if (auftrag) {
            let startDay;
            if (typeof auftrag.Start === 'number') {
                startDay = auftrag.Start;
            } else if (typeof auftrag.Start === 'string') {
                startDay = calculateDayFromDate(auftrag.Start);
            }

            if (startDay <= currentDay) {
                ordersByStatus.inProgress++;
            } else {
                ordersByStatus.notStarted++;
            }
        }
    });

    console.log(`📊 Статус заказов:`, ordersByStatus);

    // Анализ очередей машин
    let totalQueued = 0;
    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const queueLength = window.simulation.maschinenStatus[machineId].queue.length;
        totalQueued += queueLength;
        if (queueLength > 0) {
            console.log(`🏭 Машина ${machineId}: ${queueLength} заказов в очереди`);
        }
    });

    console.log(`📋 Всего заказов в очередях машин: ${totalQueued}`);
    console.log("===============================================");
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


function debugMachineStatus() {
    console.log("🔍 === ОТЛАДКА СОСТОЯНИЯ МАШИН ===");
    const currentTime = getCurrentTimeInDay();
    const currentHour = Math.floor(currentTime / 60);
    const currentMinute = currentTime % 60;

    console.log(`⏰ Текущее время в симуляции: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
    const currentDate = getCurrentDate();
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    console.log(`📅 День недели: ${dayNames[dayOfWeek]} ${isWeekend ? '(ВЫХОДНОЙ)' : '(рабочий)'}`)


    Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
        const status = window.simulation.maschinenStatus[machineId];
        const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);

        if (machineData) {
            const isAvailable = isMachineAvailable(machineData);
            const isWorkingTime = isMachineWorkingTime(machineData);
            const workStart = 8;
            const workEnd = 8 + machineData.Kap_Tag;

            console.log(`  Машина ${machineId}:`);
            console.log(`    - Рабочие часы: ${workStart}:00 - ${workEnd}:00`);
            console.log(`    - Доступна по датам: ${isAvailable}`);
            console.log(`    - В рабочее время: ${isWorkingTime}`);
            console.log(`    - Свободна: ${status.frei}`);
            console.log(`    - Может начать задачу: ${status.canStartNewTask}`);
        }
    });
    console.log("=================================");
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

function getOrderStatistics(auftrag_nr) {
    return window.simulation.statistics.orderStatistics[auftrag_nr];
}

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

function logDetailedStatistics() {
    console.log("📊 === ДЕТАЛЬНАЯ СТАТИСТИКА ===");
    console.log("Заказы:", window.simulation.statistics.orderStatistics);
    console.log("Машины:", window.simulation.statistics.machineUtilization);
    console.log("Экспорт:", exportStatistics());
    console.log("================================");
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
    debugSimulationState,
    updateMachineStatuses,
    processReadyOrders,
    startNewTasks,
    processActiveTasks,
    cleanupCompletedOrders,
    // НОВЫЕ ФУНКЦИИ СТАТИСТИКИ
    getOrderStatistics,
    getMachineEfficiency,
    getAverageLeadTime,
    exportStatistics,
    logDetailedStatistics
};

// Автоматическая инициализация при загрузке (если не в модульной среде)
if (typeof window !== 'undefined') {
    initialize().catch(console.error);
    window.isMachineAvailable = isMachineAvailable;
    window.isMachineWorkingTimeAndAvailable = isMachineWorkingTimeAndAvailable;
    window.isMachineWorkingTime = isMachineWorkingTime;
}