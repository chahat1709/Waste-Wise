// Enhanced Admin Dashboard JavaScript
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Configuration
const SUPABASE_URL = "https://dwskiourizsqowlfjgiu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2tpb3VyaXpzcW93bGZqZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0OTYyMjYsImV4cCI6MjA1OTA3MjIyNn0.xpSfb8RhWPSisPqZLUNQ0IN30M-riqPsYuxrsxUjqIM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Global state
let currentSection = 'overview';
let charts = {};
let systemData = {
    users: [],
    bins: [],
    routes: [],
    alerts: []
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeModals();
    loadDashboardData();
    initializeCharts();
    startRealTimeUpdates();
});

// Navigation handling
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('href').substring(1);
            switchSection(section);
        });
    });
}

function switchSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[href="#${sectionName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    currentSection = sectionName;

    // Load section-specific data
    loadSectionData(sectionName);
}

function loadSectionData(section) {
    switch(section) {
        case 'overview':
            updateOverviewStats();
            break;
        case 'bins':
            loadBins();
            break;
        case 'users':
            loadUsers();
            break;
        case 'routes':
            loadRoutes();
            break;
        case 'monitoring':
            loadMonitoringData();
            break;
    }
}

// Data loading functions
async function loadDashboardData() {
    showLoading();
    try {
        await Promise.all([
            fetchUsers(),
            fetchBins(),
            fetchRoutes(),
            fetchAlerts()
        ]);
        updateOverviewStats();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

async function fetchUsers() {
    try {
        // Mock data - replace with actual API call
        systemData.users = [
            { id: 1, name: 'John Driver', email: 'john@wastewise.com', role: 'driver', status: 'active' },
            { id: 2, name: 'Sarah Admin', email: 'sarah@wastewise.com', role: 'admin', status: 'active' },
            { id: 3, name: 'Mike Supervisor', email: 'mike@wastewise.com', role: 'supervisor', status: 'inactive' }
        ];
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

async function fetchBins() {
    try {
        const { data, error } = await supabase.from("bins").select("*");
        if (error) throw error;
        systemData.bins = data || [];
    } catch (error) {
        console.error('Error fetching bins:', error);
        // Fallback to mock data
        systemData.bins = [
            { id: 1, location: 'Main St & 1st Ave', latitude: 12.9716, longitude: 77.5946, fullness: 75, status: 'active', capacity: 100 },
            { id: 2, location: 'Park Avenue', latitude: 12.9720, longitude: 77.5950, fullness: 45, status: 'active', capacity: 100 },
            { id: 3, location: 'City Center', latitude: 12.9750, longitude: 77.5900, fullness: 90, status: 'active', capacity: 100 }
        ];
    }
}

async function fetchRoutes() {
    try {
        // Mock data - replace with actual API call
        systemData.routes = [
            { id: 'R001', driver: 'John Driver', distance: 15.2, bins: 8, status: 'active', efficiency: 92 },
            { id: 'R002', driver: 'Sarah Admin', distance: 12.8, bins: 6, status: 'completed', efficiency: 88 },
            { id: 'R003', driver: 'Mike Supervisor', distance: 18.5, bins: 10, status: 'pending', efficiency: 95 }
        ];
    } catch (error) {
        console.error('Error fetching routes:', error);
    }
}

async function fetchAlerts() {
    try {
        // Mock data - replace with actual API call
        systemData.alerts = [
            { id: 1, type: 'warning', message: 'Bin #3 is 90% full', time: '2 mins ago' },
            { id: 2, type: 'info', message: 'Route R001 completed', time: '15 mins ago' },
            { id: 3, type: 'danger', message: 'Bin #7 offline', time: '1 hour ago' }
        ];
    } catch (error) {
        console.error('Error fetching alerts:', error);
    }
}

// Overview section
function updateOverviewStats() {
    document.getElementById('totalBins').textContent = systemData.bins.length;
    document.getElementById('totalUsers').textContent = systemData.users.length;
    document.getElementById('activeRoutes').textContent = systemData.routes.filter(r => r.status === 'active').length;
    document.getElementById('alertCount').textContent = systemData.alerts.length;

    updateCharts();
}

// Bin Management (Enhanced)
function loadBins() {
    const tbody = document.querySelector('#dustbinTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    systemData.bins.forEach(bin => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${bin.id}</td>
            <td>${bin.location}</td>
            <td>
                <div class="fill-indicator">
                    <div class="fill-bar">
                        <div class="fill-progress" style="width: ${bin.fullness || 0}%"></div>
                    </div>
                    <span>${bin.fullness || 0}%</span>
                </div>
            </td>
            <td><span class="status-badge ${bin.status}">${bin.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewBinDetails(${bin.id})">View</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBin(${bin.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteBin(binId) {
    if (!confirm('Are you sure you want to delete this bin?')) return;

    try {
        // Delete from Supabase
        const { error } = await supabase.from("bins").delete().eq("id", binId);
        if (error) throw error;

        systemData.bins = systemData.bins.filter(b => b.id !== binId);
        loadBins();
        showToast('Bin deleted successfully');
    } catch (error) {
        console.error('Error deleting bin:', error);
        showToast('Error deleting bin', 'error');
    }
}

function exportBinData() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Location,Latitude,Longitude,Fullness,Status,Capacity\n"
        + systemData.bins.map(bin => 
            `${bin.id},${bin.location},${bin.latitude},${bin.longitude},${bin.fullness},${bin.status},${bin.capacity}`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bins_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// User Management
function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    systemData.users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${user.role}</span></td>
            <td><span class="status-badge ${user.status}">${user.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Setup search
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterUsers(e.target.value));
    }
}

function filterUsers(searchTerm) {
    const rows = document.querySelectorAll('#usersTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
}

function openAddUserModal() {
    document.getElementById('addUserModal').classList.add('active');
}

function editUser(userId) {
    const user = systemData.users.find(u => u.id === userId);
    if (!user) return;

    // Populate form with user data
    const form = document.getElementById('addUserForm');
    form.name.value = user.name;
    form.email.value = user.email;
    form.role.value = user.role;

    document.getElementById('addUserModal').classList.add('active');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        systemData.users = systemData.users.filter(u => u.id !== userId);
        loadUsers();
        showToast('User deleted successfully');
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user', 'error');
    }
}

// Route Analytics
function loadRoutes() {
    const tbody = document.querySelector('#routesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    systemData.routes.forEach(route => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.id}</td>
            <td>${route.driver}</td>
            <td>${route.distance} km</td>
            <td>${route.bins}</td>
            <td><span class="status-badge ${route.status}">${route.status}</span></td>
            <td>${route.efficiency}%</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewRouteDetails('${route.id}')">View</button>
                <button class="btn btn-sm btn-secondary" onclick="optimizeRoute('${route.id}')">Optimize</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateRouteStats();
}

function updateRouteStats() {
    const activeRoutes = systemData.routes.filter(r => r.status === 'active');
    const avgDistance = activeRoutes.reduce((sum, r) => sum + r.distance, 0) / activeRoutes.length || 0;
    const totalBins = activeRoutes.reduce((sum, r) => sum + r.bins, 0);
    const avgEfficiency = activeRoutes.reduce((sum, r) => sum + r.efficiency, 0) / activeRoutes.length || 0;

    document.getElementById('avgRouteDistance').textContent = `${avgDistance.toFixed(1)} km`;
    document.getElementById('totalCollections').textContent = totalBins;
    document.getElementById('fuelSaved').textContent = `${(avgEfficiency * 0.5).toFixed(1)} L`;
    document.getElementById('timeSaved').textContent = `${(avgEfficiency * 0.1).toFixed(1)} hrs`;
}

async function optimizeAllRoutes() {
    showLoading();
    try {
        // Call route optimization API
        const response = await fetch('/api/optimize-routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            await fetchRoutes();
            showToast('All routes optimized successfully');
        } else {
            throw new Error('Optimization failed');
        }
    } catch (error) {
        console.error('Error optimizing routes:', error);
        showToast('Error optimizing routes', 'error');
    } finally {
        hideLoading();
    }
}

// System Monitoring
function loadMonitoringData() {
    loadAlerts();
    loadLogs();
    updateSystemHealth();
    updatePerformanceChart();
}

function loadAlerts() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;

    alertsList.innerHTML = '';
    systemData.alerts.forEach(alert => {
        const alertItem = document.createElement('div');
        alertItem.className = `alert-item ${alert.type}`;
        alertItem.innerHTML = `
            <div class="alert-header">
                <span class="alert-type">${alert.type.toUpperCase()}</span>
                <span class="alert-time">${alert.time}</span>
            </div>
            <p>${alert.message}</p>
        `;
        alertsList.appendChild(alertItem);
    });
}

function loadLogs() {
    const logsContainer = document.getElementById('logsContainer');
    if (!logsContainer) return;

    // Mock logs data
    const logs = [
        { time: '10:30:45', level: 'INFO', message: 'User login: admin@wastewise.com' },
        { time: '10:28:12', level: 'WARNING', message: 'Bin #7 connection lost' },
        { time: '10:25:33', level: 'INFO', message: 'Route R001 started' },
        { time: '10:22:18', level: 'ERROR', message: 'API request timeout' },
        { time: '10:20:05', level: 'INFO', message: 'System backup completed' }
    ];

    logsContainer.innerHTML = '';
    logs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.innerHTML = `
            <span class="log-time">${log.time}</span>
            <span class="log-level ${log.level.toLowerCase()}">${log.level}</span>
            <span class="log-message">${log.message}</span>
        `;
        logsContainer.appendChild(logItem);
    });
}

function updateSystemHealth() {
    // Check system health indicators
    const indicators = document.querySelectorAll('.status-indicator');
    indicators.forEach(indicator => {
        // Mock health check - replace with actual health checks
        if (Math.random() > 0.1) {
            indicator.classList.add('online');
            indicator.classList.remove('offline', 'warning');
        } else {
            indicator.classList.add('offline');
            indicator.classList.remove('online', 'warning');
        }
    });
}

// Charts
function initializeCharts() {
    // Collection Trends Chart
    const collectionCtx = document.getElementById('collectionChart');
    if (collectionCtx) {
        charts.collection = new Chart(collectionCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Collections',
                    data: [12, 19, 15, 25, 22, 30, 28],
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Fill Levels Chart
    const fillLevelCtx = document.getElementById('fillLevelChart');
    if (fillLevelCtx) {
        charts.fillLevel = new Chart(fillLevelCtx, {
            type: 'doughnut',
            data: {
                labels: ['Low (0-30%)', 'Medium (31-70%)', 'High (71-100%)'],
                datasets: [{
                    data: [30, 45, 25],
                    backgroundColor: ['#2e7d32', '#ff9800', '#e53935']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Performance Chart
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx) {
        charts.performance = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
                datasets: [{
                    label: 'CPU Usage',
                    data: [30, 25, 40, 65, 55, 45, 35],
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Memory Usage',
                    data: [40, 35, 50, 70, 60, 50, 45],
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }
}

function updateCharts() {
    // Update chart data with real data
    if (charts.fillLevel && systemData.bins.length > 0) {
        const low = systemData.bins.filter(b => (b.fullness || 0) <= 30).length;
        const medium = systemData.bins.filter(b => (b.fullness || 0) > 30 && (b.fullness || 0) <= 70).length;
        const high = systemData.bins.filter(b => (b.fullness || 0) > 70).length;
        
        charts.fillLevel.data.datasets[0].data = [low, medium, high];
        charts.fillLevel.update();
    }

    // Update collection chart with route data
    if (charts.collection && systemData.routes.length > 0) {
        const collectionsByDay = [12, 19, 15, 25, 22, 30, 28]; // Mock data - replace with real data
        charts.collection.data.datasets[0].data = collectionsByDay;
        charts.collection.update();
    }
}

function updatePerformanceChart() {
    if (charts.performance) {
        // Generate random performance data for demonstration
        const cpuData = Array.from({length: 7}, () => Math.floor(Math.random() * 40) + 30);
        const memoryData = Array.from({length: 7}, () => Math.floor(Math.random() * 30) + 40);
        
        charts.performance.data.datasets[0].data = cpuData;
        charts.performance.data.datasets[1].data = memoryData;
        charts.performance.update();
    }
}

// Real-time updates
function startRealTimeUpdates() {
    // Update data every 30 seconds
    setInterval(() => {
        if (currentSection === 'monitoring') {
            updateSystemHealth();
            loadAlerts();
        }
        if (currentSection === 'overview') {
            updateOverviewStats();
        }
    }, 30000);
}

// Modal functions
function initializeModals() {
    // Setup form submissions
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }

    // Close modals on overlay click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

async function handleAddUser(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role'),
            status: 'active'
        };

        // Add user to system
        userData.id = systemData.users.length + 1;
        systemData.users.push(userData);

        closeModal('addUserModal');
        loadUsers();
        showToast('User added successfully');
        event.target.reset();
    } catch (error) {
        console.error('Error adding user:', error);
        showToast('Error adding user', 'error');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = 'toast';
    
    if (type === 'error') {
        toast.style.background = '#e53935';
    } else {
        toast.style.background = '#2e7d32';
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Export functions for global access
window.openAddUserModal = openAddUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.deleteBin = deleteBin;
window.exportBinData = exportBinData;
window.viewBinDetails = viewBinDetails;
window.viewRouteDetails = viewRouteDetails;
window.optimizeRoute = optimizeRoute;
window.optimizeAllRoutes = optimizeAllRoutes;
window.closeModal = closeModal;

// Placeholder functions for undefined references
function viewBinDetails(binId) {
    console.log('View bin details:', binId);
    showToast('Bin details feature coming soon');
}

function viewRouteDetails(routeId) {
    console.log('View route details:', routeId);
    showToast('Route details feature coming soon');
}

function optimizeRoute(routeId) {
    console.log('Optimize route:', routeId);
    showToast('Route optimization feature coming soon');
}

// Enhanced dustbin form handling (integration with existing adminDashboard.js)
document.addEventListener('DOMContentLoaded', () => {
    // If the existing dustbin form exists, enhance it
    const dustbinForm = document.getElementById('dustbinForm');
    if (dustbinForm) {
        dustbinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const binData = {
                    location: document.getElementById('dustbinLocationInput').value,
                    latitude: parseFloat(document.getElementById('dustbinLatitudeInput').value),
                    longitude: parseFloat(document.getElementById('dustbinLongitudeInput').value),
                    capacity: parseInt(document.getElementById('dustbinCapacityInput').value) || 100,
                    fullness: 0,
                    status: 'active'
                };

                // Add to Supabase
                const { data, error } = await supabase.from("bins").insert([binData]).select();
                if (error) throw error;

                // Add WiFi provisioning if provided
                const ssid = document.getElementById('dustbinSsidInput').value;
                const wifiPassword = document.getElementById('dustbinWifiPasswordInput').value;
                
                if (ssid && wifiPassword) {
                    await fetch('/provision', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-admin-key': 'dev-default-key'
                        },
                        body: JSON.stringify({ 
                            binId: data[0].id, 
                            ssid, 
                            wifiPassword, 
                            location: binData.location 
                        })
                    });
                }

                // Reset form
                dustbinForm.reset();
                
                // Reload bins
                await fetchBins();
                loadBins();
                
                showToast('Bin added successfully');
            } catch (error) {
                console.error('Error adding bin:', error);
                showToast('Error adding bin', 'error');
            }
        });
    }
});

// Logout function
function logout() {
    localStorage.removeItem('adminLoggedIn');
    window.location.href = 'adminlogin.html';
}

window.logout = logout;
