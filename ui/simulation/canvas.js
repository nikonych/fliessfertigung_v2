// ui/simulation/canvas.js
import { initCanvas, draw, startAnimation, stopAnimation } from './renderer.js';

// Canvas и контекст
let canvas, ctx;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let offset = { x: 0, y: 0 };
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
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - offset.x) / scale;
    const clickY = (e.clientY - rect.top - offset.y) / scale;
    
    // Проверить, был ли клик по машине
    const clickedMachine = findMachineAtPosition(clickX, clickY);
    if (clickedMachine) {
        showMachineDetails(clickedMachine);
    }
}

function findMachineAtPosition(x, y) {
    if (!window.simulation || !window.simulation.maschinenStatus) return null;
    
    const machines = Object.entries(window.simulation.maschinenStatus);
    const machineSize = 120;
    const machineSpacing = 20;
    const topPadding = 80;
    const leftPadding = 50;
    const rightPadding = 300;
    
    const cols = Math.floor((canvas.width - leftPadding - rightPadding) / (machineSize + machineSpacing));
    
    for (let i = 0; i < machines.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const machineX = leftPadding + col * (machineSize + machineSpacing);
        const machineY = topPadding + row * (machineSize + machineSpacing);
        
        if (x >= machineX && x <= machineX + machineSize &&
            y >= machineY && y <= machineY + machineSize * 0.7) {
            return {
                nr: machines[i][0],
                status: machines[i][1],
                position: { x: machineX, y: machineY }
            };
        }
    }
    
    return null;
}

function showMachineDetails(machine) {
    // Найти активную задачу для этой машины
    const activeTask = window.simulation.activeTasks.find(task => task.maschine == machine.nr);
    
    let details = `Maschine ${machine.nr}\n`;
    details += `Bezeichnung: ${machine.status.bezeichnung || 'N/A'}\n`;
    details += `Kapazität: ${machine.status.kapTag}h/Tag\n`;
    details += `Status: ${machine.status.verfuegbar ? (machine.status.frei ? 'Frei' : 'Beschäftigt') : 'Nicht verfügbar'}\n`;
    
    if (activeTask) {
        details += `\nAktiver Auftrag: ${activeTask.auftrag_nr}\n`;
        details += `Verbleibende Zeit: ${activeTask.remaining}h`;
    }
    
    alert(details); // Простое решение, можно заменить на красивый popup
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
window.getCanvasTransform = () => ({ offset, scale });
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