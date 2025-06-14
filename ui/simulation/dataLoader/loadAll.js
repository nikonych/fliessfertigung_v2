import { loadMachines } from './machinesLoader.js';
import { loadAuftraege } from './auftraegeLoader.js';
import { repositionBlocks } from '../groupsConfig.js';

export async function loadData() {
    console.log("Loading data...");
    try {
        await loadMachines();
        await loadAuftraege();
        repositionBlocks();
    } catch (err) {
        console.error("Error loading data:", err.message);
        alert("Fehler beim Laden der Daten: " + err.message);
    }
}
