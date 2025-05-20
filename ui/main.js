// ui/main.js
import { navigateTo } from './router.js';

document.addEventListener("DOMContentLoaded", () => {
  const simulationBtn = document.getElementById("btn-simulation");
  const datenBtn = document.getElementById("btn-daten");
  const berichteBtn = document.getElementById("btn-berichte");
  const exitBtn = document.getElementById("btn-exit");

  if (simulationBtn)
    simulationBtn.addEventListener("click", () => navigateTo("simulation.html"));

  if (datenBtn)
    datenBtn.addEventListener("click", () => navigateTo("daten.html"));

  if (berichteBtn)
    berichteBtn.addEventListener("click", () => navigateTo("berichte.html"));

  if (exitBtn)
    exitBtn.addEventListener("click", () => window.close());
});
