const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const {getMaschineList} = require("../db/getMaschinen.js"); // путь может отличаться

let offsetX = 0, offsetY = 0;
let scale = 1;


let activeInfoBlockId = null; // id блока, у которого открыта карточка

let dragMap = false;
let dragStart = {x: 0, y: 0};

let blocks = [];
let connections = []; // пока нет связи, можно позже построить по плану

let currentDragBlock = null;

function excelToDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}


function draw() {
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.clearRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);

    // Связи (если нужно)
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

    // Блоки
    for (const block of blocks) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = "white";
        ctx.font = "16px sans-serif";
        ctx.fillText(block.label, block.x + 10, block.y + 35);
    }

    requestAnimationFrame(draw);
    // Отображаем информационную карточку
    if (activeInfoBlockId !== null) {
        const block = blocks.find(b => b.id === activeInfoBlockId);
        if (block) {
            const infoX = block.x + block.w + 10;
            const infoY = block.y;

            ctx.fillStyle = "white";
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1;
            ctx.fillRect(infoX, infoY, 180, 90);
            ctx.strokeRect(infoX, infoY, 180, 90);

            ctx.fillStyle = "black";
            ctx.font = "14px sans-serif";
            ctx.fillText(`Name: ${block.label}`, infoX + 10, infoY + 25);
            ctx.fillText(`Kapazität: ${block.kap_tag} Tag`, infoX + 10, infoY + 45);
            ctx.fillText(`Von: ${excelToDate(block.verf_von)}`, infoX + 10, infoY + 65);
            ctx.fillText(`Bis: ${excelToDate(block.verf_bis)}`, infoX + 10, infoY + 85);

        }
    }

}

canvas.addEventListener("mousedown", (e) => {
    const mx = (e.offsetX - offsetX) / scale;
    const my = (e.offsetY - offsetY) / scale;

    currentDragBlock = blocks.find(b =>
        mx >= b.x && mx <= b.x + b.w &&
        my >= b.y && my <= b.y + b.h
    );

    if (currentDragBlock) {
        // Проверка на клик по тому же блоку — для переключения карточки
        if (activeInfoBlockId === currentDragBlock.id) {
            activeInfoBlockId = null;
        } else {
            activeInfoBlockId = currentDragBlock.id;
        }

        currentDragBlock.dragging = true;
        currentDragBlock.offsetX = mx - currentDragBlock.x;
        currentDragBlock.offsetY = my - currentDragBlock.y;
    } else {
        activeInfoBlockId = null; // клик вне — закрываем инфо
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
    }
});

canvas.addEventListener("mouseup", () => {
    dragMap = false;
    if (currentDragBlock) currentDragBlock.dragging = false;
    currentDragBlock = null;
});

canvas.addEventListener("mouseleave", () => {
    dragMap = false;
    if (currentDragBlock) currentDragBlock.dragging = false;
    currentDragBlock = null;
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

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

// Загружаем реальные данные из БД
function loadBlocksFromDB() {
    try {
        const machines = getMaschineList();
        let x = 100, y = 100;

        blocks = machines.map((m, index) => ({
            id: index + 1,
            label: m.Bezeichnung || `Maschine ${index + 1}`,
            x: x + (index * 220),
            y: y + ((index % 2) * 150),
            w: 140,
            h: 60,
            color: "steelblue",
            dragging: false,
            // 👇 добавляем дополнительные поля из БД
            verf_von: m.verf_von,
            verf_bis: m.verf_bis,
            kap_tag: m.Kap_Tag
        }));
    } catch (err) {
        alert("Fehler beim Laden der Maschinen: " + err.message);
        console.error(err);
    }
}


loadBlocksFromDB();
draw();
