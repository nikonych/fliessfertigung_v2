// core/simulation.js
import {draw, startAnimation, stopAnimation} from "../ui/simulation/renderer.js";

function calculateDayFromDate(dateString) {
    const targetDate = new Date(dateString);
    const baseDate = new Date('2020-01-01');
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
        machineUtilization: {}
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
    window.simulation.auftraegeQueue = window.simulation.auftraege.filter(auftrag => {
        // Загружаем заказы, которые должны начаться до или в текущий день
        return auftrag.Start <= getCurrentDay();
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
            waiting: false, // Ждет ли заказ освобождения машины
            anzahl: auftrag.Anzahl || 1 // Количество товара для обработки
        };
    }
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
        machineUtilization: {}
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
    const baseDate = new Date('2020-01-01');
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
    // Сначала проверяем доступность машины по датам
    if (!isMachineAvailable(machine)) return false;

    // Затем проверяем рабочее время
    const timeInDay = getCurrentTimeInDay();
    const workingHours = machine.Kap_Tag * 60; // Переводим часы в минуты

    // Предполагаем, что рабочий день начинается в 08:00 (480 минут от начала дня)
    const workStart = 8 * 60; // 08:00
    const workEnd = workStart + workingHours;

    return timeInDay >= workStart && timeInDay < workEnd;
}

function simulationStep() {
    // Получаем скорость симуляции (сколько виртуальных минут за один шаг)
    const totalSpeed = getCurrentSimulationSpeed();

    // Разбиваем большие шаги на более мелкие, чтобы не пропускать рабочее время
    const maxStepSize = 60; // Максимум 1 час за один внутренний шаг
    let remainingTime = totalSpeed;

    while (remainingTime > 0) {
        // Определяем размер текущего шага
        const currentStepSize = Math.min(remainingTime, maxStepSize);

        // Увеличиваем виртуальное время на текущий шаг
        window.simulation.currentTimeMinutes += currentStepSize;
        remainingTime -= currentStepSize;

        const currentDate = getCurrentDate();
        debugMachineStatus();

        // Проверяем рабочее время для всех машин
        Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
            const machineStatus = window.simulation.maschinenStatus[machineId];
            const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);

            if (!machineData) {
                console.warn(`⚠️ Данные машины ${machineId} не найдены!`);
                return;
            }

            // Проверяем доступность машины по датам
            const isAvailable = isMachineAvailable(machineData);
            // Проверяем рабочее время
            const isWorkingTime = isMachineWorkingTime(machineData);

            // Проверяем, есть ли у машины активная задача
            const activeTask = window.simulation.activeTasks.find(task => task.maschine == machineId);
            const hasActiveTask = Boolean(activeTask);

            // Обновляем статус машины
            machineStatus.verfuegbar = isAvailable;
            machineStatus.hasUnfinishedTask = hasActiveTask;
            machineStatus.waitingForWorkingTime = hasActiveTask && isAvailable && !isWorkingTime;
            machineStatus.canStartNewTask = isAvailable && isWorkingTime && machineStatus.frei;

            // Логика приостановки/возобновления задач
            if ((!isWorkingTime || !isAvailable) && hasActiveTask) {
                if (!activeTask.paused) {
                    activeTask.paused = true;
                    const reason = !isAvailable ? 'машина недоступна' : 'конец рабочего дня';
                    addActivity(`Машина ${machineId} остановлена (${reason})`);
                    console.log(`⏸️ Машина ${machineId} приостановила работу: ${reason}`);
                }
            }
            // Если машина должна возобновить работу
            else if (isWorkingTime && isAvailable && hasActiveTask) {
                if (activeTask.paused) {
                    activeTask.paused = false;
                    addActivity(`Машина ${machineId} возобновила работу`);
                    console.log(`▶️ Машина ${machineId} возобновила работу`);
                }
            }
        });

        // Завершение активных задач
        window.simulation.activeTasks = window.simulation.activeTasks.filter(task => {
            const maschine = window.simulation.maschinenStatus[task.maschine];
            if (!maschine) {
                console.warn(`⚠️ Машина ${task.maschine} не найдена!`);
                return false;
            }

            // Если задача приостановлена (машина не работает), не уменьшаем время
            if (task.paused) {
                return true;
            }

            // Уменьшаем оставшееся время задачи на текущий размер шага
            task.remaining -= currentStepSize;

            // Рассчитываем количество обработанных штук на основе прогресса
            const progress = 1 - (task.remaining / task.totalDuration);
            task.processedUnits = Math.floor(progress * task.anzahl);

            console.log(`⏳ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} hat noch ${Math.max(0, task.remaining)}min übrig (${task.processedUnits}/${task.anzahl} шт.)`);

            if (task.remaining <= 0) {
                // Освобождаем машину
                maschine.frei = true;
                maschine.hasUnfinishedTask = false;
                maschine.waitingForWorkingTime = false;

                const machineData = window.simulation.maschinen.find(m => m.Nr == task.maschine);
                maschine.canStartNewTask = isMachineAvailable(machineData) && isMachineWorkingTime(machineData);

                console.log(`✅ Auftrag ${task.auftrag_nr} на Maschine ${task.maschine} abgeschlossen (${task.anzahl} шт. обработано)`);
                addActivity(`Операция заказа ${task.auftrag_nr} завершена на машине ${task.maschine} (${task.anzahl} шт.)`);

                // Обновляем состояние заказа - переходим к следующему шагу
                const auftragStatus = window.simulation.auftraegeStatus[task.auftrag_nr];
                if (auftragStatus) {
                    auftragStatus.currentStep++;
                    auftragStatus.waiting = false;

                    // Проверяем, завершен ли весь заказ
                    if (auftragStatus.currentStep >= auftragStatus.arbeitsplaene.length) {
                        auftragStatus.completed = true;
                        console.log(`🎉 Заказ ${task.auftrag_nr} полностью завершен! (${auftragStatus.anzahl} шт.)`);
                        addActivity(`Заказ ${task.auftrag_nr} полностью завершен (${auftragStatus.anzahl} шт.)`);
                        window.simulation.statistics.completedTasks++;
                    }
                }

                return false; // Удаляем выполненную задачу
            }
            return true;
        });

        // Проверяем, есть ли новые заказы для текущего дня
        const newAuftraege = window.simulation.auftraege.filter(auftrag =>
            auftrag.Start === getCurrentDay() &&
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
                    waiting: false,
                    anzahl: auftrag.Anzahl || 1
                };
            }

            console.log(`📥 Добавлено ${newAuftraege.length} новых заказов в очередь`);
            addActivity(`Добавлено ${newAuftraege.length} новых заказов`);
        }

        // Назначение новых задач
        for (const auftrag of window.simulation.auftraegeQueue) {
            const auftragStatus = window.simulation.auftraegeStatus[auftrag.auftrag_nr];

            if (!auftragStatus || auftragStatus.completed) continue;

            const hasActiveTask = window.simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
            if (hasActiveTask) continue;

            const currentOperation = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
            if (!currentOperation) continue;

            const machineId = currentOperation.maschine;
            const machineStatus = window.simulation.maschinenStatus[machineId];

            // Проверяем, есть ли заказ уже в очереди этой машины
            const alreadyInQueue = machineStatus.queue.some(item => item.auftrag_nr === auftrag.auftrag_nr);

            if (!alreadyInQueue) {
                // Добавляем в очередь машины
                machineStatus.queue.push({
                    auftrag_nr: auftrag.auftrag_nr,
                    operation: currentOperation,
                    anzahl: auftrag.Anzahl || 1
                });
                console.log(`📝 Заказ ${auftrag.auftrag_nr} добавлен в очередь машины ${machineId}`);
            }
        }

        // После логики добавления в очереди, обрабатываем очереди каждой машины
        Object.keys(window.simulation.maschinenStatus).forEach(machineId => {
            const machineStatus = window.simulation.maschinenStatus[machineId];
            const machineData = window.simulation.maschinen.find(m => m.Nr == machineId);

            // Если машина может начать новую задачу и в очереди есть заказы
            if (machineStatus.canStartNewTask && machineStatus.queue.length > 0) {
                const nextOrder = machineStatus.queue.shift(); // Берем первый из очереди (FIFO)

                // Запускаем задачу
                const totalDuration = nextOrder.anzahl * nextOrder.operation.dauer;

                machineStatus.frei = false;
                machineStatus.hasUnfinishedTask = true;
                machineStatus.canStartNewTask = false;

                window.simulation.activeTasks.push({
                    auftrag_nr: nextOrder.auftrag_nr,
                    maschine: machineId,
                    remaining: totalDuration,
                    operation: window.simulation.auftraegeStatus[nextOrder.auftrag_nr].currentStep + 1,
                    paused: false,
                    anzahl: nextOrder.anzahl,
                    dauerPerUnit: nextOrder.operation.dauer,
                    processedUnits: 0,
                    totalDuration: totalDuration
                });

                console.log(`🚀 Из очереди запущен заказ ${nextOrder.auftrag_nr} на машине ${machineId}`);
            }
        });

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
            break; // Выходим из цикла while
        }
    }

    console.log("Активные задачи:", window.simulation.activeTasks);
    console.log("Состояние заказов:", window.simulation.auftraegeStatus);

    draw();
}

function debugMachineStatus() {
    console.log("🔍 === ОТЛАДКА СОСТОЯНИЯ МАШИН ===");
    const currentTime = getCurrentTimeInDay();
    const currentHour = Math.floor(currentTime / 60);
    const currentMinute = currentTime % 60;

    console.log(`⏰ Текущее время в симуляции: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);

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
        const isWorkingTime = isAvailable && isMachineWorkingTime(m);

        window.simulation.maschinenStatus[m.Nr] = {
            frei: true, // Изначально все машины свободны
            kapTag: m.Kap_Tag,
            bezeichnung: m.Bezeichnung,
            verfuegbar: isAvailable,
            canStartNewTask: isWorkingTime,
            hasUnfinishedTask: false, // Есть ли незаконченная задача
            waitingForWorkingTime: false, // Ждет ли начала рабочего времени с незаконченной задачей
            queue: [] // Добавить очередь заказов для каждой машины
        };

        window.simulation.statistics.machineUtilization[m.Nr] = {
            totalTime: 0,
            workingTime: 0,
            availableTime: 0,
            utilization: 0
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
            const isWorkingTime = isMachineWorkingTimeAndAvailable(machineData);

            if (isWorkingTime) {
                utilization.availableTime++;

                if (!machine.frei) {
                    utilization.workingTime++;
                }
            }

            utilization.totalTime++;

            // Рассчитываем использование относительно доступного времени
            utilization.utilization = utilization.availableTime > 0 ?
                (utilization.workingTime / utilization.availableTime * 100).toFixed(1) : 0;
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
    isMachineWorkingTimeAndAvailable
};

// Автоматическая инициализация при загрузке (если не в модульной среде)
if (typeof window !== 'undefined') {
    initialize().catch(console.error);
    window.isMachineAvailable = isMachineAvailable;
    window.isMachineWorkingTimeAndAvailable = isMachineWorkingTimeAndAvailable;
    window.isMachineWorkingTime = isMachineWorkingTime;
}