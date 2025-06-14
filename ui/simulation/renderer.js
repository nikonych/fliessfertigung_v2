// renderer.js - Canvas rendering logic
import { canvas, ctx } from './canvasSetup.js';
import { state } from './canvas.js';
import { groups } from './groupsConfig.js';
import { excelToDate } from './utils.js';

export function draw() {
    console.log("Drawing frame...");
    ctx.setTransform(state.scale, 0, 0, state.scale, state.offsetX, state.offsetY);
    ctx.clearRect(-state.offsetX / state.scale, -state.offsetY / state.scale, canvas.width / state.scale, canvas.height / state.scale);

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
    for (const [fromId, toId] of state.connections) {
        const from = state.blocks.find(b => b.id === fromId);
        const to = state.blocks.find(b => b.id === toId);
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
    for (const block of state.blocks) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = "white";
        ctx.font = "16px sans-serif";
        ctx.fillText(block.label, block.x + 10, block.y + 35);
    }

    // Draw info card
    if (state.activeInfoBlockId !== null) {
        const block = state.blocks.find(b => b.id === state.activeInfoBlockId);
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