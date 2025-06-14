export async function showArbeitsplaeneForAuftrag(containerId, auftragNr) {
    console.log("📂 showArbeitsplaeneForAuftrag aufgerufen mit", auftragNr);
    const container = document.getElementById(containerId);
    container.innerHTML = `<h3>Arbeitspläne für Auftrag ${auftragNr}</h3>`;

    let alleArbeitsplaene;
    try {
        alleArbeitsplaene = await window.electronAPI.getArbeitsplaene();
    } catch (e) {
        container.innerText = "Fehler beim Laden der Arbeitspläne";
        return;
    }

    const gefiltert = alleArbeitsplaene.filter(ap => ap.auftrag_nr === auftragNr);

    if (gefiltert.length === 0) {
        container.innerHTML += "<p>Keine Arbeitspläne gefunden.</p>";
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "grid-wrapper";

    const headerRow = document.createElement("div");
    headerRow.className = "grid-row header";
    ["AG-Nr", "Maschine", "Dauer"].forEach(t => {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.textContent = t;
        headerRow.appendChild(cell);
    });
    wrapper.appendChild(headerRow);

    for (const ap of gefiltert) {
        const row = document.createElement("div");
        row.className = "grid-row";

        const cells = [
            ap.ag_nr || "",
            ap.maschine || "",
            ap.dauer || ""
        ];

        cells.forEach(val => {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.textContent = val;
            row.appendChild(cell);
        });

        wrapper.appendChild(row);
    }

    container.appendChild(wrapper);
}
