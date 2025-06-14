
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

    function dateToExcel(dateStr) {
        const date = new Date(dateStr);
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const diffMs = date.getTime() - excelEpoch.getTime();
        return Math.floor(diffMs / 86400000);
    }

    let sortOrder = 1; // ascending
    let sortKey = null;

    const headers = ["Bezeichnung", "verf_von", "verf_bis", "Kap_Tag", "Aktion"];

    // Modal setup
    const modal = document.getElementById("modal");
    const bezeichnungInput = document.getElementById("edit-bezeichnung");
    const vonInput = document.getElementById("edit-von");
    const bisInput = document.getElementById("edit-bis");
    const kapInput = document.getElementById("edit-kap");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");

    let currentEdit = null;

    function openModal(maschine) {

        currentEdit = maschine;
        bezeichnungInput.value = maschine.Bezeichnung;
        vonInput.value = excelToDate(maschine.verf_von);
        bisInput.value = excelToDate(maschine.verf_bis);
        kapInput.value = maschine.Kap_Tag;
        modal.classList.remove("hidden");
    }

    function closeModal() {
        modal.classList.add("hidden");
        currentEdit = null;
    }

    async function handleDeleteMaschine(maschine) {
        const confirmed = confirm(`Möchtest du die Maschine "${maschine.Bezeichnung}" wirklich löschen?`);
        if (!confirmed) return;

        try {
            await window.electronAPI.deleteMaschine(maschine.Nr);
            maschinen = maschinen.filter(x => x.Nr !== maschine.Nr);
            renderGrid(search.value);
            showToast("Maschine gelöscht 🗑️");
        } catch (err) {

            alert(err.message || "Fehler beim Löschen");
            console.error(err);
        }
    }

    function showToast(message = "Gespeichert ✅") {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.classList.remove("hidden");
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
            toast.classList.add("hidden");
        }, 2500);
    }


    cancelBtn.onclick = () => closeModal();

    saveBtn.onclick = async () => {
        if (!currentEdit) return;

        const updated = {
            Bezeichnung: bezeichnungInput.value,
            verf_von: dateToExcel(vonInput.value),
            verf_bis: dateToExcel(bisInput.value),
            Kap_Tag: parseInt(kapInput.value, 10)
        };

        try {
            console.log("Saving update:", updated);
            await window.electronAPI.updateMaschine(currentEdit.Nr, updated);
            Object.assign(currentEdit, updated);
            renderGrid(search.value);
            showToast("Maschine gespeichert ✅");
            closeModal();
        } catch (e) {
            alert("Fehler beim Speichern");
            console.error(e);
        }
    };



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
            editBtn.onclick = () => openModal(m);
            editBtn.className = "btn edit";


            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Löschen";
            deleteBtn.className = "btn secondary";
            deleteBtn.onclick = () => handleDeleteMaschine(m);



            actionCell.appendChild(editBtn);
            actionCell.appendChild(deleteBtn);
            row.appendChild(actionCell);

            wrapper.appendChild(row);
        }

        container.appendChild(wrapper);
    };

    search.addEventListener("input", () => renderGrid(search.value));
    renderGrid();

}

