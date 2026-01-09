// App State
const state = {
    currentZone: 'cockpit', // 'cockpit' or 'cabin'
    currentLocation: null,
    equipment: [] // Array of equipment objects
};

// Configuration
const ZONES = {
    cockpit: [
        { id: 'cpt-ohb', name: 'Overhead Stowage Bin', icon: '📦' },
        { id: 'cpt-dh', name: 'Doghouse', icon: '🏠' },
        { id: 'cpt-cas', name: 'Cabin Attendant Seat', icon: '💺' }
    ],
    cabin: [
        { id: 'cab-ohb-fwd', name: 'FWD Overhead Bin', icon: '📦' },
        { id: 'cab-ohb-aft', name: 'AFT Overhead Bin', icon: '📦' },
        { id: 'cab-dh', name: 'Doghouse', icon: '🏠' },
        { id: 'cab-cas', name: 'Cabin Attendant Seat', icon: '💺' }
    ]
};

// DOM Elements
const elements = {
    zoneButtons: document.querySelectorAll('.zone-card'),
    currentZoneTitle: document.getElementById('current-zone-title'),
    locationsContainer: document.getElementById('locations-container'),
    equipmentSection: document.getElementById('equipment-section'),
    selectedLocationTitle: document.getElementById('selected-location-title'),
    equipmentList: document.getElementById('equipment-list'),
    addBtn: document.getElementById('add-equip-btn'),
    modal: document.getElementById('item-modal'),
    closeModalBtn: document.getElementById('close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    form: document.getElementById('equipment-form'),
    exportBtn: document.getElementById('export-btn')
};

// Initialization
function init() {
    setupEventListeners();
    renderLocations();
}

// Event Listeners
function setupEventListeners() {
    // Zone Switching
    elements.zoneButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const zone = btn.dataset.zone;
            if (zone === state.currentZone) return;

            // Update UI
            elements.zoneButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update State
            state.currentZone = zone;
            state.currentLocation = null;

            // Hide Equipment Section
            elements.equipmentSection.classList.add('hidden');

            // Re-render Locations
            renderLocations();
        });
    });

    // Modal Handling
    elements.addBtn.addEventListener('click', openModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Form Submission
    elements.form.addEventListener('submit', handleFormSubmit);

    // Export Data
    elements.exportBtn.addEventListener('click', exportToCSV);
}

// Render Functions
function renderLocations() {
    const locations = ZONES[state.currentZone];
    elements.currentZoneTitle.textContent = `${state.currentZone.charAt(0).toUpperCase() + state.currentZone.slice(1)} Locations`;

    elements.locationsContainer.innerHTML = locations.map(loc => `
        <div class="location-item ${state.currentLocation === loc.id ? 'selected' : ''}" data-id="${loc.id}">
            <div class="loc-img">${loc.icon}</div>
            <div class="loc-info">
                <h4>${loc.name}</h4>
                <span>${getEquipmentCount(loc.id)} items mapped</span>
            </div>
        </div>
    `).join('');

    // Add click listeners to new elements
    document.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.location-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');

            state.currentLocation = item.dataset.id;
            const locName = locations.find(l => l.id === state.currentLocation).name;

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
    const items = state.equipment.filter(item => item.locationId === state.currentLocation);

    if (items.length === 0) {
        elements.equipmentList.innerHTML = `
            <div class="empty-state">
                <p>No equipment mapped here yet.</p>
            </div>
        `;
        return;
    }

    elements.equipmentList.innerHTML = items.map(item => {
        const tags = [];
        if (item.status.na) tags.push('<span class="tag na">N/A</span>');
        if (item.status.damaged) tags.push('<span class="tag damaged">DAMAGED</span>');
        if (item.status.missing) tags.push('<span class="tag missing">MISSING</span>');
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
            </div>
        `;
    }).join('');
}

// Logic
function getEquipmentCount(locationId) {
    return state.equipment.filter(e => e.locationId === locationId).length;
}

function openModal() {
    elements.form.reset();
    elements.modal.classList.add('active'); // Parent overlay
}

function closeModal() {
    elements.modal.classList.remove('active');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(elements.form);
    const newEquipment = {
        id: Date.now(),
        locationId: state.currentLocation,
        description: formData.get('description'),
        partNumber: formData.get('part-number'),
        serialNumber: formData.get('serial-number'),
        manufactureDate: formData.get('man-date'),
        expireDate: formData.get('exp-date'),
        quantity: formData.get('quantity'),
        notes: formData.get('notes'),
        status: {
            na: formData.get('status-na') === 'NA',
            damaged: formData.get('status-damaged') === 'DAMAGED',
            missing: formData.get('status-missing') === 'MISSING'
        }
    };

    state.equipment.push(newEquipment);
    renderEquipmentList();
    renderLocations(); // To update counts
    renderLocations(); // To update counts
    closeModal();
}

function exportToCSV() {
    if (state.equipment.length === 0) {
        alert('No data to export!');
        return;
    }

    // 1. Description, 2. Qty, 3. P/N, 4. S/N, 5. Man Date, 6. Exp Date, 7. Note
    const headers = ['Description', 'Quantity', 'Part Number', 'Serial Number', 'Manufacture Date', 'Expire Date', 'Notes'];

    const rows = state.equipment.map(item => {
        // Handle status tags in description or separate? User asked for Description in col 1.
        // I will append status to description if present to make it useful.
        let desc = item.description;
        if (item.status.na) desc += ' (N/A)';
        if (item.status.damaged) desc += ' (DAMAGED)';
        if (item.status.missing) desc += ' (MISSING)';

        return [
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
