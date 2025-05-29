const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const {getMaschineList} = require("../db/getMaschinen.js");
const {getAuftragList} = require("../db/getAuftrag.js");

function excelToDate(serial) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
    return date.toISOString().split("T")[0];
}

function setupCanvas() {
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
}

// Define Groups for Auftrag Blocks
const groups = [
    {
        id: "startdaten",
        label: "Startdaten",
        x: 30,
        y: 50,
        width: 160, // Initial width, will be dynamic
        height: 100, // Fixed height since blocks are horizontal
        color: "#e0e0e0",
    },
    {
        id: "aktive_auftraege",
        label: "Aktive Aufträge",
        x: 250,
        y: 50, // Adjusted y position to be closer since height is fixed
        width: 160, // Initial width, will be dynamic
        height: 100, // Fixed height since blocks are horizontal
        color: "#e0e0e0",
    },
];

// Function to reposition Auftrag blocks vertically within their groups and update group height
function repositionBlocks() {
    groups.forEach(group => {
        const groupBlocks = blocks.filter(b => b.type === "auftrag" && b.groupId === group.id);
        const labelHeight = 24;
        const gap = 6;
        const padding = 6;

        let yOffset = group.y + labelHeight + gap;

        let totalHeight = 0;
        groupBlocks.forEach(block => {
            block.h = block.h || 60;  // Сделаем блоки немного ниже
            totalHeight += block.h;
        });

        const totalGap = gap * (Math.max(0, groupBlocks.length - 1));
        group.height = labelHeight + padding + totalHeight + totalGap + padding;

        yOffset = group.y + labelHeight + padding;

        groupBlocks.forEach(block => {
            block.x = group.x + 10;
            block.y = yOffset;
            block.originalX = block.x;
            block.originalY = block.y;
            yOffset += block.h + gap;
        });
    });
}


// Function to swap two blocks within the same group
function swapBlocks(block1, block2) {
    if (block1.type !== "auftrag" || block2.type !== "auftrag") return;

    // Если обе из одной группы
    if (block1.groupId === block2.groupId) {
        const groupId = block1.groupId;

        // Получаем подсписок этой группы (в порядке из blocks)
        const groupIndexes = [];
        const groupBlocks = [];

        blocks.forEach((b, i) => {
            if (b.type === "auftrag" && b.groupId === groupId) {
                groupIndexes.push(i);
                groupBlocks.push(b);
            }
        });

        const idx1 = groupBlocks.indexOf(block1);
        const idx2 = groupBlocks.indexOf(block2);

        if (idx1 === -1 || idx2 === -1) return;

        // Меняем местами только в подгруппе
        [groupBlocks[idx1], groupBlocks[idx2]] = [groupBlocks[idx2], groupBlocks[idx1]];

        // Подменяем в основном массиве
        groupIndexes.forEach((originalIdx, i) => {
            blocks[originalIdx] = groupBlocks[i];
        });

    } else {
        // Разные группы: просто поменять groupId и порядок в blocks
        const idx1 = blocks.indexOf(block1);
        const idx2 = blocks.indexOf(block2);
        if (idx1 === -1 || idx2 === -1) return;

        const tempGroupId = block1.groupId;
        block1.groupId = block2.groupId;
        block2.groupId = tempGroupId;

        [blocks[idx1], blocks[idx2]] = [blocks[idx2], blocks[idx1]];
    }

    repositionBlocks();
}


function draw() {
    console.log("Drawing frame...");
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);

    // Draw groups with dynamic widths
    for (const group of groups) {
        ctx.fillStyle = group.color;
        ctx.fillRect(group.x, group.y, group.width, group.height);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.strokeRect(group.x, group.y, group.width, group.height);
        ctx.fillStyle = "black";
        ctx.font = "18px sans-serif";
        ctx.fillText(group.label, group.x + 10, group.y + 25);
    }

    // Draw connections
    for (const [fromId, toId] of connections) {
        const from = blocks.find(b => b.id === fromId);
        const to = blocks.find(b => b.id === toId);
        if (from && to) {
            ctx.strokeStyle = "#888";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(from.x + from.w / 2, from.y + from.h / 2);
            ctx.lineTo(to.x + to.w / 2, to.y + to.h / 2);
            ctx.stroke();
        }
    }

    // Draw blocks
    for (const block of blocks) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = "white";
        ctx.font = "16px sans-serif";
        ctx.fillText(block.label, block.x + 10, block.y + 35);
    }

    // Draw info card
    if (activeInfoBlockId !== null) {
        const block = blocks.find(b => b.id === activeInfoBlockId);
        if (block) {
            const infoX = block.x + block.w + 10;
            const infoY = block.y;

            ctx.fillStyle = "white";
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1;
            ctx.fillRect(infoX, infoY, 180, block.type === "maschine" ? 90 : 70);
            ctx.strokeRect(infoX, infoY, 180, block.type === "maschine" ? 90 : 70);

            ctx.fillStyle = "black";
            ctx.font = "14px sans-serif";
            if (block.type === "maschine") {
                ctx.fillText(`Name: ${block.label}`, infoX + 10, infoY + 25);
                ctx.fillText(`Kapazität am Tag in h: ${block.kap_tag}`, infoX + 10, infoY + 45);
                ctx.fillText(`verfügbar von: ${excelToDate(block.verf_von)}`, infoX + 10, infoY + 65);
                ctx.fillText(`verfügbar Bis: ${excelToDate(block.verf_bis)}`, infoX + 10, infoY + 85);
            } else if (block.type === "auftrag") {
                ctx.fillText(`Auftrag Nr: ${block.label}`, infoX + 10, infoY + 25);
                ctx.fillText(`Anzahl: ${block.anzahl}`, infoX + 10, infoY + 45);
                ctx.fillText(`Start: ${excelToDate(block.start)}`, infoX + 10, infoY + 65);
            }
        }
    }

    requestAnimationFrame(draw);
}

function setupEventListeners() {
    let firstBlock = null; // Track the first block for swapping

    canvas.addEventListener("mousedown", (e) => {
        console.log("Mouse down:", e.offsetX, e.offsetY);
        const mx = (e.offsetX - offsetX) / scale;
        const my = (e.offsetY - offsetY) / scale;

        const clickedBlock = blocks.find(
            b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
        );

        if (clickedBlock) {
            console.log("Block selected:", clickedBlock.id);
            if (e.shiftKey && clickedBlock.type === "auftrag" && firstBlock && firstBlock !== clickedBlock) {
                // Swap with the second block
                swapBlocks(firstBlock, clickedBlock);
                firstBlock = null; // Reset after swap
            } else if (clickedBlock.type === "auftrag") {
                firstBlock = clickedBlock; // Set first block for potential swap
                if (!e.shiftKey) {
                    // Start dragging if not swapping
                    if (activeInfoBlockId === clickedBlock.id) {
                        activeInfoBlockId = null;
                    } else {
                        activeInfoBlockId = clickedBlock.id;
                    }
                    currentDragBlock = clickedBlock;
                    currentDragBlock.dragging = true;
                    currentDragBlock.offsetX = mx - currentDragBlock.x;
                    currentDragBlock.offsetY = my - currentDragBlock.y;
                    currentDragBlock.originalGroupId = currentDragBlock.groupId;
                }
            } else if (clickedBlock.type === "maschine") {
                // Handle Maschine block drag
                if (activeInfoBlockId === clickedBlock.id) {
                    activeInfoBlockId = null;
                } else {
                    activeInfoBlockId = clickedBlock.id;
                }
                currentDragBlock = clickedBlock;
                currentDragBlock.dragging = true;
                currentDragBlock.offsetX = mx - currentDragBlock.x;
                currentDragBlock.offsetY = my - currentDragBlock.y;
            }
        } else {
            console.log("Starting map drag");
            activeInfoBlockId = null;
            dragMap = true;
            dragStart.x = e.offsetX;
            dragStart.y = e.offsetY;
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        const mx = (e.offsetX - offsetX) / scale;
        const my = (e.offsetY - offsetY) / scale;
        const dx = e.offsetX - dragStart.x;
        const dy = e.offsetY - dragStart.y;

        if (currentDragBlock && currentDragBlock.dragging) {
            currentDragBlock.x = mx - currentDragBlock.offsetX;
            currentDragBlock.y = my - currentDragBlock.offsetY;
        } else if (dragMap) {
            offsetX += dx;
            offsetY += dy;
            dragStart.x = e.offsetX;
            dragStart.y = e.offsetY;
            console.log("Panning:", offsetX, offsetY);
        }
    });

    canvas.addEventListener("mouseup", () => {
        console.log("Mouse up");
        if (currentDragBlock && currentDragBlock.dragging) {
            if (currentDragBlock.type === "auftrag") {
                // Determine which group the block was dropped into
                const mx = (currentDragBlock.x + currentDragBlock.w / 2);
                const my = (currentDragBlock.y + currentDragBlock.h / 2);
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
                    currentDragBlock.groupId = newGroup.id;

                    // Найдём все блоки в новой группе
                    const groupBlocks = blocks.filter(b => b.type === "auftrag" && b.groupId === newGroup.id && b !== currentDragBlock);

                    // Найти ближайший блок по Y-позиции — туда вставим текущий
                    const insertIndex = groupBlocks.findIndex(b => currentDragBlock.y < b.y + b.h / 2);

                    // Удаляем текущий из массива
                    const currentIndex = blocks.indexOf(currentDragBlock);
                    if (currentIndex !== -1) blocks.splice(currentIndex, 1);

                    // Вставляем в нужную позицию
                    if (insertIndex === -1) {
                        // Вставить в конец
                        const lastIndex = Math.max(...blocks.map((b, i) => b.groupId === newGroup.id ? i : -1));
                        blocks.splice(lastIndex + 1, 0, currentDragBlock);
                    } else {
                        // Вставить перед найденным
                        const targetBlock = groupBlocks[insertIndex];
                        const targetIndex = blocks.indexOf(targetBlock);
                        blocks.splice(targetIndex, 0, currentDragBlock);
                    }

                } else {
                    currentDragBlock.groupId = currentDragBlock.originalGroupId;
                }

                repositionBlocks();

            }
            currentDragBlock.dragging = false;
        }
        dragMap = false;
        currentDragBlock = null;
    });

    canvas.addEventListener("mouseleave", () => {
        console.log("Mouse leave");
        if (currentDragBlock) {
            if (currentDragBlock.type === "auftrag") {
                // Snap back to original group
                currentDragBlock.groupId = currentDragBlock.originalGroupId;
                repositionBlocks();
            }
            currentDragBlock.dragging = false;
        }
        dragMap = false;
        currentDragBlock = null;
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        console.log("Wheel event:", e.deltaY);
        const zoomFactor = 1.1;
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        const worldX = (mouseX - offsetX) / scale;
        const worldY = (mouseY - offsetY) / scale;
        const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        scale *= delta;
        offsetX = mouseX - worldX * scale;
        offsetY = mouseY - worldY * scale;
    }, {passive: false});
}

async function loadData() {
    console.log("Loading data...");
    try {
        const machines = await getMaschineList();
        console.log("Machines loaded:", machines);
        const auftraege = await getAuftragList();
        console.log("Auftraege loaded:", auftraege);

        // Load Maschine blocks
        let mx = 250,
            my = 120;
        machines.forEach((m, index) => {
            blocks.push({
                id: "m" + index,
                label: m.Bezeichnung || `Maschine ${index + 1}`,
                x: mx + index * 200,
                y: my,
                w: 140,
                h: 60,
                color: "steelblue",
                dragging: false,
                type: "maschine",
                verf_von: m.verf_von,
                verf_bis: m.verf_bis,
                kap_tag: m.Kap_Tag,
            });
        });

        // Load Auftrag blocks and assign to groups
        auftraege.forEach((a, index) => {
            const groupId = index % 2 === 0 ? "startdaten" : "aktive_auftraege";
            const group = groups.find(g => g.id === groupId);

            const ax = group.x + 10;
            const ay = group.y + 40;

            blocks.push({
                id: "a" + index,
                label: a.auftrag_nr || `Auftrag ${index + 1}`,
                x: ax,
                y: ay,
                w: 140,
                h: 60,
                color: "darkorange",
                dragging: false,
                type: "auftrag",
                groupId: groupId,
                anzahl: a.Anzahl,
                start: a.Start,
                originalX: ax,
                originalY: ay,
            });
        });

        // Initial repositioning of Auftrag blocks
        repositionBlocks();
    } catch (err) {
        console.error("Error loading data:", err.message);
        alert("Fehler beim Laden der Daten: " + err.message);
    }
}

// Global State
let offsetX = 0,
    offsetY = 0;
let scale = 1;
let activeInfoBlockId = null;
let dragMap = false;
let dragStart = {x: 0, y: 0};
let blocks = [];
let connections = [];
let currentDragBlock = null;

// Initialize
console.log("Initializing...");
setupCanvas();
setupEventListeners();
loadData().then(() => {
    console.log("Data loaded, starting draw...");
    draw();
});