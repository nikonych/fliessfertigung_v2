const { getArbeitsplanList } = require('../db/getArbeitsplan.js');

export function showArbeitsplan(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  let arbeitsplane;
  try {
    arbeitsplane = getArbeitsplanList();
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    container.innerText = "Fehler beim Laden der Arbeitspläne.";
    return;
  }

  if (!arbeitsplane.length) {
    container.innerText = "Keine Arbeitspläne gefunden.";
    return;
  }

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "🔍 Suche nach Auftrag-Nr...";
  search.style = "margin-bottom: 10px; padding: 8px; width: 100%;";

  const headers = ["auftrag_nr", "ag_nr", "maschine", "dauer"];

  const renderGrid = (filter = "") => {
    container.innerHTML = "";
    container.appendChild(search);

    const wrapper = document.createElement("div");
    wrapper.className = "grid-wrapper";

    const headerRow = document.createElement("div");
    headerRow.className = "grid-row header";
    headers.concat("Aktion").forEach(key => {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.textContent = key;
      headerRow.appendChild(cell);
    });
    wrapper.appendChild(headerRow);

    arbeitsplane
      .filter(p => p.auftrag_nr.toLowerCase().includes(filter.toLowerCase()))
      .forEach(p => {
        const row = document.createElement("div");
        row.className = "grid-row";

        headers.forEach(k => {
          const cell = document.createElement("div");
          cell.className = "grid-cell";
          cell.textContent = p[k];
          row.appendChild(cell);
        });

        const actionCell = document.createElement("div");
        actionCell.className = "grid-cell";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Bearbeiten";
        editBtn.className = "btn edit";
        editBtn.onclick = () => console.log("Edit", p);

        actionCell.appendChild(editBtn);
        row.appendChild(actionCell);
        wrapper.appendChild(row);
      });

    container.appendChild(wrapper);
  };

  search.addEventListener("input", () => renderGrid(search.value));
  renderGrid();
}
