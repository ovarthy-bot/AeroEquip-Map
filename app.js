// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc, updateDoc, getDoc, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyA49EhbfTF8vpTlYLeR5tijWUiPqlRRb5Y",
    authDomain: "aero-equip-map.firebaseapp.com",
    projectId: "aero-equip-map",
    storageBucket: "aero-equip-map.firebasestorage.app",
    messagingSenderId: "123061508316",
    appId: "1:123061508316:web:636decead73be1986dfc19"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const equipmentCollection = collection(db, "equipment");
const aircraftCollection = collection(db, "aircrafts");

// App State
const state = {
    currentAircraftId: null,
    currentLocation: null,
    currentEditingId: null,
    aircrafts: [],
    equipment: []
};

// Configuration
const DEFAULT_LOCATIONS = [
    { id: 'cpt-ohb', name: 'Overhead Stowage Bin', icon: '📦' },
    { id: 'cpt-dh', name: 'Doghouse', icon: '🏠' },
    { id: 'cpt-cas', name: 'Cabin Attendant Seat', icon: '💺' },
    { id: 'cpt-fd', name: 'Cockpit (Flight Deck)', icon: '✈️' },
    { id: 'cpt-ps', name: 'Pax Seat', icon: '💺' }
];

// DOM Elements
const elements = {
    // Aircraft Section
    aircraftContainer: document.getElementById('aircraft-container'),
    addAircraftBtn: document.getElementById('add-aircraft-btn'),
    aircraftModal: document.getElementById('aircraft-modal'),
    closeAircraftModalBtn: document.getElementById('close-aircraft-modal'),
    cancelAircraftBtn: document.getElementById('cancel-aircraft-btn'),
    aircraftForm: document.getElementById('aircraft-form'),

    // Location Map
    locationMapSection: document.getElementById('location-map-section'),
    currentZoneTitle: document.getElementById('current-zone-title'),
    locationsContainer: document.getElementById('locations-container'),

    // Equipment Section
    equipmentSection: document.getElementById('equipment-section'),
    selectedLocationTitle: document.getElementById('selected-location-title'),
    equipmentList: document.getElementById('equipment-list'),

    // Equipment Modal
    addBtn: document.getElementById('add-equip-btn'),
    modal: document.getElementById('item-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeModalBtn: document.getElementById('close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    form: document.getElementById('equipment-form'),
    specificLocationInput: document.getElementById('specific-location'),
    naButtons: document.querySelectorAll('.btn-na'),
    quickNoteButtons: document.querySelectorAll('.tag-btn'),
    notesInput: document.getElementById('notes'),
    submitBtn: document.querySelector('#equipment-form button[type="submit"]'),

    // Import/Export
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file')
};

// Initialization
function init() {
    setupEventListeners();
    setupFirestoreListeners();
}

// Firestore Real-time Listeners
function setupFirestoreListeners() {
    // Equipment Listener
    const qEq = query(equipmentCollection, orderBy("createdAt", "desc"));
    onSnapshot(qEq, (snapshot) => {
        state.equipment = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        if (state.currentLocation && state.currentAircraftId) {
            renderEquipmentList();
        }
        if (state.currentAircraftId) {
            renderLocations();
        }
    }, (error) => {
        console.error("Error getting equipment: ", error);
    });

    // Aircraft Listener
    const qAc = query(aircraftCollection, orderBy("name", "asc"));
    onSnapshot(qAc, (snapshot) => {
        state.aircrafts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderAircrafts();
    }, (error) => {
        console.error("Error getting aircrafts: ", error);
    });
}

// Event Listeners
function setupEventListeners() {
    // Aircraft Modal
    elements.addAircraftBtn.addEventListener('click', openAircraftModal);
    elements.closeAircraftModalBtn.addEventListener('click', closeAircraftModal);
    elements.cancelAircraftBtn.addEventListener('click', closeAircraftModal);
    elements.aircraftModal.addEventListener('click', (e) => {
        if (e.target === elements.aircraftModal) closeAircraftModal();
    });
    elements.aircraftForm.addEventListener('submit', handleAircraftSubmit);

    // Equipment Modal
    elements.addBtn.addEventListener('click', () => openModal()); // Add Mode
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    elements.naButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            const input = document.getElementById(targetId);
            if (input) input.value = "N/A";
        });
    });

    // Quick Note Buttons (Mutually Exclusive)
    elements.quickNoteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteText = e.target.dataset.note; // DAMAGED or MISSING
            let currentNotes = elements.notesInput.value;

            // 1. Remove ANY existing status tags from the current notes
            const statuses = ['DAMAGED', 'MISSING'];
            statuses.forEach(s => {
                // Regex to remove word borders
                const regex = new RegExp(`\\b${s}\\b`, 'g');
                currentNotes = currentNotes.replace(regex, '').trim();
            });

            // 2. Append the NEW status
            elements.notesInput.value = currentNotes ? `${currentNotes} ${noteText}` : noteText;
        });
    });

    elements.form.addEventListener('submit', handleFormSubmit);

    // Import/Export
    elements.exportBtn.addEventListener('click', exportToXLSX);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', handleImportXLSX);
}

// Render Functions
function renderAircrafts() {
    if (state.aircrafts.length === 0) {
        elements.aircraftContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No aircraft found. Add one to get started.</p>';
        return;
    }

    elements.aircraftContainer.innerHTML = state.aircrafts.map(ac => `
        <div class="aircraft-card ${state.currentAircraftId === ac.id ? 'active' : ''}" data-id="${ac.id}">
            <div class="ac-icon">✈️</div>
            <div class="ac-info">
                <h3>${ac.name}</h3>
                <p>Aircraft Folder</p>
            </div>
            <div class="ac-actions">
                <button class="icon-btn delete-ac" data-id="${ac.id}" title="Delete Aircraft">&times;</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.aircraft-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-ac')) return;
            selectAircraft(card.dataset.id);
        });
    });

    document.querySelectorAll('.delete-ac').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAircraft(btn.dataset.id);
        });
    });
}

function selectAircraft(aircraftId) {
    state.currentAircraftId = aircraftId;
    state.currentLocation = null;

    document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.aircraft-card[data-id="${aircraftId}"]`)?.classList.add('active');

    elements.locationMapSection.classList.remove('hidden');
    elements.equipmentSection.classList.add('hidden');

    renderLocations();
}

async function deleteAircraft(id) {
    if (confirm('Are you sure you want to delete this aircraft AND ALL its equipment? This action cannot be undone.')) {
        try {
            // 1. Delete all equipment associated with this aircraft
            const q = query(equipmentCollection, where("aircraftId", "==", id));
            const snapshot = await getDocs(q);

            // Use batch for better performance/atomicity
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // 2. Delete the aircraft folder itself
            await deleteDoc(doc(db, "aircrafts", id));

            if (state.currentAircraftId === id) {
                state.currentAircraftId = null;
                elements.locationMapSection.classList.add('hidden');
                elements.equipmentSection.classList.add('hidden');
            }
        } catch (e) {
            console.error("Error deleting aircraft: ", e);
            alert("Failed to delete aircraft.");
        }
    }
}

function renderLocations() {
    if (!state.currentAircraftId) return;

    elements.currentZoneTitle.textContent = `Locations`;
    elements.locationsContainer.innerHTML = DEFAULT_LOCATIONS.map(loc => `
        <div class="location-item ${state.currentLocation === loc.id ? 'selected' : ''}" data-id="${loc.id}">
            <div class="loc-img">${loc.icon}</div>
            <div class="loc-info">
                <h4>${loc.name}</h4>
                <span>${getEquipmentCount(loc.id)} items mapped</span>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.location-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            state.currentLocation = item.dataset.id;
            const locName = DEFAULT_LOCATIONS.find(l => l.id === state.currentLocation).name;

            showEquipmentList(locName);
        });
    });
}

function showEquipmentList(locationName) {
    elements.equipmentSection.classList.remove('hidden');
    elements.selectedLocationTitle.textContent = locationName;
    renderEquipmentList();
}

function renderEquipmentList() {
    const items = state.equipment.filter(item =>
        item.aircraftId === state.currentAircraftId &&
        item.locationId === state.currentLocation
    );

    if (items.length === 0) {
        elements.equipmentList.innerHTML = `
            <div class="empty-state">
                <p>No equipment mapped here yet.</p>
            </div>
        `;
        return;
    }

    elements.equipmentList.innerHTML = items.map(item => {
        const notes = item.notes ? item.notes.toUpperCase() : '';
        const tags = [];
        if (notes.includes('N/A')) tags.push('<span class="tag na">N/A</span>');
        if (notes.includes('DAMAGED')) tags.push('<span class="tag damaged">DAMAGED</span>');
        if (notes.includes('MISSING')) tags.push('<span class="tag missing">MISSING</span>');
        const tagHtml = tags.join('');

        return `
            <div class="equip-card">
                <div class="equip-card-main">
                    <div class="equip-card-header">
                        <div class="equip-title">${item.description}</div>
                        <div class="equip-tags">${tagHtml}</div>
                    </div>
                    ${item.specificLocation ? `<div class="sub-location-tag">📍 ${item.specificLocation}</div>` : ''}
                    <div class="equip-details">
                        ${item.partNumber ? `<div class="detail-item"><strong>P/N</strong> ${item.partNumber}</div>` : ''}
                        ${item.serialNumber ? `<div class="detail-item"><strong>S/N</strong> ${item.serialNumber}</div>` : ''}
                        ${item.expireDate ? `<div class="detail-item"><strong>Exp</strong> ${item.expireDate}</div>` : ''}
                        <div class="detail-item"><strong>Qty</strong> ${item.quantity}</div>
                    </div>
                    ${item.notes ? `<div class="detail-item" style="grid-column: 1/-1; margin-top: 5px;"><strong>Notes</strong> ${item.notes}</div>` : ''}
                </div>
                
                <div class="card-actions-visible">
                     <button class="action-btn edit-equip" data-id="${item.id}">Edit</button>
                     <button class="action-btn delete-equip" data-id="${item.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Listeners
    document.querySelectorAll('.delete-equip').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Delete this equipment?')) {
                await deleteDoc(doc(db, "equipment", btn.dataset.id));
            }
        });
    });

    document.querySelectorAll('.edit-equip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = state.equipment.find(i => i.id === btn.dataset.id);
            if (item) openModal(item);
        });
    });
}

// Logic
function getEquipmentCount(locationId) {
    return state.equipment.filter(e =>
        e.aircraftId === state.currentAircraftId &&
        e.locationId === locationId
    ).length;
}

// Modal Functions
function openAircraftModal() {
    elements.aircraftForm.reset();
    elements.aircraftModal.classList.add('active');
}

function closeAircraftModal() {
    elements.aircraftModal.classList.remove('active');
}

async function handleAircraftSubmit(e) {
    e.preventDefault();
    const formData = new FormData(elements.aircraftForm);
    try {
        await addDoc(aircraftCollection, {
            name: formData.get('aircraft-name'),
            createdAt: Timestamp.now()
        });
        closeAircraftModal();
    } catch (err) {
        alert("Failed to add aircraft");
    }
}

function openModal(itemToEdit = null) {
    elements.form.reset();
    state.currentEditingId = null;

    if (itemToEdit) {
        state.currentEditingId = itemToEdit.id;
        elements.modalTitle.textContent = "Edit Equipment";
        elements.submitBtn.textContent = "Update Equipment";

        elements.specificLocationInput.value = itemToEdit.specificLocation || '';
        document.getElementById('description').value = itemToEdit.description;
        document.getElementById('part-number').value = itemToEdit.partNumber || '';
        document.getElementById('serial-number').value = itemToEdit.serialNumber || '';
        document.getElementById('man-date').value = itemToEdit.manufactureDate || '';
        document.getElementById('exp-date').value = itemToEdit.expireDate || '';
        document.getElementById('quantity').value = itemToEdit.quantity;
        document.getElementById('notes').value = itemToEdit.notes || '';
    } else {
        elements.modalTitle.textContent = "Add Equipment";
        elements.submitBtn.textContent = "Save Equipment";
    }

    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
    state.currentEditingId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(elements.form);

    const equipmentData = {
        aircraftId: state.currentAircraftId,
        locationId: state.currentLocation,
        specificLocation: formData.get('specific-location'),
        description: formData.get('description'),
        partNumber: formData.get('part-number'),
        serialNumber: formData.get('serial-number'),
        manufactureDate: formData.get('man-date'),
        expireDate: formData.get('exp-date'),
        quantity: formData.get('quantity'),
        notes: formData.get('notes'),
    };

    try {
        elements.submitBtn.textContent = 'Saving...';
        elements.submitBtn.disabled = true;

        if (state.currentEditingId) {
            const docRef = doc(db, "equipment", state.currentEditingId);
            await updateDoc(docRef, { ...equipmentData, updatedAt: Timestamp.now() });
        } else {
            await addDoc(equipmentCollection, { ...equipmentData, createdAt: Timestamp.now() });
        }

        closeModal();
    } catch (e) {
        console.error("Error saving: ", e);
        alert("Failed to save. Check console.");
    } finally {
        elements.submitBtn.disabled = false;
    }
}

// --- EXPORT ---
function exportToXLSX() {
    if (state.equipment.length === 0) {
        alert('No data to export!');
        return;
    }

    const data = state.equipment.map(item => {
        const ac = state.aircrafts.find(a => a.id === item.aircraftId);
        const loc = DEFAULT_LOCATIONS.find(l => l.id === item.locationId);

        return {
            'Aircraft': ac ? ac.name : 'Unknown', // Match Key for Import
            'Category': loc ? loc.name : item.locationId,
            'Specific Location': item.specificLocation || '',
            'Description': item.description,
            'Part Number': item.partNumber || '',
            'Serial Number': item.serialNumber || '',
            'Quantity': item.quantity,
            'Manufacture Date': item.manufactureDate || '',
            'Expire Date': item.expireDate || '',
            'Notes': item.notes || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipment Map");
    XLSX.writeFile(wb, `AeroEquip_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// --- IMPORT ---
async function handleImportXLSX(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    elements.importFile.value = '';

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("File appears empty or unreadable. Please check the Excel file.");
                return;
            }

            console.log("Importing Data Preview:", jsonData[0]);

            if (!confirm(`Found ${jsonData.length} items. Import them now?`)) return;

            let importedCount = 0;
            let skippedCount = 0;
            const createdAircrafts = {}; // Local cache for new aircrafts created in this session

            for (const row of jsonData) {
                try {
                    // Aircraft Logic
                    let aircraftId = null;
                    const acName = row['Aircraft'] ? String(row['Aircraft']).trim() : null;

                    if (acName) {
                        // 1. Check existing state
                        let existingAc = state.aircrafts.find(ac => ac.name === acName);

                        // 2. Check local cache (created during this loop)
                        if (!existingAc && createdAircrafts[acName]) {
                            existingAc = { id: createdAircrafts[acName] };
                        }

                        if (existingAc) {
                            aircraftId = existingAc.id;
                        } else {
                            // 3. Create New Aircraft
                            const newAcRef = await addDoc(aircraftCollection, {
                                name: acName,
                                createdAt: Timestamp.now()
                            });
                            aircraftId = newAcRef.id;
                            createdAircrafts[acName] = aircraftId; // Cache it
                            console.log(`Created new aircraft: ${acName}`);
                        }
                    } else if (state.currentAircraftId) {
                        // Fallback to current if row has no aircraft name
                        aircraftId = state.currentAircraftId;
                    } else {
                        console.warn("Skipping row (No Aircraft context):", row);
                        skippedCount++;
                        continue;
                    }

                    // Location Logic
                    const locName = row['Category'] ? String(row['Category']).trim() : null;
                    const locObj = DEFAULT_LOCATIONS.find(l => l.name === locName);
                    // Default to Overhead Bin if invalid category is provided
                    const locationId = locObj ? locObj.id : (DEFAULT_LOCATIONS[0].id);

                    await addDoc(equipmentCollection, {
                        aircraftId: aircraftId,
                        locationId: locationId,
                        specificLocation: row['Specific Location'] ? String(row['Specific Location']) : '',
                        description: row['Description'] ? String(row['Description']) : 'Unknown Item',
                        partNumber: row['Part Number'] ? String(row['Part Number']) : '',
                        serialNumber: row['Serial Number'] ? String(row['Serial Number']) : '',
                        quantity: row['Quantity'] || 1,
                        manufactureDate: row['Manufacture Date'] ? String(row['Manufacture Date']) : '',
                        expireDate: row['Expire Date'] ? String(row['Expire Date']) : '',
                        notes: row['Notes'] ? String(row['Notes']) : '',
                        createdAt: Timestamp.now()
                    });
                    importedCount++;

                } catch (innerErr) {
                    console.error("Error importing row:", row, innerErr);
                    skippedCount++;
                }
            }

            let msg = `Import complete!\n- Imported: ${importedCount}\n- Skipped: ${skippedCount}`;
            if (skippedCount > 0) msg += `\n(Check console for details on skipped items)`;

            alert(msg);
            // Refresh logic will handle UI updates via onSnapshot

        } catch (err) {
            console.error("Critical Import Error: ", err);
            alert(`Failed to process file: ${err.message}`);
        }
    };

    reader.readAsArrayBuffer(file);
}

// Start
init();
