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
        unknown: '#795548'         // Коричневый - неопределенный статус
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
    ctx.fillText('🏭 Produktionssimulation', 150, 35);

    // Current day
    ctx.font = '16px Arial';
    ctx.fillText(`Tag: ${getCurrentDay()}`, canvas.width - 400, 25);

    // Status
    const status = simulation.isRunning ? '▶️ Läuft' : '⏸️ Gestoppt';
    ctx.fillText(status, canvas.width - 400, 45);

    // Instructions
    ctx.fillStyle = COLORS.text.secondary;
    ctx.font = '12px Arial';
    ctx.fillText('💡 Панели можно перетаскивать за заголовок', 150, 55);
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
    drawMachineQueue(x, y + size * 0.7 + 30, machineNr, simulation);
}

function drawMachine(x, y, machineNr, status, activeTasks) {
    const size = LAYOUT.machineSize;

    const machineObj = simulation.maschinen?.find(m => m.Nr == machineNr);

    // Получаем дополнительную информацию для точного определения статуса
    const isAvailable = machineObj ? window.isMachineAvailable(machineObj) : false;
    const isWorkingTime = machineObj ? window.isMachineWorkingTime(machineObj) : false;

    let fillColor, statusText;

    if (!status.verfuegbar) {
        // Машина недоступна по датам
        fillColor = COLORS.machine.unavailable; // Добавьте этот цвет в COLORS, если его нет
        statusText = 'Недоступна';
    } else if (status.hasUnfinishedTask && status.waitingForWorkingTime) {
        // Машина имеет незаконченную задачу, но сейчас нерабочее время
        fillColor = COLORS.machine.waitingForWorkTime; // Новый цвет для этого статуса
        statusText = 'Ждет рабочего времени';
    } else if (!status.frei && status.hasUnfinishedTask) {
        // Машина активно выполняет задачу
        fillColor = COLORS.machine.busy;
        statusText = 'Beschäftigt';
    } else if (status.frei && status.canStartNewTask) {
        // Машина свободна и может принять новую задачу
        fillColor = COLORS.machine.free;
        statusText = 'Frei';
    } else if (status.frei && !isWorkingTime && isAvailable) {
        // Машина свободна, но сейчас нерабочее время
        fillColor = COLORS.machine.nonWorking;
        statusText = 'Нерабочее время';
    } else {
        // Fallback для неопределенных состояний
        fillColor = COLORS.machine.unknown; // Добавьте этот цвет, если его нет
        statusText = 'Неопределенный статус';
        console.warn(`Неопределенный статус машины ${machineNr}:`, status);
    }

    // Machine body
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, size, size * 0.7);

    // Machine border
    ctx.strokeStyle = COLORS.machine.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size * 0.7);

    // Machine number
    ctx.fillStyle = COLORS.text.white;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`M${machineNr}`, x + size / 2, y + 25);

    // Capacity
    ctx.font = '12px Arial';
    ctx.fillText(`${status.kapTag}h/Tag`, x + size / 2, y + 45);

    // Active task info (теперь внутри машины)
    const activeTask = activeTasks.find(task => task.maschine == machineNr);
    if (activeTask) {
        // Отображаем количество штук внутри машины
        ctx.fillStyle = COLORS.text.white;
        ctx.font = '10px Arial';
        if (activeTask.anzahl) {
            const remainingUnits = activeTask.anzahl - (activeTask.processedUnits || 0);
            ctx.fillText(`${Math.max(0, remainingUnits)}/${activeTask.anzahl} Stk`, x + size / 2, y + 60);
        }

        // Номер заказа
        ctx.fillText(`${activeTask.auftrag_nr}`, x + size / 2, y + 72);

        // Progress bar внутри машины
        const progress = (activeTask.processedUnits || 0) / activeTask.anzahl;
        const barWidth = size * 0.7; // Немного уже, чтобы поместиться внутри
        const barHeight = 4;
        const barX = x + (size - barWidth) / 2;
        const barY = y + size * 0.7 - 25; // Размещаем в нижней части машины

        // Progress background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress fill
        ctx.fillStyle = COLORS.text.white;
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // Время внутри машины
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.ceil(activeTask.remaining / 60)} h übrig`, x + size / 2, y + size * 0.7 - 5);
    }

    // Status text (остается снаружи)
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, x + size / 2, y + size * 0.7 + 15);

    ctx.textAlign = 'left'; // Reset text alignment
}


function drawMachineQueue(x, y, machineNr, simulation) {
    const machineQueue = getMachineQueue(machineNr, simulation);

    if (machineQueue.length === 0) {
        // ctx.fillStyle = COLORS.text.secondary;
        // ctx.font = '11px Arial';
        // ctx.textAlign = 'center';
        // ctx.fillText('Keine wartenden Aufträge', x + LAYOUT.machineSize / 2, y + 15);
        // ctx.textAlign = 'left';
        return;
    }

    // // Queue title
    // ctx.fillStyle = COLORS.text.primary;
    // ctx.font = 'bold 12px Arial';
    // ctx.textAlign = 'center';
    // ctx.fillText(`Warteschlange M${machineNr} (${machineQueue.length})`, x + LAYOUT.machineSize / 2, y - 5);

    // Draw queue items in single column
    const maxItemsToShow = 6;
    const itemsToShow = machineQueue.slice(0, maxItemsToShow);

    itemsToShow.forEach((queueItem, index) => {
        // Центрируем элементы по ширине машины
        const queueX = x + (LAYOUT.machineSize - LAYOUT.queueItemWidth) / 2;
        const queueY = y + index * (LAYOUT.queueItemHeight + LAYOUT.queueItemSpacing);

        let bgColor = COLORS.task.queued;
        if (index === 0) {
            bgColor = '#d35400'; // Первый элемент выделяем другим цветом
        }

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(queueX, queueY, LAYOUT.queueItemWidth, LAYOUT.queueItemHeight);

        // Border
        ctx.strokeStyle = COLORS.machine.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(queueX, queueY, LAYOUT.queueItemWidth, LAYOUT.queueItemHeight);

        // Order number
        ctx.fillStyle = COLORS.text.white;
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(queueItem.auftrag_nr, queueX + LAYOUT.queueItemWidth / 2, queueY + 10);

        // Step number
        ctx.font = '8px Arial';
        ctx.fillText(`Schritt ${queueItem.stepNumber}`, queueX + LAYOUT.queueItemWidth / 2, queueY + 19);

        // Duration
        if (queueItem.duration) {
            ctx.fillText(`${queueItem.duration}h`, queueX + LAYOUT.queueItemWidth / 2, queueY + 27);
        }
    });

    // Show remaining items count
    if (machineQueue.length > maxItemsToShow) {
        const remainingY = y + maxItemsToShow * (LAYOUT.queueItemHeight + LAYOUT.queueItemSpacing) + 10;
        ctx.fillStyle = COLORS.text.secondary;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+${machineQueue.length - maxItemsToShow} weitere`, x + LAYOUT.machineSize / 2, remainingY);
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
    drawDragHandle(panelX, panelY, panelWidth, '📊 Статистика', isHovered);

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