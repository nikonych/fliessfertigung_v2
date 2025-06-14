// groupsConfig.js - Groups configuration and management
import { state } from './canvas.js';

// Define Groups for Auftrag Blocks
export const groups = [
    {
        id: "auftraege",
        label: "Auftraege",
        x: 30,
        y: 50,
        width: 160, // Initial width, will be dynamic
        height: 100, // Fixed height since blocks are horizontal
        color: "#e0e0e0",
    },
];

// Function to reposition Auftrag blocks vertically within their groups and update group height
export function repositionBlocks() {
    groups.forEach(group => {
        const groupBlocks = state.blocks.filter(b => b.type === "auftrag" && b.groupId === group.id);
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

