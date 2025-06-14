export async function showArbeitsplaene(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    let arbeitsplaene;
    try {
        arbeitsplaene = await window.electronAPI.getArbeitsplaene();
        console.log(arbeitsplaene);
    } catch (e) {
        container.innerText = "Fehler beim Laden der Arbeitspläne";
        return;
    }

    // 🔍 Suchfeld
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "🔍 Suche nach Auftrag oder AG-Nr...";
    search.style = "margin-bottom: 10px; padding: 8px; width: 100%;";

    function excelToDate(serial) {
        if (!serial) return "";
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + serial * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    let sortOrder = 1; // ascending
    let sortKey = null;

    const modal = document.getElementById("arbeitsplan-modal");
    const maschineInput = document.getElementById("edit-maschine");
    const dauerInput = document.getElementById("edit-dauer");
    const saveBtn = document.getElementById("arbeitsplan-save-btn");
    const cancelBtn = document.getElementById("arbeitsplan-cancel-btn");

    let currentEdit = null;

    async function openModal(ap) {
        currentEdit = ap || {};

        modal.classList.remove("hidden");

        try {
            const maschinen = await window.electronAPI.getMaschinen();
            const select = document.getElementById("edit-maschine");

            select.innerHTML = '<option value="">-- Bitte wählen --</option>';
            maschinen.forEach(m => {
                const option = document.createElement("option");
                option.value = m.Nr;
                option.textContent = `${m.Nr} – ${m.Bezeichnung}`;
                if (m.Nr === currentEdit.maschine) option.selected = true;
                select.appendChild(option);
            });

            dauerInput.value = currentEdit.dauer ?? "";
        } catch (e) {
            console.error("Fehler beim Laden der Maschinen:", e);
            alert("Maschinen konnten nicht geladen werden.");
        }
    }


    function closeModal() {
        modal.classList.add("hidden");
        currentEdit = null;
    }

    cancelBtn.onclick = () => closeModal();

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

    saveBtn.onclick = async () => {
        const maschine = document.getElementById("edit-maschine").value;
        const dauer = parseInt(document.getElementById("edit-dauer").value, 10);

        if (!maschine || isNaN(dauer)) {
            alert("Alle Felder müssen ausgefüllt sein.");
            return;
        }

        const plan = {
            auftrag_nr: currentEdit.auftrag_nr,
            ag_nr: currentEdit.ag_nr,
            maschine,
            dauer
        };

        try {
            if (currentEdit && currentEdit.auftrag_nr && currentEdit.ag_nr && !currentEdit._isNew) {
                // Update
                await window.electronAPI.updateArbeitsplan(currentEdit.auftrag_nr, currentEdit.ag_nr, plan);
                Object.assign(currentEdit, plan);
            } else {
                // Add
                await window.electronAPI.addArbeitsplan(plan);
                arbeitsplaene.push(plan);
            }


            renderGrid(search.value);
            closeModal();
            showToast("Gespeichert ✅");
        } catch (e) {
            alert("Fehler beim Speichern");
            console.error(e);
        }
    };


    async function handleDeleteArbeitsplan(ap) {
        const confirmed = confirm(`Arbeitsplan für Auftrag "${ap.auftrag_nr}" und AG "${ap.ag_nr}" löschen?`);
        if (!confirmed) return;

        try {
            await window.electronAPI.deleteArbeitsplan(ap.auftrag_nr, ap.ag_nr);
            arbeitsplaene = arbeitsplaene.filter(x =>
                !(x.auftrag_nr === ap.auftrag_nr && x.ag_nr === ap.ag_nr)
            );
            renderGrid(search.value);
            showToast("Arbeitsplan gelöscht 🗑️");
        } catch (e) {
            alert("Fehler beim Löschen");
            console.error(e);
        }
    }

    function generateNextAuftragNr(lastNr) {
        const prefix = "A";
        let number = parseInt(lastNr.slice(1)) + 1;
        return prefix + number.toString().padStart(5, "0");
    }


    document.getElementById("new-auftrag-create").onclick = async () => {
        try {
            const last = await window.electronAPI.getLastAuftragNr(); // типа A00001 → A00002
            const newNr = generateNextAuftragNr(last);

            await window.electronAPI.addAuftrag({
                auftrag_nr: newNr,
                Anzahl: 0,
                Start: 0
            });

            const select = document.getElementById("new-auftrag-select");
            const option = document.createElement("option");
            option.value = newNr;
            option.textContent = `${newNr} (0)`;
            option.selected = true;
            select.appendChild(option);
        } catch (e) {
            alert("Fehler beim Erstellen eines neuen Auftrags.");
            console.error(e);
        }
    };

    async function openAddModal() {
        const modal = document.getElementById("add-ap-modal");
        const auftragSelect = document.getElementById("new-auftrag-select");
        const agInput = document.getElementById("new-ag-nr");

        auftragSelect.innerHTML = "";
        agInput.value = "";

        try {
            const auftraege = await window.electronAPI.getAuftraege();
            auftraege.forEach(a => {
                const option = document.createElement("option");
                option.value = a.auftrag_nr;
                option.textContent = `${a.auftrag_nr} (${a.Anzahl})`;
                auftragSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Fehler beim Laden der Aufträge", e);
        }

        modal.classList.remove("hidden");

        const confirmBtn = document.getElementById("add-ap-confirm");
        const cancelBtn = document.getElementById("add-ap-cancel");

        confirmBtn.onclick = () => {
            const auftragNr = auftragSelect.value;
            const agNr = agInput.value.trim();

            if (!auftragNr || !agNr) {
                alert("Auftrag und AG-Nr müssen ausgefüllt werden.");
                return;
            }

            modal.classList.add("hidden");

            openModal({
                auftrag_nr: auftragNr,
                ag_nr: agNr,
                maschine: null,
                dauer: null,
                _isNew: true
            });
        };

        cancelBtn.onclick = () => modal.classList.add("hidden");
    }

    const renderGrid = (filterText = "") => {
        container.innerHTML = "";
        container.appendChild(search);

        const addBtn = document.createElement("button");
        addBtn.textContent = "➕ Neuer Arbeitsplan";
        addBtn.className = "btn primary";
        addBtn.style.marginBottom = "10px";
        addBtn.onclick = openAddModal;
        container.appendChild(addBtn);
        const wrapper = document.createElement("div");
        wrapper.className = "grid-wrapper";

        const headers = ["Auftrag Nr", "AG Nr", "Maschine", "Dauer"];
        const headerRow = document.createElement("div");
        headerRow.className = "grid-row header";

        for (const key of headers) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.textContent = key;
            headerRow.appendChild(cell);
        }
        wrapper.appendChild(headerRow);

        let filtered = arbeitsplaene.filter(ap =>
            (ap.auftrag_nr && ap.auftrag_nr.toString().toLowerCase().includes(filterText.toLowerCase())) ||
            (ap.ag_nr && ap.ag_nr.toString().toLowerCase().includes(filterText.toLowerCase())) ||
            (ap.maschine && ap.maschine.toLowerCase().includes(filterText.toLowerCase())) ||
            (ap.dauer && ap.dauer.toString().toLowerCase().includes(filterText.toLowerCase()))
        );

        if (sortKey) {
            filtered.sort((a, b) => {
                const valA = a[sortKey];
                const valB = b[sortKey];
                return (valA > valB ? 1 : -1) * sortOrder;
            });
        }

        for (const ap of filtered) {
            const row = document.createElement("div");
            row.className = "grid-row";

            const fields = [
                ap.auftrag_nr || "",
                ap.ag_nr || "",
                ap.maschine || "",
                ap.dauer || "",
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
            editBtn.onclick = () => openModal(ap);
            editBtn.className = "btn edit";

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Löschen";
            deleteBtn.onclick = () => handleDeleteArbeitsplan(ap);
            deleteBtn.className = "btn secondary";

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