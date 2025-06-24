// ui/auftraege.js

let auftraege = [];
let currentEditAuftrag = null;
let isNewAuftrag = false;

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
function openAuftragModal(auftrag) {
    currentEditAuftrag = auftrag;
    isNewAuftrag = auftrag === null;

    const modal = document.getElementById("auftrag-modal");
    const nrInput = document.getElementById("edit-auftrag-nr");
    const anzahlInput = document.getElementById("edit-anzahl");
    const startInput = document.getElementById("edit-start");

    if (isNewAuftrag) {
        nrInput.value = "";
        anzahlInput.value = "1";
        startInput.value = "0";
        nrInput.disabled = false;
    } else {
        nrInput.value = auftrag.nr || auftrag.auftrag_nr;
        anzahlInput.value = auftrag.anzahl || auftrag.Anzahl;
        startInput.value = auftrag.start || auftrag.Start;
        nrInput.disabled = true;
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeAuftragModal() {
    const modal = document.getElementById("auftrag-modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
    currentEditAuftrag = null;
    isNewAuftrag = false;
}

async function handleDeleteAuftrag(auftrag) {
    const nr = auftrag.nr || auftrag.auftrag_nr;
    const confirmed = confirm(`Möchten Sie den Auftrag "${nr}" wirklich löschen?`);
    if (!confirmed) return;

    if (window.electronAPI && window.electronAPI.deleteAuftrag) {
        await window.electronAPI.deleteAuftrag(nr);
        auftraege = await window.electronAPI.getAuftraege();
        renderAuftraege();
        showToast("Auftrag gelöscht 🗑️");
    }
}

function renderAuftraege(filter = "") {
    const tbody = document.getElementById("auftraege-tbody");
    const loading = document.getElementById("auftraege-loading");
    const content = document.getElementById("auftraege-content");
    const empty = document.getElementById("auftraege-empty");

    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "none";
    if (content) content.style.display = "block";

    tbody.innerHTML = "";

    const filtered = auftraege.filter(a => {
        const nr = a.nr || a.auftrag_nr;
        return nr && nr.toLowerCase().includes(filter.toLowerCase());
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: #6c757d;">
            ${filter ? 'Keine Aufträge gefunden' : 'Keine Aufträge vorhanden'}
        </td></tr>`;
        return;
    }

    filtered.forEach(auftrag => {
        const nr = auftrag.nr || auftrag.auftrag_nr;
        const anzahl = auftrag.anzahl || auftrag.Anzahl;
        const start = auftrag.start || auftrag.Start;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td data-label="Auftrag Nr">${nr}</td>
            <td data-label="Anzahl">${anzahl}</td>
            <td data-label="Start">${start}</td>
            <td data-label="Aktionen">
                <div class="action-buttons">
                    <button class="btn edit" onclick="window.editAuftrag('${nr}')">✏️ Bearbeiten</button>
                    <button class="btn secondary" onclick="window.deleteAuftrag('${nr}')">🗑️ Löschen</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function saveAuftrag() {
    const nrInput = document.getElementById("edit-auftrag-nr");
    const anzahlInput = document.getElementById("edit-anzahl");
    const startInput = document.getElementById("edit-start");

    if (!nrInput.value.trim()) {
        alert("Auftrag Nr ist erforderlich!");
        return;
    }

    const data = {
        auftrag_nr: nrInput.value.trim(),
        Anzahl: parseInt(anzahlInput.value, 10),
        Start: parseInt(startInput.value, 10)
    };

    if (isNewAuftrag) {
        if (auftraege.some(a => (a.nr || a.auftrag_nr) === data.auftrag_nr)) {
            alert(`Auftrag Nr ${data.auftrag_nr} bereits vorhanden!`);
            return;
        }
        if (window.electronAPI && window.electronAPI.addAuftrag) {
            await window.electronAPI.addAuftrag(data);
            auftraege = await window.electronAPI.getAuftraege();
            showToast("Neuer Auftrag erstellt ✅");
        }
    } else {
        if (window.electronAPI && window.electronAPI.updateAuftrag) {
            await window.electronAPI.updateAuftrag(currentEditAuftrag.nr || currentEditAuftrag.auftrag_nr, data);
            auftraege = await window.electronAPI.getAuftraege();
            showToast("Auftrag gespeichert ✅");
        }
    }

    renderAuftraege();
    closeAuftragModal();
}

window.editAuftrag = function(nr) {
    const auftrag = auftraege.find(a => (a.nr || a.auftrag_nr) === nr);
    if (auftrag) openAuftragModal(auftrag);
};

window.deleteAuftrag = function(nr) {
    const auftrag = auftraege.find(a => (a.nr || a.auftrag_nr) === nr);
    if (auftrag) handleDeleteAuftrag(auftrag);
};

export async function showAuftraege(containerId) {
    const container = containerId ? document.getElementById(containerId) : document.getElementById("auftraege-tbody");
    if (!container) return console.error("Aufträge-Container nicht gefunden.");

    if (window.electronAPI && window.electronAPI.getAuftraege) {
        auftraege = await window.electronAPI.getAuftraege();
    }

    const searchInput = document.getElementById("auftrag-search");
    const addBtn = document.getElementById("add-auftrag-btn");
    const addEmptyBtn = document.getElementById("add-auftrag-empty-btn");
    const saveBtn = document.getElementById("auftrag-save-btn");
    const cancelBtn = document.getElementById("auftrag-cancel-btn");
    const modal = document.getElementById("auftrag-modal");

    if (searchInput) {
        searchInput.addEventListener("input", e => {
            renderAuftraege(e.target.value);
        });
    }

    if (addBtn) addBtn.onclick = () => openAuftragModal(null);
    if (addEmptyBtn) addEmptyBtn.onclick = () => openAuftragModal(null);
    if (saveBtn) saveBtn.onclick = () => saveAuftrag();
    if (cancelBtn) cancelBtn.onclick = () => closeAuftragModal();

    if (modal) {
        modal.addEventListener("click", e => {
            if (e.target === modal) closeAuftragModal();
        });
    }

    renderAuftraege();

    return {
        refresh: async () => {
            if (window.electronAPI && window.electronAPI.getAuftraege) {
                auftraege = await window.electronAPI.getAuftraege();
                renderAuftraege();
            }
        },
        setData: (data) => {
            auftraege = data;
            renderAuftraege();
        }
    };
}