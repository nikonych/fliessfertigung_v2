const { getAuftragList } = require('../db/getA.js');

export function showAuftrage(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  let auftrage;

  try {
    auftrage = getAuftragList();
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    container.innerText = "Fehler beim Laden der Auftrage.";
    return;
  }

  if (!auftrage.length) {
    container.innerText = "Keine Maschinen gefunden.";
    return;
  }

  const table = document.createElement("table");
  table.border = "1";

  const header = document.createElement("tr");
  Object.keys(auftrage[0]).forEach(key => {
    const th = document.createElement("th");
    th.textContent = key;
    header.appendChild(th);
  });
  table.appendChild(header);

  auftrage.forEach(row => {
    const tr = document.createElement("tr");
    Object.values(row).forEach(val => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}
