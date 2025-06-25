// ui/simulation/renderer.js
let canvas, ctx;
let animationId;

// Colors and styling
const COLORS = {
    background: '#f5f5f5',
    machine: {
        free: '#4CAF50',           // Зеленый - свободна
        busy: '#2196F3',           // Синий - выполняет заказ
        nonWorking: '#9E9E9E',     // Серый - нерабочее время
        waitingForWorkTime: '#FF9800', // Оранжевый - ждет рабочего времени с заказом
        unavailable: '#F44336',    // Красный - недоступна по датам
        unknown: '#795548',         // Коричневый - неопределенный статус
        idle: '#87CEEB'
    },
    task: {
        waiting: '#f39c12',
        active: '#3498db',
        completed: '#27ae60',
        queued: '#e67e22'
    },
    text: {
        primary: '#2c3e50',
        secondary: '#7f8c8d',
        white: '#ffffff'
    },
    ui: {
        panel: '#ffffff',
        border: '#bdc3c7',
        shadow: 'rgba(0,0,0,0.1)',
        dragHandle: '#3498db',
        dragHandleHover: '#2980b9'
    }
};

// Layout constants
const LAYOUT = {
    machineSize: 150,
    machineSpacing: 20,
    topPadding: 80,
    leftPadding: 50,
    rightPadding: 50,
    bottomPadding: 50,
    taskHeight: 30,
    queueItemHeight: 30,
    queueItemWidth: 100,
    queueItemSpacing: 5,
    dragHandleHeight: 25
};

// Dragging state
let isDragging = false;
let dragTarget = null;
let dragOffset = {x: 0, y: 0};
let lastMousePos = {x: 0, y: 0};

// Panel positions (можно сохранять в localStorage если нужно)
let panelPositions = {
    statistics: {x: 800, y: 200},
    activeTasksOverview: {x: 100, y: 200},
    queue: {x: 500, y: 200}
};

function loadPanelPositions() {
    const saved = localStorage.getItem('panelPositions');
    if (saved) {
        try {
            panelPositions = {...panelPositions, ...JSON.parse(saved)};
        } catch (e) {
            console.warn('Failed to load panel positions:', e);
        }
    }
}

function savePanelPositions() {
    try {
        localStorage.setItem('panelPositions', JSON.stringify(panelPositions));
    } catch (e) {
        console.warn('Failed to save panel positions:', e);
    }
}

function getCurrentDay() {
    return Math.floor(window.simulation.currentTimeMinutes / (24 * 60));
}

export function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add mouse event listeners for dragging
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    console.log('Canvas initialized with dragging support');
    loadPanelPositions();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Mouse event handlers for dragging
function handleMouseDown(event) {

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to canvas coordinates considering transform
    const canvasPos = screenToCanvas(mouseX, mouseY);

    // Check if clicking on any panel drag handle
    const clickedPanel = getPanelAtPosition(canvasPos.x, canvasPos.y);

    if (clickedPanel) {
        window.isPanelDragging = true;
        isDragging = true;
        dragTarget = clickedPanel.type;
        dragOffset.x = canvasPos.x - clickedPanel.x;
        dragOffset.y = canvasPos.y - clickedPanel.y;
        lastMousePos = {x: mouseX, y: mouseY};
        canvas.style.cursor = 'grabbing';
    }
}

function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isDragging && dragTarget) {
        const canvasPos = screenToCanvas(mouseX, mouseY);

        // Update panel position
        panelPositions[dragTarget].x = canvasPos.x - dragOffset.x;
        panelPositions[dragTarget].y = canvasPos.y - dragOffset.y;

        // Constrain to canvas bounds
        constrainPanelPosition(dragTarget);
        savePanelPositions();

        // Redraw if not in animation loop
        if (!window.simulation?.isRunning) {
            draw();
        }
    } else {
        // Update cursor based on hover
        const canvasPos = screenToCanvas(mouseX, mouseY);
        const hoveredPanel = getPanelAtPosition(canvasPos.x, canvasPos.y);
        canvas.style.cursor = hoveredPanel ? 'grab' : 'default';
    }

    lastMousePos = {x: mouseX, y: mouseY};
}

function handleMouseUp() {
    window.isPanelDragging = false;
    isDragging = false;
    dragTarget = null;
    canvas.style.cursor = 'default';
}

// Helper function to convert screen coordinates to canvas coordinates
function screenToCanvas(screenX, screenY) {
    const transform = window.getCanvasTransform?.();
    const scale = transform?.scale || 1;
    const offset = transform?.offset || {x: 0, y: 0};

    return {
        x: (screenX - offset.x) / scale,
        y: (screenY - offset.y) / scale
    };
}


// Check if mouse position is over any panel drag handle
function getPanelAtPosition(x, y) {
    const panels = [
        {
            type: 'statistics',
            x: panelPositions.statistics.x,
            y: panelPositions.statistics.y,
            width: 280,
            height: 400
        },
        {
            type: 'activeTasksOverview',
            x: panelPositions.activeTasksOverview.x,
            y: panelPositions.activeTasksOverview.y,
            width: 300,
            height: Math.min(300, 40 + (window.simulation?.activeTasks?.length || 0) * LAYOUT.taskHeight)
        },
        {
            type: 'queue',
            x: panelPositions.queue.x,
            y: panelPositions.queue.y,
            width: 250,
            height: Math.min(400, 40 + (window.simulation?.auftraegeQueue?.length || 0) * LAYOUT.queueItemHeight)
        }
    ];

    for (const panel of panels) {
        // Check if click is within drag handle area (top part of panel)
        if (x >= panel.x && x <= panel.x + panel.width &&
            y >= panel.y && y <= panel.y + LAYOUT.dragHandleHeight) {
            return panel;
        }
    }

    return null;
}

// Constrain panel position to stay within canvas bounds
function constrainPanelPosition(panelType) {
    return;
}


export function draw() {
    if (!canvas || !ctx) {
        console.warn('Canvas not initialized');
        return;
    }

    // Get simulation data from global scope
    const simulation = window.simulation;
    if (!simulation) {
        console.warn('Simulation not available');
        return;
    }

    // Clear entire canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw fixed UI elements (not affected by pan/zoom)
    drawHeader(simulation);

    // Apply transformations for pannable content
    if (window.transformCanvas) {
        window.transformCanvas();
    }

    // Draw transformable content
    drawTransformableContent(simulation);

    // Restore canvas state
    if (window.restoreCanvas) {
        window.restoreCanvas();
    }

    // Continue animation loop
    if (simulation.isRunning) {
        animationId = requestAnimationFrame(draw);
    }
}

function drawTransformableContent(simulation) {
    // Draw background for transformable area
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(-10000, -10000, 20000, 20000); // Large background for panning

    // Draw machines with their queues
    drawMachinesWithQueues(simulation);

    // Draw movable panels
    drawMovableInfoPanel(simulation);
    drawMovableActiveTasksOverview(simulation);
    drawMovableQueue(simulation);
}

function drawHeader(simulation) {
    const headerHeight = 60;

    // Header background
    ctx.fillStyle = COLORS.ui.panel;
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // Header border
    ctx.strokeStyle = COLORS.ui.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvas.width, headerHeight);
    ctx.stroke();

    // Title
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = 'bold 24px Arial';
    ctx.fillText('🏭 AIN-1-21', 150, 35);

    // Current day
    ctx.font = '16px Arial';
    ctx.fillText(`Tag: ${getCurrentDay()}`, canvas.width - 400, 25);

    // Status
    const status = simulation.isRunning ? '▶️ Läuft' : '⏸️ Gestoppt';
    ctx.fillText(status, canvas.width - 400, 45);
}

function drawDragHandle(x, y, width, title, isHovered = false) {
    // Drag handle background
    ctx.fillStyle = isHovered ? COLORS.ui.dragHandleHover : COLORS.ui.dragHandle;
    ctx.fillRect(x, y, width, LAYOUT.dragHandleHeight);

    // Drag handle border
    ctx.strokeStyle = COLORS.machine.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, LAYOUT.dragHandleHeight);

    // Drag handle text
    ctx.fillStyle = COLORS.text.white;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 10, y + 17);

    // Drag indicator dots
    ctx.fillStyle = COLORS.text.white;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.arc(x + width - 25 + i * 4, y + 8 + j * 4, 1, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    ctx.textAlign = 'left'; // Reset text alignment
}

function drawMachinesWithQueues(simulation) {
    const machines = Object.entries(simulation.maschinenStatus);
    if (machines.length === 0) return;

    const startY = LAYOUT.topPadding;
    const cols = Math.floor((canvas.width - LAYOUT.leftPadding - LAYOUT.rightPadding) / (LAYOUT.machineSize + LAYOUT.machineSpacing));

    machines.forEach(([machineNr, status], index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = LAYOUT.leftPadding + col * (LAYOUT.machineSize + LAYOUT.machineSpacing);
        // Увеличиваем вертикальное пространство для одноколоночной очереди
        const y = startY + row * (LAYOUT.machineSize + LAYOUT.machineSpacing * 2 + 200);

        drawMachineWithQueue(x, y, machineNr, status, simulation);
    });
}

function drawMachineWithQueue(x, y, machineNr, status, simulation) {
    const size = LAYOUT.machineSize;

    // Draw machine
    drawMachine(x, y, machineNr, status, simulation.activeTasks);

    // Draw machine queue below
    drawMachineQueue(x, y + size * 0.7 + 60, machineNr, simulation);
}

function drawMachine(x, y, machineNr, status, activeTasks) {
    const size = LAYOUT.machineSize;
    const machineObj = simulation.maschinen?.find(m => m.Nr == machineNr);

    // Получаем дополнительную информацию для точного определения статуса
    const isAvailable = machineObj ? window.isMachineAvailable(machineObj) : false;
    const isWorkingTime = machineObj ? window.isMachineWorkingTime(machineObj) : false;

    let fillColor, statusText, accentColor;

    if (!status.verfuegbar) {
        fillColor = COLORS.machine.unavailable;
        accentColor = '#8B0000'; // Темно-красный акцент
        statusText = 'Nicht verfügbar';
    } else if (status.hasUnfinishedTask && status.waitingForWorkingTime) {
        fillColor = COLORS.machine.waitingForWorkTime;
        accentColor = '#FF8C00'; // Оранжевый акцент
        statusText = 'Wartet auf Arbeitszeit';
    } else if (!status.frei && status.hasUnfinishedTask) {
        fillColor = COLORS.machine.busy;
        accentColor = '#228B22'; // Зеленый акцент
        statusText = 'Beschäftigt';
    } else if (status.frei && status.canStartNewTask) {
        fillColor = COLORS.machine.free;
        accentColor = '#32CD32'; // Светло-зеленый акцент
        statusText = 'Frei';
    } else if (status.frei && !isWorkingTime && isAvailable) {
        fillColor = COLORS.machine.nonWorking;
        accentColor = '#696969'; // Серый акцент
        statusText = 'Keine Arbeitszeit';
    } else if (status.frei && !status.canStartNewTask && isWorkingTime) {
        fillColor = COLORS.machine.idle;
        accentColor = '#4169E1'; // Синий акцент
        statusText = 'Bereit';
    } else {
        fillColor = COLORS.machine.unknown || '#808080';
        accentColor = '#A0A0A0';
        statusText = 'Unbekannter Status';
        console.warn(`Unbekannter Maschinenstatus ${machineNr}:`, status);
    }

    const machineHeight = size * 0.8;
    const cornerRadius = 8;

    // Сохраняем контекст для трансформаций
    ctx.save();

    // Тень машины
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Основное тело машины (скругленный прямоугольник)
    drawRoundedRect(ctx, x, y, size, machineHeight, cornerRadius);

    // Создаем градиент для основного тела
    const gradient = ctx.createLinearGradient(x, y, x, y + machineHeight);
    gradient.addColorStop(0, lightenColor(fillColor, 20));
    gradient.addColorStop(0.3, fillColor);
    gradient.addColorStop(1, darkenColor(fillColor, 15));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Убираем тень для последующих элементов
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Верхняя панель управления
    const controlPanelHeight = 20;
    drawRoundedRect(ctx, x + 5, y + 5, size - 10, controlPanelHeight, 4);
    const controlGradient = ctx.createLinearGradient(x + 5, y + 5, x + 5, y + 5 + controlPanelHeight);
    controlGradient.addColorStop(0, '#E8E8E8');
    controlGradient.addColorStop(1, '#C0C0C0');
    ctx.fillStyle = controlGradient;
    ctx.fill();

    // Индикаторные лампочки на панели управления
    drawStatusLight(ctx, x + 10, y + 10, 4, accentColor);
    drawStatusLight(ctx, x + 20, y + 10, 3, status.frei ? '#00FF00' : '#FF4500');

    // Боковая вентиляционная решетка
    ctx.strokeStyle = darkenColor(fillColor, 30);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const ventY = y + 35 + i * 8;
        ctx.beginPath();
        ctx.moveTo(x + size - 15, ventY);
        ctx.lineTo(x + size - 5, ventY);
        ctx.stroke();
    }

    // Основная рамка машины
    drawRoundedRect(ctx, x, y, size, machineHeight, cornerRadius);
    ctx.strokeStyle = darkenColor(fillColor, 40);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Внутренняя рамка для объемности
    drawRoundedRect(ctx, x + 2, y + 2, size - 4, machineHeight - 4, cornerRadius - 1);
    ctx.strokeStyle = lightenColor(fillColor, 30);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Номер машины
    ctx.fillStyle = COLORS.text.white || '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeText(`M${machineNr}`, x + size / 2, y + 45);
    ctx.fillText(`M${machineNr}`, x + size / 2, y + 45);

    // Емкость
    ctx.font = '11px Arial';
    ctx.fillStyle = lightenColor(fillColor, 60);
    ctx.strokeText(`${status.kapTag}h/Tag`, x + size / 2, y + 62);
    ctx.fillStyle = COLORS.text.white || '#FFFFFF';
    ctx.fillText(`${status.kapTag}h/Tag`, x + size / 2, y + 62);

    // Информация об активной задаче
    const activeTask = activeTasks.find(task => task.maschine == machineNr);
    if (activeTask) {
        // Панель информации о задаче
        const infoPanelY = y + machineHeight - 45;
        const infoPanelHeight = 35;

        drawRoundedRect(ctx, x + 3, infoPanelY, size - 6, infoPanelHeight, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // Количество деталей
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        if (activeTask.anzahl) {
            const remainingUnits = activeTask.anzahl - (activeTask.processedUnits || 0);
            ctx.fillText(`${Math.max(0, remainingUnits)}/${activeTask.anzahl} Stk`, x + size / 2, infoPanelY + 12);
        }

        // Номер заказа
        ctx.font = '9px Arial';
        ctx.fillText(`Auftrag: ${activeTask.auftrag_nr}`, x + size / 2, infoPanelY + 24);

        // Прогресс-бар с улучшенным дизайном
        const progress = (activeTask.processedUnits || 0) / activeTask.anzahl;
        const barWidth = size - 16;
        const barHeight = 6;
        const barX = x + 8;
        const barY = infoPanelY + 27;

        // Фон прогресс-бара
        drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // Заполнение прогресс-бара
        if (progress > 0) {
            drawRoundedRect(ctx, barX, barY, barWidth * progress, barHeight, 3);
            const progressGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
            progressGradient.addColorStop(0, lightenColor(accentColor, 20));
            progressGradient.addColorStop(1, accentColor);
            ctx.fillStyle = progressGradient;
            ctx.fill();
        }

        // Время выполнения (на отдельной линии снизу)
        ctx.fillStyle = COLORS.text.primary || '#333333';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(`${Math.ceil(activeTask.remaining / 60)} h übrig`, x + size / 2, y + machineHeight + 12);
    }

    // Статус текст
    ctx.fillStyle = COLORS.text.primary || '#333333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';

    // Добавляем цветной индикатор статуса
    const statusY = activeTask ? y + machineHeight + 25 : y + machineHeight + 15;

    // Цветная точка рядом со статусом
    ctx.beginPath();
    ctx.arc(x + size / 2 - ctx.measureText(statusText).width / 2 - 8, statusY - 4, 3, 0, 2 * Math.PI);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.fillStyle = COLORS.text.primary || '#333333';
    ctx.fillText(statusText, x + size / 2, statusY);

    // Восстанавливаем контекст
    ctx.restore();
    ctx.textAlign = 'left'; // Reset text alignment
}

// Вспомогательные функции
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawStatusLight(ctx, x, y, radius, color) {
    // Тень лампочки
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Основная лампочка
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Блик на лампочке
    ctx.beginPath();
    ctx.arc(x - radius/3, y - radius/3, radius/2, 0, 2 * Math.PI);
    ctx.fillStyle = lightenColor(color, 40);
    ctx.fill();
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
        (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
        (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
}


function drawMachineQueue(x, y, machineNr, simulation) {
    const machineQueue = getMachineQueue(machineNr, simulation);

    if (machineQueue.length === 0) {
        // Показываем стильную заглушку для пустой очереди
        const emptyBoxY = y + 10;
        const emptyBoxHeight = 25;

        // Пунктирная рамка для пустой очереди
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, x + 10, emptyBoxY, LAYOUT.machineSize - 20, emptyBoxHeight, 8);
        ctx.stroke();
        ctx.restore();

        // Иконка и текст
        ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';

        ctx.font = '10px Arial';
        ctx.fillStyle = 'rgba(120, 120, 120, 0.8)';
        ctx.fillText('Keine Aufträge', x + LAYOUT.machineSize / 2, emptyBoxY + 22);

        ctx.textAlign = 'left';
        return;
    }

    // Заголовок очереди со счетчиком
    const headerY = y - 8;
    const headerHeight = 18;
    const headerWidth = LAYOUT.machineSize - 10;

    // Фон заголовка с градиентом
    drawRoundedRect(ctx, x + 5, headerY, headerWidth, headerHeight, 6);
    const headerGradient = ctx.createLinearGradient(x + 5, headerY, x + 5, headerY + headerHeight);
    headerGradient.addColorStop(0, '#34495e');
    headerGradient.addColorStop(1, '#2c3e50');
    ctx.fillStyle = headerGradient;
    ctx.fill();

    // Текст заголовка
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Warteschlange (${machineQueue.length})`, x + LAYOUT.machineSize / 2, headerY + 12);

    // Рисуем элементы очереди
    const maxItemsToShow = 5;
    const itemsToShow = machineQueue.slice(0, maxItemsToShow);
    const itemSpacing = 3;
    const itemHeight = Math.max(LAYOUT.queueItemHeight || 30, 30);

    itemsToShow.forEach((queueItem, index) => {
        const queueX = x + (LAYOUT.machineSize - (LAYOUT.queueItemWidth || 70)) / 2;
        const queueY = y + 15 + index * (itemHeight + itemSpacing);
        const itemWidth = LAYOUT.queueItemWidth || 70;

        // Определяем цвета и приоритет
        let bgColor, borderColor, accentColor;
        const isNext = index === 0;
        const isUrgent = queueItem.priority === 'urgent' || queueItem.urgent;

        if (isNext) {
            bgColor = '#e67e22';  // Оранжевый для следующего
            borderColor = '#d35400';
            accentColor = '#f39c12';
        } else if (isUrgent) {
            bgColor = '#e74c3c';  // Красный для срочных
            borderColor = '#c0392b';
            accentColor = '#ec7063';
        } else {
            bgColor = '#3498db';  // Синий для обычных
            borderColor = '#2980b9';
            accentColor = '#5dade2';
        }

        // Тень для объемности
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Основное тело элемента очереди
        drawRoundedRect(ctx, queueX, queueY, itemWidth, itemHeight, 6);

        // Градиент для фона
        const itemGradient = ctx.createLinearGradient(queueX, queueY, queueX, queueY + itemHeight);
        itemGradient.addColorStop(0, lightenColor(bgColor, 15));
        itemGradient.addColorStop(0.5, bgColor);
        itemGradient.addColorStop(1, darkenColor(bgColor, 10));
        ctx.fillStyle = itemGradient;
        ctx.fill();

        // Убираем тень для остальных элементов
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Акцентная полоска слева
        ctx.fillStyle = accentColor;
        ctx.fillRect(queueX, queueY, 3, itemHeight);

        // Рамка
        drawRoundedRect(ctx, queueX, queueY, itemWidth, itemHeight, 6);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Внутренняя подсветка
        drawRoundedRect(ctx, queueX + 1, queueY + 1, itemWidth - 2, itemHeight - 2, 5);
        ctx.strokeStyle = lightenColor(bgColor, 30);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();

        // Приоритетный индикатор
        if (isNext) {
            // Звездочка для следующего элемента
            ctx.fillStyle = '#f1c40f';
            ctx.font = '8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('★', queueX + 5, queueY + 10);
        } else if (isUrgent) {
            // Восклицательный знак для срочных
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('!', queueX + 6, queueY + 10);
        }

        // Номер заказа
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        // Добавляем контур для лучшей читаемости
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeText(queueItem.auftrag_nr, queueX + itemWidth / 2, queueY + 11);
        ctx.fillText(queueItem.auftrag_nr, queueX + itemWidth / 2, queueY + 11);

        // Номер шага
        ctx.font = '7px Arial';
        ctx.fillStyle = lightenColor(bgColor, 50);
        ctx.strokeText(`Schritt ${queueItem.stepNumber}`, queueX + itemWidth / 2, queueY + 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Schritt ${queueItem.stepNumber}`, queueX + itemWidth / 2, queueY + 20);

        // Мини прогресс-бар внизу (если есть информация о прогрессе)
        if (queueItem.progress !== undefined) {
            const progressBarY = queueY + itemHeight - 3;
            const progressBarWidth = itemWidth - 6;

            // Фон прогресс-бара
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(queueX + 3, progressBarY, progressBarWidth, 2);

            // Заполнение прогресс-бара
            ctx.fillStyle = accentColor;
            ctx.fillRect(queueX + 3, progressBarY, progressBarWidth * (queueItem.progress / 100), 2);
        }
    });

    // Показываем количество оставшихся элементов
    if (machineQueue.length > maxItemsToShow) {
        const remainingY = y + 15 + maxItemsToShow * (itemHeight + itemSpacing) + 8;
        const remainingCount = machineQueue.length - maxItemsToShow;

        // Фон для счетчика оставшихся элементов
        const counterWidth = 60;
        const counterHeight = 16;
        const counterX = x + (LAYOUT.machineSize - counterWidth) / 2;

        drawRoundedRect(ctx, counterX, remainingY - 2, counterWidth, counterHeight, 8);
        ctx.fillStyle = 'rgba(52, 73, 94, 0.8)';
        ctx.fill();

        // Пунктирная рамка
        ctx.save();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Текст
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+${remainingCount} weitere`, x + LAYOUT.machineSize / 2, remainingY + 8);
    }

    // Индикатор направления потока (стрелка вниз)
    if (machineQueue.length > 0) {
        const arrowX = x + LAYOUT.machineSize - 15;
        const arrowY = y + 5;

        ctx.fillStyle = 'rgba(52, 152, 219, 0.6)';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX + 5, arrowY + 8);
        ctx.lineTo(arrowX - 5, arrowY + 8);
        ctx.closePath();
        ctx.fill();
    }

    ctx.textAlign = 'left'; // Reset text alignment
}

function getMachineQueue(machineNr, simulation) {
    const queue = [];
    const addedOrders = new Set(); // Отслеживаем уже добавленные заказы

    for (const auftrag of simulation.auftraegeQueue) {
        const auftragStatus = simulation.auftraegeStatus[auftrag.auftrag_nr];

        if (!auftragStatus || auftragStatus.completed) continue;

        // Пропускаем заказы, которые уже выполняются
        const hasActiveTask = simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
        if (hasActiveTask) continue;

        // Пропускаем заказы, которые уже добавлены в очередь
        if (addedOrders.has(auftrag.auftrag_nr)) continue;

        const currentOperation = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
        if (!currentOperation) continue;

        // Добавляем заказ только если текущая операция выполняется на этой машине
        if (currentOperation.maschine == machineNr) {
            queue.push({
                auftrag_nr: auftrag.auftrag_nr,
                stepNumber: auftragStatus.currentStep + 1,
                duration: currentOperation.dauer,
                priority: auftragStatus.currentStep === 0 ? 1 : 2,
                auftrag: auftrag
            });
            addedOrders.add(auftrag.auftrag_nr);
        }
    }

    // Сортировка по приоритету и номеру заказа
    queue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.auftrag_nr.localeCompare(b.auftrag_nr);
    });

    return queue;
}


function drawMovableActiveTasksOverview(simulation) {
    if (simulation.activeTasks.length === 0) return;

    const panelX = panelPositions.activeTasksOverview.x;
    const panelY = panelPositions.activeTasksOverview.y;
    const panelWidth = 300;
    const panelHeight = Math.min(300, 40 + simulation.activeTasks.length * LAYOUT.taskHeight);

    // Check if panel is being hovered for drag
    const canvasPos = screenToCanvas(lastMousePos.x, lastMousePos.y);
    const isHovered = canvasPos.x >= panelX && canvasPos.x <= panelX + panelWidth &&
        canvasPos.y >= panelY && canvasPos.y <= panelY + LAYOUT.dragHandleHeight;

    // Draw drag handle
    drawDragHandle(panelX, panelY, panelWidth, '🔄 Aktive Aufgaben', isHovered);

    // Panel background
    ctx.fillStyle = COLORS.ui.panel;
    ctx.fillRect(panelX, panelY + LAYOUT.dragHandleHeight, panelWidth, panelHeight - LAYOUT.dragHandleHeight);

    // Panel border
    ctx.strokeStyle = COLORS.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Task list
    simulation.activeTasks.forEach((task, index) => {
        const taskY = panelY + LAYOUT.dragHandleHeight + 15 + index * LAYOUT.taskHeight;

        ctx.fillStyle = COLORS.task.active;
        ctx.fillRect(panelX + 10, taskY, panelWidth - 20, LAYOUT.taskHeight - 5);

        ctx.strokeStyle = COLORS.machine.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 10, taskY, panelWidth - 20, LAYOUT.taskHeight - 5);

        ctx.fillStyle = COLORS.text.white;
        ctx.font = '12px Arial';
        ctx.fillText(`${task.auftrag_nr} → M${task.maschine} (${Math.ceil(task.remaining / 60)}h)`, panelX + 20, taskY + 18);
    });
}

function drawMovableQueue(simulation) {
    if (simulation.auftraegeQueue.length === 0) return;

    const panelX = panelPositions.queue.x;
    const panelY = panelPositions.queue.y;
    const panelWidth = 250;
    const panelHeight = Math.min(400, 40 + simulation.auftraegeQueue.length * LAYOUT.queueItemHeight);

    // Check if panel is being hovered for drag
    const canvasPos = screenToCanvas(lastMousePos.x, lastMousePos.y);
    const isHovered = canvasPos.x >= panelX && canvasPos.x <= panelX + panelWidth &&
        canvasPos.y >= panelY && canvasPos.y <= panelY + LAYOUT.dragHandleHeight;

    // Draw drag handle
    drawDragHandle(panelX, panelY, panelWidth, '📋 Warteschlange', isHovered);

    // Panel background
    ctx.fillStyle = COLORS.ui.panel;
    ctx.fillRect(panelX, panelY + LAYOUT.dragHandleHeight, panelWidth, panelHeight - LAYOUT.dragHandleHeight);

    // Panel border
    ctx.strokeStyle = COLORS.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Queue items
    simulation.auftraegeQueue.slice(0, 15).forEach((auftrag, index) => {
        const queueY = panelY + LAYOUT.dragHandleHeight + 15 + index * LAYOUT.queueItemHeight;

        ctx.fillStyle = COLORS.task.waiting;
        ctx.fillRect(panelX + 10, queueY, panelWidth - 20, LAYOUT.queueItemHeight - 3);

        ctx.strokeStyle = COLORS.machine.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 10, queueY, panelWidth - 20, LAYOUT.queueItemHeight - 3);

        ctx.fillStyle = COLORS.text.primary;
        ctx.font = '12px Arial';
        ctx.fillText(`${auftrag.auftrag_nr} (${auftrag.Anzahl} Stk.)`, panelX + 18, queueY + 16);
    });

    if (simulation.auftraegeQueue.length > 15) {
        ctx.fillStyle = COLORS.text.secondary;
        ctx.font = '11px Arial';
        ctx.fillText(`+${simulation.auftraegeQueue.length - 15} weitere...`, panelX + 10, panelY + panelHeight - 10);
    }
}

function drawMovableInfoPanel(simulation) {
    const panelX = panelPositions.statistics.x;
    const panelY = panelPositions.statistics.y;
    const panelWidth = 280;
    const panelHeight = 400;

    // Check if panel is being hovered for drag
    const canvasPos = screenToCanvas(lastMousePos.x, lastMousePos.y);
    const isHovered = canvasPos.x >= panelX && canvasPos.x <= panelX + panelWidth &&
        canvasPos.y >= panelY && canvasPos.y <= panelY + LAYOUT.dragHandleHeight;

    // Draw drag handle
    drawDragHandle(panelX, panelY, panelWidth, '📊 Statistiken', isHovered);

    // Panel background
    ctx.fillStyle = COLORS.ui.panel;
    ctx.fillRect(panelX, panelY + LAYOUT.dragHandleHeight, panelWidth, panelHeight - LAYOUT.dragHandleHeight);

    // Panel border
    ctx.strokeStyle = COLORS.ui.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    let currentY = panelY + LAYOUT.dragHandleHeight + 25;

    // Statistics
    const stats = [
        {label: 'Warteschlange', value: simulation.auftraegeQueue.length},
        {label: 'Aktive Aufgaben', value: simulation.activeTasks.length},
        {
            label: 'Freie Maschinen',
            value: Object.values(simulation.maschinenStatus).filter(m => m.frei && m.verfuegbar).length
        },
        {label: 'Gesamte Maschinen', value: Object.keys(simulation.maschinenStatus).length},
        {label: 'Simulationstag', value: getCurrentDay()},
        {label: 'Intervall', value: `${simulation.simulationMinutesPerStep} min`}
    ];

    stats.forEach(stat => {
        ctx.fillStyle = COLORS.text.secondary;
        ctx.font = '12px Arial';
        ctx.fillText(stat.label + ':', panelX + 10, currentY);

        ctx.fillStyle = COLORS.text.primary;
        ctx.font = 'bold 12px Arial';
        ctx.fillText(stat.value.toString(), panelX + panelWidth - 50, currentY);

        currentY += 25;
    });

    // Recent activities
    if (simulation.recentActivities && simulation.recentActivities.length > 0) {
        currentY += 20;
        ctx.fillStyle = COLORS.text.primary;
        ctx.font = 'bold 14px Arial';
        ctx.fillText('🔔 Ereignisse', panelX + 10, currentY);

        currentY += 20;
        simulation.recentActivities.slice(-5).forEach(activity => {
            ctx.fillStyle = COLORS.text.secondary;
            ctx.font = '10px Arial';

            const maxWidth = panelWidth - 20;
            const words = activity.split(' ');
            let line = '';

            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && line !== '') {
                    ctx.fillText(line, panelX + 10, currentY);
                    line = word + ' ';
                    currentY += 15;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, panelX + 10, currentY);
            currentY += 20;
        });
    }
}

function getOriginalDuration(activeTask) {
    return activeTask.remaining + 5;
}

// Animation helpers
export function startAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    draw();
}

export function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Initialize canvas when module loads
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initCanvas);
}