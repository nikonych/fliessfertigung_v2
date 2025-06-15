// ui/simulation/canvas.js
import {initCanvas, draw, startAnimation, stopAnimation} from './renderer.js';

// Canvas и контекст
let canvas, ctx;
let isDragging = false;
let dragStart = {x: 0, y: 0};
let offset = {x: 0, y: 0};
let scale = 1;

// Инициализация Canvas
function init() {
    canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    ctx = canvas.getContext('2d');

    // Установка размеров Canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Обработчики событий мыши для панорамирования и масштабирования
    setupCanvasInteraction();

    // Инициализация рендерера
    initCanvas();

    console.log('Canvas system initialized');
}

function resizeCanvas() {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Перерисовать после изменения размера
    if (window.simulation) {
        draw();
    }
}

function setupCanvasInteraction() {
    // Панорамирование мышью
    canvas.addEventListener('mousedown', (e) => {
        if (window.isPanelDragging) return;
        isDragging = true;
        dragStart.x = e.clientX - offset.x;
        dragStart.y = e.clientY - offset.y;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (window.isPanelDragging) return;
        if (isDragging) {
            offset.x = e.clientX - dragStart.x;
            offset.y = e.clientY - dragStart.y;
            draw();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'default';
    });

    // Масштабирование колесиком мыши
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(3, scale * delta));

        if (newScale !== scale) {
            scale = newScale;
            draw();
        }
    });

    // Клики по Canvas для взаимодействия
    canvas.addEventListener('click', handleCanvasClick);

    // Установить начальный курсор
    canvas.style.cursor = 'grab';
}

function handleCanvasClick(e) {
    // Если сейчас перетаскиваем панель, не обрабатываем клики по машинам
    if (window.isPanelDragging) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Преобразуем координаты с учетом трансформаций (pan/zoom)
    const transform = window.getCanvasTransform?.();
    const scale = transform?.scale || 1;
    const offsetX = transform?.offset?.x || 0;
    const offsetY = transform?.offset?.y || 0;

    // Получаем координаты в системе координат Canvas с учетом трансформаций
    const canvasX = (mouseX - offsetX) / scale;
    const canvasY = (mouseY - offsetY) / scale;

    // Проверить, был ли клик по машине
    const clickedMachine = findMachineAtPosition(canvasX, canvasY);
    if (clickedMachine) {
        showMachineDetails(clickedMachine);
    }

    // Проверить, был ли клик по заказу в очереди
    const clickedOrder = findOrderAtPosition(canvasX, canvasY);
    if (clickedOrder) {
        showOrderDetails(clickedOrder);
        return;
    }

}

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

function excelToDate(serial) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

function findOrderAtPosition(x, y) {
    if (!window.simulation || !window.simulation.maschinenStatus) return null;

    const machines = Object.entries(window.simulation.maschinenStatus);
    const queueStartOffset = 135;

    const cols = Math.floor((canvas.width - LAYOUT.leftPadding - LAYOUT.rightPadding) / (LAYOUT.machineSize + LAYOUT.machineSpacing));

    for (let i = 0; i < machines.length; i++) {
        const machineNr = machines[i][0];
        const machineQueue = getMachineQueue(machineNr, window.simulation);

        if (machineQueue.length === 0) continue;

        const row = Math.floor(i / cols);
        const col = i % cols;

        const machineX = LAYOUT.leftPadding + col * (LAYOUT.machineSize + LAYOUT.machineSpacing);
        const machineY = LAYOUT.topPadding + row * (LAYOUT.machineSize + LAYOUT.machineSpacing * 2 + 200);

        // Проверяем клики по элементам очереди
        const queueStartY = machineY + queueStartOffset;
        const itemsToShow = Math.min(5, machineQueue.length);

        for (let queueIndex = 0; queueIndex < itemsToShow; queueIndex++) {
            const itemY = queueStartY + queueIndex * LAYOUT.queueItemHeight;

            if (x >= machineX && x <= machineX + LAYOUT.machineSize &&
                y >= itemY && y <= itemY + LAYOUT.queueItemHeight) {
                return {
                    order: machineQueue[queueIndex],
                    machineNr: machineNr,
                    queuePosition: queueIndex + 1
                };
            }
        }
    }

    return null;
}

function showOrderDetails(orderInfo) {
    const { order, machineNr, queuePosition } = orderInfo;
    const auftragStatus = window.simulation.auftraegeStatus[order.auftrag_nr];
    const auftragData = window.simulation.auftraege?.find(a => a.auftrag_nr === order.auftrag_nr);

    let details = `📦 Auftrag ${order.auftrag_nr}\n`;
    details += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Grundinformationen
    if (auftragData) {
        details += `📋 Artikel: ${auftragData.auftrag_nr || 'N/A'}\n`;
        details += `📊 Menge: ${auftragData.Anzahl || 'N/A'} Stück\n`;
    }

    details += `\n🎯 WARTESCHLANGEN-INFO:\n`;
    details += `   🏭 Maschine: ${machineNr}\n`;
    details += `   📍 Position in Warteschlange: ${queuePosition}\n`;
    details += `   🔢 Arbeitsschritt: ${order.stepNumber}\n`;
    details += `   ⏱️ Geplante Dauer: ${order.duration}h\n`;

    // Arbeitsplan-Status
    if (auftragStatus) {
        details += `\n📋 ARBEITSPLAN-STATUS:\n`;
        details += `   📊 Fortschritt: Schritt ${auftragStatus.currentStep + 1} von ${auftragStatus.arbeitsplaene.length}\n`;
        details += `   ✅ Abgeschlossen: ${auftragStatus.completed ? 'Ja' : 'Nein'}\n`;

        // Bereits abgeschlossene Schritte
        const completedSteps = auftragStatus.arbeitsplaene.slice(0, auftragStatus.currentStep);
        if (completedSteps.length > 0) {
            details += `\n✅ ABGESCHLOSSENE SCHRITTE:\n`;
            completedSteps.forEach((step, index) => {
                details += `   ${index + 1}. Maschine ${step.maschine} - ${step.dauer}h\n`;
            });
        }

        // Aktueller Schritt
        const currentStep = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
        if (currentStep) {
            details += `\n🔄 AKTUELLER SCHRITT:\n`;
            details += `   🏭 Maschine: ${currentStep.maschine}\n`;
            details += `   ⏱️ Dauer: ${currentStep.dauer}h\n`;
            details += `   📋 Beschreibung: ${currentStep.beschreibung || 'N/A'}\n`;
        }

        // Verbleibende Schritte
        const remainingSteps = auftragStatus.arbeitsplaene.slice(auftragStatus.currentStep + 1);
        if (remainingSteps.length > 0) {
            details += `\n⏳ VERBLEIBENDE SCHRITTE:\n`;
            remainingSteps.forEach((step, index) => {
                details += `   ${auftragStatus.currentStep + index + 2}. Maschine ${step.maschine} - ${step.dauer}h\n`;
            });
        }
    }

    // Prioritätsinformation
    const priority = order.priority === 1 ? 'Hoch (Erster Schritt)' : 'Normal';
    details += `\n🎯 PRIORITÄT: ${priority}\n`;

    // Zeitschätzungen
    const machineStatus = window.simulation.maschinenStatus[machineNr];
    if (machineStatus) {
        const activeTask = window.simulation.activeTasks.find(task => task.maschine == machineNr);
        const estimatedWaitTime = calculateEstimatedWaitTime(machineNr, queuePosition);

        details += `\n⏰ ZEITSCHÄTZUNGEN:\n`;
        details += `   ⏱️ Geschätzte Wartezeit: ${estimatedWaitTime}h\n`;

        if (activeTask) {
            const remainingActiveTime = Math.ceil(activeTask.remaining / 60);
            details += `   🔄 Aktive Aufgabe verbleibend: ${remainingActiveTime}h\n`;
        }
    }

    // Technische Details
    details += `\n🔧 TECHNISCHE DETAILS:\n`;
    details += `   🆔 Auftrag-ID: ${order.auftrag_nr}\n`;
    details += `   🔢 Schritt-Nummer: ${order.stepNumber}\n`;
    details += `   🏭 Ziel-Maschine: ${machineNr}\n`;

    // Verwende das gleiche Modal-System wie bei Maschinen
    showOrderModal(details, order);
}

function calculateEstimatedWaitTime(machineNr, queuePosition) {
    const machineQueue = getMachineQueue(machineNr, window.simulation);
    const activeTask = window.simulation.activeTasks.find(task => task.maschine == machineNr);

    let totalWaitTime = 0;

    // Zeit für aktive Aufgabe
    if (activeTask) {
        totalWaitTime += Math.ceil(activeTask.remaining / 60);
    }

    // Zeit für Aufgaben vor diesem in der Warteschlange
    for (let i = 0; i < queuePosition - 1 && i < machineQueue.length; i++) {
        totalWaitTime += machineQueue[i].duration || 0;
    }

    return totalWaitTime;
}

function showOrderModal(details, order) {
    // Erstelle Modal-Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Courier New', monospace;
    `;

    // Erstelle Modal-Content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
    `;

    // Erstelle Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
    `;

    const title = document.createElement('h3');
    title.textContent = `📦 Auftrag ${order.auftrag_nr} - Details`;
    title.style.cssText = `
        margin: 0;
        color: #2c3e50;
        font-size: 20px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        background: #e74c3c;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Erstelle Content
    const content = document.createElement('pre');
    content.textContent = details;
    content.style.cssText = `
        white-space: pre-wrap;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #2c3e50;
        margin: 0;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #e67e22;
    `;

    // Zusammenbauen
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Event Listeners
    closeBtn.onclick = () => document.body.removeChild(overlay);
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };

    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // Zu DOM hinzufügen
    document.body.appendChild(overlay);
}

function findMachineAtPosition(x, y) {
    if (!window.simulation || !window.simulation.maschinenStatus) return null;

    const machines = Object.entries(window.simulation.maschinenStatus);
    const machineSize = 150; // Используем LAYOUT.machineSize из renderer.js
    const machineSpacing = 20; // Используем LAYOUT.machineSpacing из renderer.js
    const topPadding = 80; // Используем LAYOUT.topPadding из renderer.js
    const leftPadding = 50; // Используем LAYOUT.leftPadding из renderer.js
    const rightPadding = 50; // Используем LAYOUT.rightPadding из renderer.js

    const cols = Math.floor((canvas.width - leftPadding - rightPadding) / (machineSize + machineSpacing));

    for (let i = 0; i < machines.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;

        const machineX = leftPadding + col * (machineSize + machineSpacing);
        // Обновляем расчет Y координаты в соответствии с renderer.js
        const machineY = topPadding + row * (machineSize + machineSpacing * 2 + 200);

        // Проверяем попадание в область машины (только верхняя часть)
        if (x >= machineX && x <= machineX + machineSize &&
            y >= machineY && y <= machineY + machineSize * 0.7) {
            return {
                nr: machines[i][0],
                status: machines[i][1],
                position: {x: machineX, y: machineY}
            };
        }
    }

    return null;
}

function showMachineDetails(machine) {
    const activeTask = window.simulation.activeTasks.find(task => task.maschine == machine.nr);
    const machineObj = window.simulation.maschinen?.find(m => m.Nr == machine.nr);

    // Получаем дополнительную информацию для точного определения статуса
    const isAvailable = machineObj ? window.isMachineAvailable(machineObj) : false;
    const isWorkingTime = machineObj ? window.isMachineWorkingTime(machineObj) : false;

    // Получаем очередь для этой машины
    const machineQueue = getMachineQueue(machine.nr, window.simulation);

    let details = `🏭 Maschine ${machine.nr}\n`;
    details += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Основная информация
    details += `📋 Bezeichnung: ${machine.status.bezeichnung || 'N/A'}\n`;
    details += `⚡ Kapazität: ${machine.status.kapTag}h/Tag\n`;

    // Рабочее время (если доступно)
    if (machineObj && machineObj.Verfuegbar_von && machineObj.Verfuegbar_bis) {
        details += `⏰ Arbeitszeit: ${machineObj.Verfuegbar_von} - ${machineObj.Verfuegbar_bis}\n`;
    }

    // Период доступности машины (конвертация из Excel формата)
    if (machineObj && machineObj.verf_von && machineObj.verf_bis) {
        const startDate = excelToDate(machineObj.verf_von);
        const endDate = excelToDate(machineObj.verf_bis);
        details += `📅 Verfügbarkeitszeitraum: ${startDate} - ${endDate}\n`;
    }

    // Доступность по датам (если доступно - старый формат)
    if (machineObj && machineObj.Verfuegbar_ab && machineObj.Verfuegbar_bis_datum) {
        details += `📅 Verfügbar: ${machineObj.Verfuegbar_ab} - ${machineObj.Verfuegbar_bis_datum}\n`;
    }

    details += `\n`;

    // Детальный статус
    let statusIcon, statusText, statusDetails = '';

    if (!machine.status.verfuegbar) {
        statusIcon = '🔴';
        statusText = 'Nicht verfügbar';
        statusDetails = 'Maschine ist außerhalb der Verfügbarkeitsdaten';
    } else if (machine.status.hasUnfinishedTask && machine.status.waitingForWorkingTime) {
        statusIcon = '🟠';
        statusText = 'Wartet auf Arbeitszeit';
        statusDetails = 'Hat unvollendete Aufgabe, aber aktuell Ruhezeit';
    } else if (!machine.status.frei && machine.status.hasUnfinishedTask) {
        statusIcon = '🔵';
        statusText = 'Beschäftigt';
        statusDetails = 'Führt aktiv eine Aufgabe aus';
    } else if (machine.status.frei && machine.status.canStartNewTask) {
        statusIcon = '🟢';
        statusText = 'Frei und bereit';
        statusDetails = 'Kann neue Aufgaben annehmen';
    } else if (machine.status.frei && !isWorkingTime && isAvailable) {
        statusIcon = '⚫';
        statusText = 'Ruhezeit';
        statusDetails = 'Frei, aber außerhalb der Arbeitszeit';
    } else {
        statusIcon = '🟤';
        statusText = 'Unbestimmter Status';
        statusDetails = 'Status konnte nicht eindeutig bestimmt werden';
    }

    details += `${statusIcon} Status: ${statusText}\n`;
    if (statusDetails) {
        details += `   ${statusDetails}\n`;
    }

    // Aktive Aufgabe
    if (activeTask) {
        details += `\n🔄 AKTIVE AUFGABE:\n`;
        details += `   📦 Auftrag: ${activeTask.auftrag_nr}\n`;

        if (activeTask.anzahl) {
            const processedUnits = activeTask.processedUnits || 0;
            const remainingUnits = Math.max(0, activeTask.anzahl - processedUnits);
            const progress = Math.round((processedUnits / activeTask.anzahl) * 100);

            details += `   📊 Fortschritt: ${processedUnits}/${activeTask.anzahl} Stück (${progress}%)\n`;
            details += `   📋 Verbleibend: ${remainingUnits} Stück\n`;
        }

        const remainingHours = Math.ceil(activeTask.remaining / 60);
        const remainingMinutes = activeTask.remaining % 60;

        if (remainingHours > 0) {
            details += `   ⏱️ Verbleibende Zeit: ${remainingHours}h ${remainingMinutes}min\n`;
        } else {
            details += `   ⏱️ Verbleibende Zeit: ${remainingMinutes}min\n`;
        }

        // Schritt-Information (falls verfügbar)
        if (activeTask.stepNumber) {
            details += `   🔢 Arbeitsschritt: ${activeTask.stepNumber}\n`;
        }
    }

    // Warteschlange
    if (machineQueue.length > 0) {
        details += `\n📋 WARTESCHLANGE (${machineQueue.length}):\n`;

        // Zeige erste 5 Aufträge in der Warteschlange
        const itemsToShow = Math.min(5, machineQueue.length);
        for (let i = 0; i < itemsToShow; i++) {
            const queueItem = machineQueue[i];
            const position = i + 1;
            const priority = i === 0 ? '🔥' : '📌';

            details += `   ${priority} ${position}. ${queueItem.auftrag_nr} (Schritt ${queueItem.stepNumber})`;
            if (queueItem.duration) {
                details += ` - ${queueItem.duration}h`;
            }
            details += `\n`;
        }

        if (machineQueue.length > itemsToShow) {
            details += `   ... und ${machineQueue.length - itemsToShow} weitere\n`;
        }
    } else {
        details += `\n📋 WARTESCHLANGE: Leer\n`;
    }

    // Zusätzliche technische Details
    details += `\n🔧 TECHNISCHE DETAILS:\n`;
    details += `   🆔 Maschinen-ID: ${machine.nr}\n`;
    details += `   🎯 Kann neue Aufgabe starten: ${machine.status.canStartNewTask ? 'Ja' : 'Nein'}\n`;
    details += `   ⚙️ Hat unvollendete Aufgabe: ${machine.status.hasUnfinishedTask ? 'Ja' : 'Nein'}\n`;
    details += `   ⏰ Arbeitszeit aktiv: ${isWorkingTime ? 'Ja' : 'Nein'}\n`;
    details += `   📅 Verfügbar nach Datum: ${isAvailable ? 'Ja' : 'Nein'}\n`;

    // Verwende ein schöneres Modal anstatt alert
    showMachineModal(details, machine);
}

function showMachineModal(details, machine) {
    // Erstelle Modal-Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: 'Courier New', monospace;
    `;

    // Erstelle Modal-Content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
    `;

    // Erstelle Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
    `;

    const title = document.createElement('h3');
    title.textContent = `🏭 Maschine ${machine.nr} - Details`;
    title.style.cssText = `
        margin: 0;
        color: #2c3e50;
        font-size: 20px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        background: #e74c3c;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Erstelle Content
    const content = document.createElement('pre');
    content.textContent = details;
    content.style.cssText = `
        white-space: pre-wrap;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #2c3e50;
        margin: 0;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #3498db;
    `;

    // Zusammenbauen
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Event Listeners
    closeBtn.onclick = () => document.body.removeChild(overlay);
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };

    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);

    // Zu DOM hinzufügen
    document.body.appendChild(overlay);
}

// Hilfsfunktion - falls nicht verfügbar
function getMachineQueue(machineNr, simulation) {
    const queue = [];
    const addedOrders = new Set();

    for (const auftrag of simulation.auftraegeQueue) {
        const auftragStatus = simulation.auftraegeStatus[auftrag.auftrag_nr];

        if (!auftragStatus || auftragStatus.completed) continue;

        const hasActiveTask = simulation.activeTasks.some(task => task.auftrag_nr === auftrag.auftrag_nr);
        if (hasActiveTask) continue;

        if (addedOrders.has(auftrag.auftrag_nr)) continue;

        const currentOperation = auftragStatus.arbeitsplaene[auftragStatus.currentStep];
        if (!currentOperation) continue;

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

    queue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.auftrag_nr.localeCompare(b.auftrag_nr);
    });

    return queue;
}

// Функции рендеринга с учетом трансформаций
function getTransformedContext() {
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    return ctx;
}

function restoreContext() {
    ctx.restore();
}

// Экспорт функций для использования в renderer.js
window.getCanvasTransform = () => ({offset, scale});
window.transformCanvas = () => {
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
};
window.restoreCanvas = () => {
    ctx.restore();
};

// Дополнительные утилиты для Canvas
export function clearCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

export function getCanvasSize() {
    return {
        width: canvas ? canvas.width : 0,
        height: canvas ? canvas.height : 0
    };
}

// Функция для создания скриншота симуляции
export function saveScreenshot() {
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `simulation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// Обработка ошибок Canvas
window.addEventListener('error', (e) => {
    if (e.message.includes('canvas')) {
        console.error('Canvas error:', e.message);
    }
});

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', init);

console.log('Canvas module loaded');