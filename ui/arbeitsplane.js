// ui/arbeitsplaene.js

let arbeitsplaene = [];
let currentEditArbeitsplan = null;
let isNewArbeitsplan = false;

// Toast anzeigen
function showToast(message = "Gespeichert ✅") {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.classList.remove("hidden");
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.classList.add("hidden"), 300);
        }, 2500);
    }
}

// Modal öffnen
async function openArbeitsplanModal(arbeitsplan) {
    currentEditArbeitsplan = arbeitsplan;
    isNewArbeitsplan = arbeitsplan === null;

    const modal = document.getElementById("arbeitsplan-modal");
    const auftragSelect = document.getElementById("edit-arbeitsplan-auftrag-nr");
    const agInput = document.getElementById("edit-arbeitsplan-ag-nr");
    const maschineSelect = document.getElementById("edit-arbeitsplan-maschine");
    const dauerInput = document.getElementById("edit-arbeitsplan-dauer");

    // Aufträge laden
    try {
        const auftraege = await window.electronAPI.getAuftraege();
        auftragSelect.innerHTML = '<option value="">-- Bitte wählen --</option>';
        auftraege.forEach(a => {
            const option = document.createElement("option");
            option.value = a.auftrag_nr;
            option.textContent = `${a.auftrag_nr} (${a.Anzahl})`;
            auftragSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Fehler beim Laden der Aufträge:", e);
    }

    // Maschinen laden
    try {
        const maschinen = await window.electronAPI.getMaschinen();
        maschineSelect.innerHTML = '<option value="">-- Bitte wählen --</option>';
        maschinen.forEach(m => {
            const option = document.createElement("option");
            option.value = m.Nr;
            option.textContent = `${m.Nr} – ${m.Bezeichnung}`;
            maschineSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Fehler beim Laden der Maschinen:", e);
    }

    if (isNewArbeitsplan) {
        auftragSelect.value = "";
        agInput.value = "";
        maschineSelect.value = "";
        dauerInput.value = "";
        auftragSelect.disabled = false;
        agInput.disabled = false;
    } else {
        auftragSelect.value = arbeitsplan.auftrag_nr;
        agInput.value = arbeitsplan.ag_nr;
        maschineSelect.value = arbeitsplan.maschine;
        dauerInput.value = arbeitsplan.dauer;
        auftragSelect.disabled = true;
        agInput.disabled = true;
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeArbeitsplanModal() {
    const modal = document.getElementById("arbeitsplan-modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
    currentEditArbeitsplan = null;
    isNewArbeitsplan = false;
}

async function handleDeleteArbeitsplan(arbeitsplan) {
    const confirmed = confirm(`Möchten Sie den Arbeitsplan für Auftrag "${arbeitsplan.auftrag_nr}" und AG "${arbeitsplan.ag_nr}" wirklich löschen?`);
    if (!confirmed) return;

    if (window.electronAPI && window.electronAPI.deleteArbeitsplan) {
        await window.electronAPI.deleteArbeitsplan(arbeitsplan.auftrag_nr, arbeitsplan.ag_nr);
        arbeitsplaene = await window.electronAPI.getArbeitsplaene();
        renderArbeitsplaene();
        showToast("Arbeitsplan gelöscht 🗑️");
    }
}

function renderArbeitsplaene(filter = "") {
    const tbody = document.getElementById("arbeitsplaene-tbody");
    const loading = document.getElementById("arbeitsplaene-loading");
    const content = document.getElementById("arbeitsplaene-content");
    const empty = document.getElementById("arbeitsplaene-empty");

    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "none";
    if (content) content.style.display = "block";

    tbody.innerHTML = "";

    const filtered = arbeitsplaene.filter(ap => {
        return (ap.auftrag_nr && ap.auftrag_nr.toLowerCase().includes(filter.toLowerCase())) ||
               (ap.ag_nr && ap.ag_nr.toLowerCase().includes(filter.toLowerCase())) ||
               (ap.maschine && ap.maschine.toLowerCase().includes(filter.toLowerCase()));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #6c757d;">
            ${filter ? 'Keine Arbeitspläne gefunden' : 'Keine Arbeitspläne vorhanden'}
        </td></tr>`;
        return;
    }

    filtered.forEach(arbeitsplan => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td data-label="Auftrag Nr">${arbeitsplan.auftrag_nr}</td>
            <td data-label="AG Nr">${arbeitsplan.ag_nr}</td>
            <td data-label="Maschine">${arbeitsplan.maschine}</td>
            <td data-label="Dauer">${arbeitsplan.dauer}</td>
            <td data-label="Aktionen">
                <div class="action-buttons">
                    <button class="btn edit" onclick="window.editArbeitsplan('${arbeitsplan.auftrag_nr}', '${arbeitsplan.ag_nr}')">✏️ Bearbeiten</button>
                    <button class="btn secondary" onclick="window.deleteArbeitsplan('${arbeitsplan.auftrag_nr}', '${arbeitsplan.ag_nr}')">🗑️ Löschen</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function saveArbeitsplan() {
    const auftragSelect = document.getElementById("edit-arbeitsplan-auftrag-nr");
    const agInput = document.getElementById("edit-arbeitsplan-ag-nr");
    const maschineSelect = document.getElementById("edit-arbeitsplan-maschine");
    const dauerInput = document.getElementById("edit-arbeitsplan-dauer");

    if (!auftragSelect.value.trim() || !agInput.value.trim() || !maschineSelect.value.trim() || !dauerInput.value.trim()) {
        alert("Alle Felder sind erforderlich!");
        return;
    }

    const data = {
        auftrag_nr: auftragSelect.value.trim(),
        ag_nr: agInput.value.trim(),
        maschine: maschineSelect.value.trim(),
        dauer: parseInt(dauerInput.value, 10)
    };

    if (isNewArbeitsplan) {
        if (arbeitsplaene.some(ap => ap.auftrag_nr === data.auftrag_nr && ap.ag_nr === data.ag_nr)) {
            alert(`Arbeitsplan für Auftrag ${data.auftrag_nr} und AG ${data.ag_nr} bereits vorhanden!`);
            return;
        }
        if (window.electronAPI && window.electronAPI.addArbeitsplan) {
            await window.electronAPI.addArbeitsplan(data);
            arbeitsplaene = await window.electronAPI.getArbeitsplaene();
            showToast("Neuer Arbeitsplan erstellt ✅");
        }
    } else {
        if (window.electronAPI && window.electronAPI.updateArbeitsplan) {
            await window.electronAPI.updateArbeitsplan(currentEditArbeitsplan.auftrag_nr, currentEditArbeitsplan.ag_nr, data);
            arbeitsplaene = await window.electronAPI.getArbeitsplaene();
            showToast("Arbeitsplan gespeichert ✅");
        }
    }

    renderArbeitsplaene();
    closeArbeitsplanModal();
}

window.editArbeitsplan = function(auftragNr, agNr) {
    const arbeitsplan = arbeitsplaene.find(ap => ap.auftrag_nr === auftragNr && ap.ag_nr === agNr);
    if (arbeitsplan) openArbeitsplanModal(arbeitsplan);
};

window.deleteArbeitsplan = function(auftragNr, agNr) {
    const arbeitsplan = arbeitsplaene.find(ap => ap.auftrag_nr === auftragNr && ap.ag_nr === agNr);
    if (arbeitsplan) handleDeleteArbeitsplan(arbeitsplan);
};

export async function showArbeitsplaene(containerId) {
    const container = containerId ? document.getElementById(containerId) : document.getElementById("arbeitsplaene-tbody");
    if (!container) return console.error("Arbeitspläne-Container nicht gefunden.");

    if (window.electronAPI && window.electronAPI.getArbeitsplaene) {
        arbeitsplaene = await window.electronAPI.getArbeitsplaene();
    }

    const searchInput = document.getElementById("arbeitsplan-search");
    const addBtn = document.getElementById("add-arbeitsplan-btn");
    const addEmptyBtn = document.getElementById("add-arbeitsplan-empty-btn");
    const saveBtn = document.getElementById("arbeitsplan-save-btn");
    const cancelBtn = document.getElementById("arbeitsplan-cancel-btn");
    const modal = document.getElementById("arbeitsplan-modal");

    if (searchInput) {
        searchInput.addEventListener("input", e => {
            renderArbeitsplaene(e.target.value);
        });
    }

    if (addBtn) addBtn.onclick = () => openArbeitsplanModal(null);
    if (addEmptyBtn) addEmptyBtn.onclick = () => openArbeitsplanModal(null);
    if (saveBtn) saveBtn.onclick = () => saveArbeitsplan();
    if (cancelBtn) cancelBtn.onclick = () => closeArbeitsplanModal();

    if (modal) {
        modal.addEventListener("click", e => {
            if (e.target === modal) closeArbeitsplanModal();
        });
    }

    renderArbeitsplaene();

    return {
        refresh: async () => {
            if (window.electronAPI && window.electronAPI.getArbeitsplaene) {
                arbeitsplaene = await window.electronAPI.getArbeitsplaene();
                renderArbeitsplaene();
            }
        },
        setData: (data) => {
            arbeitsplaene = data;
            renderArbeitsplaene();
        }
    };
}