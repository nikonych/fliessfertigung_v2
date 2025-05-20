import { Maschine } from '../data/Maschine.js';
import { Auftrag } from '../data/Auftrag.js';
import { Arbeitsplan } from '../data/Arbeitsplan.js';
import { importExcelToDatabase } from '../data/importExcel.js';
import { checkDatabase } from './check.js';  // если используется
import { getMaschineList } from './maschine.js';  // если используется

document.addEventListener("DOMContentLoaded", () => {
  const simulationBtn = document.getElementById("btn-simulation");
  const datenBtn = document.getElementById("btn-daten");
  const berichteBtn = document.getElementById("btn-berichte");
  const exitBtn = document.getElementById("btn-exit");
  console.log(getMaschineList())
  simulationBtn.addEventListener("click", () => {
    alert("Simulation gestartet!");
    // тут можно вызвать simulation()
  });

  datenBtn.addEventListener("click", () => {
    importExcelToDatabase('./21_Simulation_Fliessfertigung (2).xlsx', './manufacturing.db');
    alert("Daten importiert.");
  });

  berichteBtn.addEventListener("click", () => {
    alert("Berichte-Funktion noch nicht implementiert.");
  });

  exitBtn.addEventListener("click", () => {
    window.close(); // или через ipcRenderer — если ты хочешь завершить приложение полностью
  });
});
