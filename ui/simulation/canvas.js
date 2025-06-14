import { setupCanvas } from './canvasSetup.js';
import { setupEventListeners } from './eventHandlers.js';
import { loadData } from './dataLoader/loadAll.js';
import { draw } from './renderer.js';

export let state = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    activeInfoBlockId: null,
    dragMap: false,
    dragStart: { x: 0, y: 0 },
    blocks: [],
    connections: [],
    currentDragBlock: null
};

console.log("Initializing...");
setupCanvas();
setupEventListeners();
loadData().then(() => {
    console.log("Data loaded, starting draw...");
    draw();
});
