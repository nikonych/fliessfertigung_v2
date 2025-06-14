import {showArbeitsplaeneForAuftrag} from "./arbeitsplaeneforauftrag.js";

export async function showAuftraege(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    let auftraege;
    try {
        auftraege = await window.electronAPI.getAuftraege();
        console.log(auftraege);
    } catch (e) {
        container.innerText = "Fehler beim Laden der Aufträge";
        return;
    }

    // 🔍 Suchfeld
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "🔍 Suche nach Auftrag Nr ";
    search.style = "margin-bottom: 10px; padding: 8px; width: 100%;";


    let sortOrder = 1; // ascending
    let sortKey = null;



    // Modal setup
    const modal = document.getElementById("auftrag-modal");
    const auftragNrInput = document.getElementById("edit-auftrag-nr");
    const anzahlInput = document.getElementById("edit-anzahl");
    const startInput = document.getElementById("edit-start");
    const saveBtn = document.getElementById("auftrag-save-btn");
    const cancelBtn = document.getElementById("auftrag-cancel-btn");

    let currentEdit = null;

    function openAuftragModal(auftrag) {
        currentEdit = auftrag;
        auftragNrInput.value = auftrag.auftrag_nr;
        anzahlInput.value = auftrag.Anzahl ?? "";
        startInput.value = auftrag.Start ?? "";
        modal.classList.remove("hidden");
    }

    async function handleDeleteAuftrag(auftrag) {
        const confirmed = confirm(`Möchtest du den Auftrag "${auftrag.auftrag_nr}" wirklich löschen?`);
        if (!confirmed) return;

        try {
            await window.electronAPI.deleteAuftrag(auftrag.auftrag_nr);
            auftraege = auftraege.filter(a => a.auftrag_nr !== auftrag.auftrag_nr);
            renderGrid(search.value);
            showToast("Auftrag gelöscht 🗑️");
        } catch (err) {
            alert(err.message || "Fehler beim Löschen");
            console.error(err);
        }
    }


    function closeAuftragModal() {
        modal.classList.add("hidden");
        currentEdit = null;
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


    cancelBtn.onclick = () => closeAuftragModal();

    saveBtn.onclick = async () => {
        if (!currentEdit) return;

        const updated = {
            auftrag_nr: currentEdit.auftrag_nr, // идентификатор
            Anzahl: parseInt(anzahlInput.value, 10),
            Start: parseInt(startInput.value, 10)
        };

        try {
            await window.electronAPI.updateAuftrag(currentEdit.auftrag_nr, {
                Anzahl: parseInt(anzahlInput.value, 10),
                Start: parseInt(startInput.value, 10)
            });

            Object.assign(currentEdit, updated);
            renderGrid(search.value);
            showToast("Auftrag gespeichert ✅");
            closeAuftragModal();
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

        const headers = ["Auftrag Nr", "Anzahl",  "Start"];
        const headerRow = document.createElement("div");
        headerRow.className = "grid-row header";

        for (const key of headers) {
            const cell = document.createElement("div");
            cell.className = "grid-cell";
            cell.textContent = key;
            headerRow.appendChild(cell);
        }
        wrapper.appendChild(headerRow);

        let filtered = auftraege.filter(a =>
            (a.auftrag_nr && a.auftrag_nr.toString().toLowerCase().includes(filterText.toLowerCase())) ||
            (a.Start && a.Start.toLowerCase().includes(filterText.toLowerCase())) ||
            (a.Anzahl && a.Anzahl.toLowerCase().includes(filterText.toLowerCase()))
        );

        if (sortKey) {
            filtered.sort((a, b) => {
                const valA = a[sortKey];
                const valB = b[sortKey];
                return (valA > valB ? 1 : -1) * sortOrder;
            });
        }

        for (const a of filtered) {
            const row = document.createElement("div");
            row.className = "grid-row";

            const fields = [
                a.auftrag_nr || "",
                a.Anzahl || "",
                a.Start || ""
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
            editBtn.onclick = () => openAuftragModal(a);
            editBtn.className = "btn edit";


            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Löschen";
            deleteBtn.className = "btn secondary";
            deleteBtn.onclick = () => handleDeleteAuftrag(a);

            const anzeigenBtn = document.createElement("button");
            anzeigenBtn.textContent = "Anzeigen";
            anzeigenBtn.className = "btn detail";
            anzeigenBtn.onclick = () => {
                console.log("📦 Anzeigen geklickt für", a.auftrag_nr);

                document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));

                document.querySelector('.tab[data-tab="arbeitsplan"]').classList.add("active");
                document.getElementById("arbeitsplan").classList.add("active");

                // Теперь вызов
                showArbeitsplaeneForAuftrag(a.auftrag_nr);
            };

            actionCell.appendChild(anzeigenBtn);
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