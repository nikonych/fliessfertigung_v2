
export async function showAuftrage(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  let auftrage;
  try {
    auftrage = await window.electronAPI.getAuftraege();
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    container.innerText = "Fehler beim Laden der Aufträge.";
    return;
  }

  if (!auftrage.length) {
    container.innerText = "Keine Aufträge gefunden.";
    return;
  }

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "🔍 Suche nach Auftrags-Nr...";
  search.style = "margin-bottom: 10px; padding: 8px; width: 100%;";

  const headers = ["auftrag_nr", "Anzahl", "Start"];

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

    auftrage
      .filter(a => a.auftrag_nr.toLowerCase().includes(filter.toLowerCase()))
      .forEach(a => {
        const row = document.createElement("div");
        row.className = "grid-row";

        headers.forEach(k => {
          const cell = document.createElement("div");
          cell.className = "grid-cell";
          cell.textContent = a[k];
          row.appendChild(cell);
        });

        const actionCell = document.createElement("div");
        actionCell.className = "grid-cell";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Bearbeiten";
        editBtn.className = "btn edit";
        editBtn.onclick = () => console.log("Edit", a);

        actionCell.appendChild(editBtn);
        row.appendChild(actionCell);
        wrapper.appendChild(row);
      });

    container.appendChild(wrapper);
  };

  search.addEventListener("input", () => renderGrid(search.value));
  renderGrid();
}
