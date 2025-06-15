// eventHandlers.js - Event handling logic
import { canvas } from './canvasSetup.js';
import { state } from './canvas.js';
import { groups, repositionBlocks } from './groupsConfig.js';

export function setupEventListeners() {
    let firstBlock = null; // Track the first block for swapping

    canvas.addEventListener("mousedown", (e) => {
        const mx = (e.offsetX - state.offsetX) / state.scale;
        const my = (e.offsetY - state.offsetY) / state.scale;

        const clickedBlock = state.blocks.find(
            b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
        );

        if (clickedBlock) {
            if (clickedBlock.type === "auftrag") {
                firstBlock = clickedBlock; // Set first block for potential swap
                if (!e.shiftKey) {
                    // Start dragging if not swapping
                    if (state.activeInfoBlockId === clickedBlock.id) {
                        state.activeInfoBlockId = null;
                    } else {
                        state.activeInfoBlockId = clickedBlock.id;
                    }
                    state.currentDragBlock = clickedBlock;
                    state.currentDragBlock.dragging = true;
                    state.currentDragBlock.offsetX = mx - state.currentDragBlock.x;
                    state.currentDragBlock.offsetY = my - state.currentDragBlock.y;
                    state.currentDragBlock.originalGroupId = state.currentDragBlock.groupId;
                }
            } else if (clickedBlock.type === "maschine") {
                // Handle Maschine block drag
                if (state.activeInfoBlockId === clickedBlock.id) {
                    state.activeInfoBlockId = null;
                } else {
                    state.activeInfoBlockId = clickedBlock.id;
                }
                state.currentDragBlock = clickedBlock;
                state.currentDragBlock.dragging = true;
                state.currentDragBlock.offsetX = mx - state.currentDragBlock.x;
                state.currentDragBlock.offsetY = my - state.currentDragBlock.y;
            }
        } else {
            state.activeInfoBlockId = null;
            state.dragMap = true;
            state.dragStart.x = e.offsetX;
            state.dragStart.y = e.offsetY;
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        const mx = (e.offsetX - state.offsetX) / state.scale;
        const my = (e.offsetY - state.offsetY) / state.scale;
        const dx = e.offsetX - state.dragStart.x;
        const dy = e.offsetY - state.dragStart.y;

        if (state.currentDragBlock && state.currentDragBlock.dragging) {
            state.currentDragBlock.x = mx - state.currentDragBlock.offsetX;
            state.currentDragBlock.y = my - state.currentDragBlock.offsetY;
        } else if (state.dragMap) {
            state.offsetX += dx;
            state.offsetY += dy;
            state.dragStart.x = e.offsetX;
            state.dragStart.y = e.offsetY;
        }
    });

    canvas.addEventListener("mouseup", () => {
        if (state.currentDragBlock && state.currentDragBlock.dragging) {
            if (state.currentDragBlock.type === "auftrag") {
                // Determine which group the block was dropped into
                const mx = (state.currentDragBlock.x + state.currentDragBlock.w / 2);
                const my = (state.currentDragBlock.y + state.currentDragBlock.h / 2);
                let newGroup = null;

                for (const group of groups) {
                    if (
                        mx >= group.x &&
                        mx <= group.x + group.width &&
                        my >= group.y &&
                        my <= group.y + group.height
                    ) {
                        newGroup = group;
                        break;
                    }
                }

                if (newGroup) {
                    state.currentDragBlock.groupId = newGroup.id;

                    // Найдём все блоки в новой группе
                    const groupBlocks = state.blocks.filter(b => b.type === "auftrag" && b.groupId === newGroup.id && b !== state.currentDragBlock);

                    // Найти ближайший блок по Y-позиции — туда вставим текущий
                    const insertIndex = groupBlocks.findIndex(b => state.currentDragBlock.y < b.y + b.h / 2);

                    // Удаляем текущий из массива
                    const currentIndex = state.blocks.indexOf(state.currentDragBlock);
                    if (currentIndex !== -1) state.blocks.splice(currentIndex, 1);

                    // Вставляем в нужную позицию
                    if (insertIndex === -1) {
                        // Вставить в конец
                        const lastIndex = Math.max(...state.blocks.map((b, i) => b.groupId === newGroup.id ? i : -1));
                        state.blocks.splice(lastIndex + 1, 0, state.currentDragBlock);
                    } else {
                        // Вставить перед найденным
                        const targetBlock = groupBlocks[insertIndex];
                        const targetIndex = state.blocks.indexOf(targetBlock);
                        state.blocks.splice(targetIndex, 0, state.currentDragBlock);
                    }

                } else {
                    state.currentDragBlock.groupId = state.currentDragBlock.originalGroupId;
                }

                repositionBlocks();

            }
            state.currentDragBlock.dragging = false;
        }
        state.dragMap = false;
        state.currentDragBlock = null;
    });

    canvas.addEventListener("mouseleave", () => {
        if (state.currentDragBlock) {
            if (state.currentDragBlock.type === "auftrag") {
                // Snap back to original group
                state.currentDragBlock.groupId = state.currentDragBlock.originalGroupId;
                repositionBlocks();
            }
            state.currentDragBlock.dragging = false;
        }
        state.dragMap = false;
        state.currentDragBlock = null;
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        const worldX = (mouseX - state.offsetX) / state.scale;
        const worldY = (mouseY - state.offsetY) / state.scale;
        const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        state.scale *= delta;
        state.offsetX = mouseX - worldX * state.scale;
        state.offsetY = mouseY - worldY * state.scale;
    }, {passive: false});
}