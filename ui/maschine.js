
export async function showMaschinen(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    let maschinen;
    try {
        maschinen = await window.electronAPI.getMaschinen();
        console.log(maschinen);
    } catch (e) {
        container.innerText = "Fehler beim Laden";
        return;
    }


    // 🔍 Suchfeld
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "🔍 Suche nach Bezeichnung...";
    search.style = "margin-bottom: 10px; padding: 8px; width: 100%;";

    function excelToDate(serial) {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    let sortOrder = 1; // ascending
    let sortKey = null;

    const headers = ["Bezeichnung", "verf_von", "verf_bis", "Kap_Tag", "Aktion"];

    const renderGrid = (filterText = "") => {
        container.innerHTML = "";
        container.appendChild(search);

        const wrapper = document.createElement("div");
        wrapper.className = "grid-wrapper";

        const headers = ["Bezeichnung", "verf_von", "verf_bis", "Kap_Tag", "Aktion"];
        const headerRow = document.createElement("div");
        headerRow.className = "grid-row header";

        for (const key of headers) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.textContent = key;
            headerRow.appendChild(cell);
        }
        wrapper.appendChild(headerRow);

        let filtered = maschinen.filter(m =>
            m.Bezeichnung.toLowerCase().includes(filterText.toLowerCase())
        );

        if (sortKey) {
            filtered.sort((a, b) => {
                const valA = a[sortKey];
                const valB = b[sortKey];
                return (valA > valB ? 1 : -1) * sortOrder;
            });
        }

        for (const m of filtered) {
            const row = document.createElement("div");
            row.className = "grid-row";

            const fields = [
                m.Bezeichnung,
                excelToDate(m.verf_von),
                excelToDate(m.verf_bis),
                m.Kap_Tag
            ];

            fields.forEach(val => {
                const cell = document.createElement("div");
                cell.className = "grid-cell";
                cell.textContent = val;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("div");
            actionCell.className = "grid-cell";

            const editBtn = document.createElement("button");
            editBtn.textContent = "Bearbeiten";
            editBtn.onclick = () => console.log("Edit", m);
            editBtn.className = "btn edit";


            actionCell.appendChild(editBtn);
            row.appendChild(actionCell);

            wrapper.appendChild(row);
        }

        container.appendChild(wrapper);
    };

    search.addEventListener("input", () => renderGrid(search.value));
    renderGrid();

}

