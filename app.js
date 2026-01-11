// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    aircrafts: [], // Synced from Firestore
    equipment: [] // Synced from Firestore
};

// Configuration
const DEFAULT_LOCATIONS = [
    { id: 'cpt-ohb', name: 'Overhead Stowage Bin', icon: '📦' },
    { id: 'cpt-dh', name: 'Doghouse', icon: '🏠' },
    { id: 'cpt-cas', name: 'Cabin Attendant Seat', icon: '💺' },
    { id: 'cpt-fd', name: 'Cockpit (Flight Deck)', icon: '✈️' }
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
    closeModalBtn: document.getElementById('close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    form: document.getElementById('equipment-form'),
    naButtons: document.querySelectorAll('.btn-na'),
    quickNoteButtons: document.querySelectorAll('.tag-btn'),
    notesInput: document.getElementById('notes'),

    exportBtn: document.getElementById('export-btn')
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
        // Also refresh locations to update counts
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
    // Aircraft Modal Handling
    elements.addAircraftBtn.addEventListener('click', openAircraftModal);
    elements.closeAircraftModalBtn.addEventListener('click', closeAircraftModal);
    elements.cancelAircraftBtn.addEventListener('click', closeAircraftModal);
    elements.aircraftModal.addEventListener('click', (e) => {
        if (e.target === elements.aircraftModal) closeAircraftModal();
    });
    elements.aircraftForm.addEventListener('submit', handleAircraftSubmit);

    // Equipment Modal Handling
    elements.addBtn.addEventListener('click', openModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // N/A Buttons
    elements.naButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            const input = document.getElementById(targetId);
            if (input) input.value = "N/A";
        });
    });

    // Quick Note Buttons (DAMAGED / MISSING)
    elements.quickNoteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteText = e.target.dataset.note;
            const currentNotes = elements.notesInput.value;

            // Append if not already present
            if (!currentNotes.includes(noteText)) {
                elements.notesInput.value = currentNotes ? `${currentNotes} ${noteText}` : noteText;
            }
        });
    });

    // Form Submission
    elements.form.addEventListener('submit', handleFormSubmit);

    // Export Data
    elements.exportBtn.addEventListener('click', exportToCSV);
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

    // Add Listeners
    document.querySelectorAll('.aircraft-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-ac')) return; // Don't select if deleting

            const id = card.dataset.id;
            selectAircraft(id);
        });
    });

    document.querySelectorAll('.delete-ac').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            deleteAircraft(id);
        });
    });
}

function selectAircraft(aircraftId) {
    state.currentAircraftId = aircraftId;
    state.currentLocation = null;

    // Update UI selection
    document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.aircraft-card[data-id="${aircraftId}"]`)?.classList.add('active');

    // Show Locations
    elements.locationMapSection.classList.remove('hidden');
    elements.equipmentSection.classList.add('hidden');

    renderLocations();
}

async function deleteAircraft(id) {
    if (confirm('Are you sure you want to delete this aircraft? This action cannot be undone.')) {
        try {
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

    elements.currentZoneTitle.textContent = `Locations (Default)`;
    elements.locationsContainer.innerHTML = DEFAULT_LOCATIONS.map(loc => `
        <div class="location-item ${state.currentLocation === loc.id ? 'selected' : ''}" data-id="${loc.id}">
            <div class="loc-img">${loc.icon}</div>
            <div class="loc-info">
                <h4>${loc.name}</h4>
                <span>${getEquipmentCount(loc.id)} items mapped</span>
            </div>
        </div>
    `).join('');

    // Add click listeners
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
    // Filter by BOTH Aircraft ID and Location ID
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
        // Detect tags from Notes or old status field
        const tags = [];
        const notes = item.notes ? item.notes.toUpperCase() : '';

        // Check "status" object for backward compatibility OR "notes" for new system
        const isNa = (item.status && item.status.na) || notes.includes('N/A');
        const isDamaged = (item.status && item.status.damaged) || notes.includes('DAMAGED');
        const isMissing = (item.status && item.status.missing) || notes.includes('MISSING');

        if (isNa) tags.push('<span class="tag na">N/A</span>');
        if (isDamaged) tags.push('<span class="tag damaged">DAMAGED</span>');
        if (isMissing) tags.push('<span class="tag missing">MISSING</span>');

        const tagHtml = tags.join('');

        return `
            <div class="equip-card">
                <div class="equip-card-header">
                    <div class="equip-title">${item.description}</div>
                    <div class="equip-tags">${tagHtml}</div>
                </div>
                <div class="equip-details">
                    ${item.partNumber ? `<div class="detail-item"><strong>P/N</strong> ${item.partNumber}</div>` : ''}
                    ${item.serialNumber ? `<div class="detail-item"><strong>S/N</strong> ${item.serialNumber}</div>` : ''}
                    ${item.expireDate ? `<div class="detail-item"><strong>Exp</strong> ${item.expireDate}</div>` : ''}
                    <div class="detail-item"><strong>Qty</strong> ${item.quantity}</div>
                </div>
                ${item.notes ? `<div class="detail-item" style="grid-column: 1/-1; margin-top: 5px;"><strong>Notes</strong> ${item.notes}</div>` : ''}
                <button class="icon-btn delete-equip" data-id="${item.id}" style="position: absolute; top: 10px; right: 10px; color: var(--text-muted); opacity: 0.5;">&times;</button>
            </div>
        `;
    }).join('');

    // Add delete listeners for equipment
    document.querySelectorAll('.delete-equip').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Delete this equipment?')) {
                try {
                    await deleteDoc(doc(db, "equipment", btn.dataset.id));
                } catch (err) {
                    console.error(err);
                }
            }
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
    const name = formData.get('aircraft-name');

    try {
        await addDoc(aircraftCollection, {
            name: name,
            createdAt: Timestamp.now()
        });
        closeAircraftModal();
    } catch (err) {
        console.error("Error adding aircraft: ", err);
        alert("Failed to add aircraft");
    }
}

function openModal() {
    elements.form.reset();
    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(elements.form);

    // No longer parsing 'status-checkboxes'. 
    // Data is implicitly in the other fields (N/A in dates, Damaged/Missing in Notes).
    // We can save an empty status object for backward compatibility structure if we want, 
    // or just rely on 'notes' parsing.

    const newEquipment = {
        aircraftId: state.currentAircraftId, // LINK TO AIRCRAFT
        locationId: state.currentLocation,
        description: formData.get('description'),
        partNumber: formData.get('part-number'),
        serialNumber: formData.get('serial-number'),
        manufactureDate: formData.get('man-date'),
        expireDate: formData.get('exp-date'),
        quantity: formData.get('quantity'),
        notes: formData.get('notes'),
        status: {}, // Deprecated but kept structure
        createdAt: Timestamp.now()
    };

    try {
        const btn = elements.form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        await addDoc(equipmentCollection, newEquipment);

        btn.textContent = originalText;
        btn.disabled = false;
        closeModal();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Failed to save equipment. Check console for details.");
        elements.form.querySelector('button[type="submit"]').disabled = false;
    }
}

function exportToCSV() {
    if (state.equipment.length === 0) {
        alert('No data to export!');
        return;
    }

    const headers = ['Aircraft ID', 'Location', 'Description', 'Quantity', 'Part Number', 'Serial Number', 'Manufacture Date', 'Expire Date', 'Notes'];

    const rows = state.equipment.map(item => {
        let desc = item.description;
        // Basic check for tags in notes
        const notes = (item.notes || '').toUpperCase();
        if (notes.includes('N/A')) desc += ' (N/A)';
        if (notes.includes('DAMAGED')) desc += ' (DAMAGED)';
        if (notes.includes('MISSING')) desc += ' (MISSING)';

        return [
            `"${item.aircraftId || 'Unknown'}"`,
            `"${item.locationId}"`,
            `"${desc}"`,
            item.quantity,
            `"${item.partNumber || ''}"`,
            `"${item.serialNumber || ''}"`,
            `"${item.manufactureDate || ''}"`,
            `"${item.expireDate || ''}"`,
            `"${item.notes || ''}"`
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `equipment_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start
init();
