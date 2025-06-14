import { state } from '../canvas.js';
import { groups } from '../groupsConfig.js';
import { getOrderList } from '../dbAdapter.js';

export async function loadAuftraege() {
    const auftraege = await getOrderList();
    console.log("Auftraege loaded:", auftraege);

    const groupId = "auftraege";
    const group = groups.find(g => g.id === groupId);
    const ax = group?.x ?? 250;
    const ay = group?.y ?? 350;

    auftraege.forEach((a, index) => {
        const x = ax + (index % 4) * 200;
        const y = ay + Math.floor(index / 4) * 100;

        state.blocks.push({
            id: "a" + index,
            label: a.auftrag_nr || `Auftrag ${index + 1}`,
            x,
            y,
            w: 140,
            h: 60,
            color: "darkorange",
            dragging: false,
            type: "auftrag",
            groupId: groupId,
            anzahl: a.Anzahl,
            start: a.Start,
            originalX: x,
            originalY: y,
        });
    });
}
