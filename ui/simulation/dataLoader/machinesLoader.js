import { state } from '../canvas.js';
import { getMachineList } from './dbAdapter.js';

export async function loadMachines() {
    const machines = await getMachineList();
    console.log("Machines loaded:", machines);

    let mx = 250, my = 120;
    machines.forEach((m, index) => {
        state.blocks.push({
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
}
