// Глобальные переменные
let maschinen = [];
let currentEdit = null;
let isNewMaschine = false;

// Utility functions
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

// Функция для получения следующего доступного номера
function getNextNr() {
    if (!maschinen || maschinen.length === 0) return 1;

    const existingNrs = maschinen
        .map(m => parseInt(m.Nr))
        .filter(nr => !isNaN(nr))
        .sort((a, b) => a - b);

    // Находим первый свободный номер
    for (let i = 1; i <= existingNrs.length + 1; i++) {
        if (!existingNrs.includes(i)) {
            return i;
        }
    }

    return existingNrs.length + 1;
}

// Toast notification function
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

// Функция для открытия модального окна
function openModal(maschine) {
    currentEdit = maschine;
    isNewMaschine = maschine === null;

    const modal = document.getElementById("modal");
    const nrInput = document.getElementById("edit-nr");
    const bezeichnungInput = document.getElementById("edit-bezeichnung");
    const vonInput = document.getElementById("edit-von");
    const bisInput = document.getElementById("edit-bis");
    const kapInput = document.getElementById("edit-kap");

    if (isNewMaschine) {
        // Новая машина - устанавливаем значения по умолчанию
        const nextNr = getNextNr();
        if (nrInput) nrInput.value = nextNr;
        bezeichnungInput.value = "";
        vonInput.value = new Date().toISOString().split('T')[0];
        bisInput.value = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        kapInput.value = "1";
        if (nrInput) nrInput.disabled = false;
    } else {
        // Редактирование существующей машины
        if (nrInput) nrInput.value = maschine.Nr;
        bezeichnungInput.value = maschine.Bezeichnung;
        vonInput.value = excelToDate(maschine.verf_von);
        bisInput.value = excelToDate(maschine.verf_bis);
        kapInput.value = maschine.Kap_Tag;
        if (nrInput) nrInput.disabled = true;
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

// Функция для закрытия модального окна
function closeModal() {
    const modal = document.getElementById("modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
    currentEdit = null;
    isNewMaschine = false;
}

// Функция удаления машины
async function handleDeleteMaschine(maschine) {
    const confirmed = confirm(`Möchten Sie die Maschine "${maschine.Bezeichnung}" wirklich löschen?`);
    if (!confirmed) return;

    try {
        if (window.electronAPI && window.electronAPI.deleteMaschine) {
            await window.electronAPI.deleteMaschine(maschine.Nr);
            // Перезагружаем данные из базы после удаления
            maschinen = await window.electronAPI.getMaschinen();
        } else {
            // Fallback для mock данных
            const index = maschinen.findIndex(m => m.Nr == maschine.Nr);
            if (index !== -1) {
                maschinen.splice(index, 1);
            }
        }

        renderMaschinen();
        showToast("Maschine gelöscht 🗑️");
    } catch (err) {
        alert(err.message || "Fehler beim Löschen");
        console.error(err);
    }
}

// Функция сохранения машины
async function saveMaschine() {
    const nrInput = document.getElementById("edit-nr");
    const bezeichnungInput = document.getElementById("edit-bezeichnung");
    const vonInput = document.getElementById("edit-von");
    const bisInput = document.getElementById("edit-bis");
    const kapInput = document.getElementById("edit-kap");

    // Валидация
    if (!bezeichnungInput.value.trim()) {
        alert("Bezeichnung ist erforderlich!");
        return;
    }

    const machineData = {
        Bezeichnung: bezeichnungInput.value.trim(),
        verf_von: dateToExcel(vonInput.value),
        verf_bis: dateToExcel(bisInput.value),
        Kap_Tag: parseInt(kapInput.value, 10)
    };

    // Добавляем Nr для новой машины
    if (isNewMaschine) {
        const nr = nrInput ? parseInt(nrInput.value, 10) : getNextNr();

        // Проверяем уникальность номера
        if (maschinen.some(m => parseInt(m.Nr) === nr)) {
            alert(`Nummer ${nr} bereits vorhanden! Wählen Sie eine andere Nummer.`);
            return;
        }

        machineData.Nr = nr;
    }

    try {
        if (isNewMaschine) {
            // Создание новой машины
            if (window.electronAPI && window.electronAPI.addMaschine) {
                await window.electronAPI.addMaschine(machineData);
                // Перезагружаем данные из базы после создания
                maschinen = await window.electronAPI.getMaschinen();
            } else {
                // Fallback для mock данных
                maschinen.push(machineData);
            }
            showToast("Neue Maschine erstellt ✅");
        } else {
            // Обновление существующей машины
            if (window.electronAPI && window.electronAPI.updateMaschine) {
                await window.electronAPI.updateMaschine(currentEdit.Nr, machineData);
                // Перезагружаем данные из базы после обновления
                maschinen = await window.electronAPI.getMaschinen();
            } else {
                // Fallback для mock данных
                const index = maschinen.findIndex(m => m.Nr == currentEdit.Nr);
                if (index !== -1) {
                    maschinen[index] = {...maschinen[index], ...machineData};
                }
            }
            showToast("Maschine gespeichert ✅");
        }

        renderMaschinen();
        closeModal();
    } catch (e) {
        console.error("Save error:", e);
        alert(isNewMaschine ? "Fehler beim Erstellen" : "Fehler beim Speichern");
    }
}

// Функция для обновления данных
async function refreshMaschinenData() {
    try {
        if (window.electronAPI && window.electronAPI.getMaschinen) {
            maschinen = await window.electronAPI.getMaschinen();
            console.log("Data refreshed:", maschinen);
        }
        renderMaschinen();
    } catch (error) {
        console.error("Error refreshing data:", error);
    }
}

// Функция рендеринга таблицы машин
function renderMaschinen(filter = "") {
    console.log("Rendering maschinen with data:", maschinen);
    const tbody = document.getElementById("maschinen-tbody");
    const loading = document.getElementById("maschinen-loading");
    const content = document.getElementById("maschinen-content");
    const empty = document.getElementById("maschinen-empty");

    if (loading) loading.style.display = "none";
    if (empty) empty.style.display = "none";
    if (content) content.style.display = "block";

    tbody.innerHTML = "";

    const filtered = maschinen.filter(m =>
        m && m.Bezeichnung && m.Bezeichnung.toLowerCase().includes(filter.toLowerCase())
    );

    console.log("Filtered maschinen:", filtered);

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #6c757d;">
                    ${filter ? 'Keine Maschinen gefunden' : 'Keine Maschinen vorhanden'}
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(maschine => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td data-label="Nr">${maschine.Nr}</td>
            <td data-label="Bezeichnung">${maschine.Bezeichnung}</td>
            <td data-label="Verfügbar von">${excelToDate(maschine.verf_von)}</td>
            <td data-label="Verfügbar bis">${excelToDate(maschine.verf_bis)}</td>
            <td data-label="Kapazität/Tag">${maschine.Kap_Tag}</td>
            <td data-label="Aktionen">
                <div class="action-buttons">
                    <button class="btn edit" onclick="window.editMaschine(${maschine.Nr})">✏️ Bearbeiten</button>
                    <button class="btn secondary" onclick="window.deleteMaschine(${maschine.Nr})">🗑️ Löschen</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Глобальные функции для кнопок - определяем сразу
window.editMaschine = function (nr) {
    console.log('Edit maschine called with nr:', nr);
    const maschine = maschinen.find(m => m.Nr == nr); // используем == вместо === для гибкого сравнения
    console.log('Found maschine:', maschine);
    if (maschine) {
        openModal(maschine);
    } else {
        console.error('Maschine not found for nr:', nr);
    }
};

window.deleteMaschine = function (nr) {
    console.log('Delete maschine called with nr:', nr);
    const maschine = maschinen.find(m => m.Nr == nr); // используем == вместо === для гибкого сравнения
    console.log('Found maschine for deletion:', maschine);
    if (maschine) {
        handleDeleteMaschine(maschine);
    } else {
        console.error('Maschine not found for deletion, nr:', nr);
    }
};

// Основная экспортируемая функция
export async function showMaschinen(containerId) {
    // Если containerId не передан, используем стандартный контейнер из HTML
    const container = containerId ? document.getElementById(containerId) : document.getElementById("maschinen-tbody");

    if (!container) {
        console.error("Container not found");
        return;
    }

    try {
        // Попытка загрузить данные через Electron API
        if (window.electronAPI && window.electronAPI.getMaschinen) {
            maschinen = await window.electronAPI.getMaschinen();
        } else {
            // Fallback на mock данные если Electron API недоступен
            console.warn("Electron API not available, using mock data");
            maschinen = [
                {Nr: 1, Bezeichnung: 'CNC Fräsmaschine A', verf_von: 44927, verf_bis: 45292, Kap_Tag: 8},
                {Nr: 2, Bezeichnung: 'Drehbank B', verf_von: 44927, verf_bis: 45292, Kap_Tag: 6},
                {Nr: 3, Bezeichnung: 'Schweißanlage C', verf_von: 44927, verf_bis: 45292, Kap_Tag: 4},
                {Nr: 4, Bezeichnung: 'Schleifmaschine D', verf_von: 44927, verf_bis: 45292, Kap_Tag: 5},
                {Nr: 5, Bezeichnung: 'Bohrmaschine E', verf_von: 44927, verf_bis: 45292, Kap_Tag: 3}
            ];
        }
        console.log("Loaded maschinen:", maschinen);
    } catch (e) {
        console.error("Error loading maschinen:", e);
        container.innerHTML = "<tr><td colspan='6' style='text-align: center; color: red;'>Fehler beim Laden der Daten</td></tr>";
        return;
    }

    // Настройка обработчиков событий
    const searchInput = document.getElementById("maschinen-search");
    const addBtn = document.getElementById("add-maschine-btn");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const modal = document.getElementById("modal");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderMaschinen(e.target.value);
        });
    }

    if (addBtn) {
        addBtn.onclick = () => openModal(null);
    }

    if (saveBtn) {
        saveBtn.onclick = saveMaschine;
    }

    if (cancelBtn) {
        cancelBtn.onclick = closeModal;
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Первоначальный рендеринг
    renderMaschinen();

    return {
        refresh: () => refreshMaschinenData(),
        render: () => renderMaschinen(),
        setData: (data) => {
            maschinen = data;
            renderMaschinen();
        }
    };
}