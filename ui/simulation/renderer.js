// ui/simulation/renderer.js
let canvas, ctx;
let animationId;

// Colors and styling
const COLORS = {
    background: '#f5f5f5',
    machine: {
        free: '#27ae60',
        busy: '#e74c3c',
        unavailable: '#95a5a6',
        border: '#2c3e50'
    },
    task: {
        waiting: '#f39c12',
        active: '#3498db',
        completed: '#27ae60'
    },
    text: {
        primary: '#2c3e50',
        secondary: '#7f8c8d',
        white: '#ffffff'
    },
    ui: {
        panel: '#ffffff',
        border: '#bdc3c7',
        shadow: 'rgba(0,0,0,0.1)'
    }
};

// Layout constants
const LAYOUT = {
    machineSize: 120,
    machineSpacing: 20,
    topPadding: 80,
    leftPadding: 50,
    rightPadding: 300, // Space for info panel
    bottomPadding: 350, // Space for queue
    taskHeight: 30,
    queueItemHeight: 25
};

export function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    console.log('Canvas initialized');
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw main components
    drawHeader(simulation);
    drawMachines(simulation);
    drawActiveTasksOverview(simulation);
    drawQueue(simulation);
    drawInfoPanel(simulation);

    // Continue animation loop
    if (simulation.isRunning) {
        animationId = requestAnimationFrame(draw);
    }
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
    ctx.fillText('🏭 Produktionssimulation', 20, 35);

    // Current day
    ctx.font = '16px Arial';
    ctx.fillText(`Tag: ${simulation.currentDay}`, canvas.width - 200, 25);

    // Status
    const status = simulation.isRunning ? '▶️ Läuft' : '⏸️ Gestoppt';
    ctx.fillText(status, canvas.width - 200, 45);
}

function drawMachines(simulation) {
    const machines = Object.entries(simulation.maschinenStatus);
    if (machines.length === 0) return;

    const startY = LAYOUT.topPadding;
    const cols = Math.floor((canvas.width - LAYOUT.leftPadding - LAYOUT.rightPadding) / (LAYOUT.machineSize + LAYOUT.machineSpacing));

    machines.forEach(([machineNr, status], index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;

        const x = LAYOUT.leftPadding + col * (LAYOUT.machineSize + LAYOUT.machineSpacing);
        const y = startY + row * (LAYOUT.machineSize + LAYOUT.machineSpacing);

        drawMachine(x, y, machineNr, status, simulation.activeTasks);
    });
}

function drawMachine(x, y, machineNr, status, activeTasks) {
    const size = LAYOUT.machineSize;

    // Determine machine color based on status
    let fillColor = COLORS.machine.unavailable;
    let statusText = 'Nicht verfügbar';

    if (status.verfuegbar) {
        if (status.frei) {
            fillColor = COLORS.machine.free;
            statusText = 'Frei';
        } else {
            fillColor = COLORS.machine.busy;
            statusText = 'Beschäftigt';
        }
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
    ctx.fillText(`M${machineNr}`, x + size/2, y + 25);

    // Capacity
    ctx.font = '12px Arial';
    ctx.fillText(`${status.kapTag}h/Tag`, x + size/2, y + 45);

    // Status text
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(statusText, x + size/2, y + size * 0.7 + 15);

    // Active task info
    const activeTask = activeTasks.find(task => task.maschine == machineNr);
    if (activeTask) {
        ctx.fillStyle = COLORS.text.secondary;
        ctx.font = '10px Arial';
        ctx.fillText(`${activeTask.auftrag_nr}`, x + size/2, y + size * 0.7 + 30);
        ctx.fillText(`${activeTask.remaining}h übrig`, x + size/2, y + size * 0.7 + 45);

        // Progress bar
        const progress = 1 - (activeTask.remaining / getOriginalDuration(activeTask));
        const barWidth = size * 0.8;
        const barHeight = 6;
        const barX = x + (size - barWidth) / 2;
        const barY = y + size * 0.7 - 15;

        // Progress background
        ctx.fillStyle = COLORS.ui.border;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress fill
        ctx.fillStyle = COLORS.task.active;
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }

    ctx.textAlign = 'left'; // Reset text alignment
}

function getOriginalDuration(activeTask) {
    // This would need access to arbeitsplaene data to get original duration
    // For now, estimate based on remaining time (this is simplified)
    return activeTask.remaining + 5; // Rough estimate
}

function drawActiveTasksOverview(simulation) {
    if (simulation.activeTasks.length === 0) return;

    const startX = 20;
    const startY = canvas.height - LAYOUT.bottomPadding + 10;

    // Section title
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('🔄 Aktive Aufgaben', startX, startY);

    // Task list
    simulation.activeTasks.forEach((task, index) => {
        const y = startY + 25 + index * LAYOUT.taskHeight;

        // Task background
        ctx.fillStyle = COLORS.task.active;
        ctx.fillRect(startX, y, 250, LAYOUT.taskHeight - 5);

        // Task text
        ctx.fillStyle = COLORS.text.white;
        ctx.font = '12px Arial';
        ctx.fillText(`${task.auftrag_nr} → M${task.maschine} (${task.remaining}h)`, startX + 10, y + 18);
    });
}

function drawQueue(simulation) {
    if (simulation.auftraegeQueue.length === 0) return;

    const startX = 300;
    const startY = canvas.height - LAYOUT.bottomPadding + 10;

    // Section title
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('📋 Warteschlange', startX, startY);

    // Queue items
    simulation.auftraegeQueue.slice(0, 5).forEach((auftrag, index) => { // Show only first 5
        const y = startY + 25 + index * LAYOUT.queueItemHeight;

        // Queue item background
        ctx.fillStyle = COLORS.task.waiting;
        ctx.fillRect(startX, y, 200, LAYOUT.queueItemHeight - 3);

        // Queue item text
        ctx.fillStyle = COLORS.text.primary;
        ctx.font = '12px Arial';
        ctx.fillText(`${auftrag.auftrag_nr} (${auftrag.Anzahl} Stk.)`, startX + 8, y + 16);
    });

    // Show count if more items
    if (simulation.auftraegeQueue.length > 5) {
        const y = startY + 25 + 5 * LAYOUT.queueItemHeight;
        ctx.fillStyle = COLORS.text.secondary;
        ctx.font = '11px Arial';
        ctx.fillText(`+${simulation.auftraegeQueue.length - 5} weitere...`, startX, y + 15);
    }
}

function drawInfoPanel(simulation) {
    const panelWidth = LAYOUT.rightPadding - 20;
    const panelX = canvas.width - panelWidth - 10;
    const panelY = LAYOUT.topPadding;
    const panelHeight = canvas.height - LAYOUT.topPadding - LAYOUT.bottomPadding;

    // Panel background
    ctx.fillStyle = COLORS.ui.panel;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = COLORS.ui.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Panel title
    ctx.fillStyle = COLORS.text.primary;
    ctx.font = 'bold 14px Arial';
    ctx.fillText('📊 Statistiken', panelX + 10, panelY + 25);

    let currentY = panelY + 50;

    // Statistics
    const stats = [
        { label: 'Warteschlange', value: simulation.auftraegeQueue.length },
        { label: 'Aktive Aufgaben', value: simulation.activeTasks.length },
        { label: 'Freie Maschinen', value: Object.values(simulation.maschinenStatus).filter(m => m.frei && m.verfuegbar).length },
        { label: 'Gesamte Maschinen', value: Object.keys(simulation.maschinenStatus).length },
        { label: 'Simulationstag', value: simulation.currentDay },
        { label: 'Intervall', value: `${simulation.intervalMs / 1000}s` }
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

    // Recent activities (if any)
    if (simulation.recentActivities && simulation.recentActivities.length > 0) {
        currentY += 20;
        ctx.fillStyle = COLORS.text.primary;
        ctx.font = 'bold 14px Arial';
        ctx.fillText('🔔 Ereignisse', panelX + 10, currentY);

        currentY += 20;
        simulation.recentActivities.slice(-5).forEach(activity => {
            ctx.fillStyle = COLORS.text.secondary;
            ctx.font = '10px Arial';

            // Wrap text if too long
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