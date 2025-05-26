import storage from './storage.js';
import tradeManager from './trades.js';
import chartManager from './charts.js';

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Initialize event listeners
    setupEventListeners();
    
    // Initialize the UI
    tradeManager.updateUI();
}

function setupEventListeners() {
    // Export button
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }
    
    // Import button and file input
    const importBtn = document.getElementById('import-data');
    const importFileInput = document.getElementById('import-file');
    
    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', handleImportData);
    }
}

async function handleExportData() {
    try {
        const data = storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Failed to export data', 'error');
    }
}

async function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const success = await storage.importData(e.target.result);
            if (success) {
                // Refresh the UI with the new data
                tradeManager.trades = storage.getTrades();
                tradeManager.setupTags = storage.getSetupTags();
                tradeManager.updateUI();
                showToast('Data imported successfully!');
            } else {
                showToast('Failed to import data: Invalid format', 'error');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            showToast('Error importing data', 'error');
        }
        
        // Reset the file input
        event.target.value = '';
    };
    
    reader.onerror = () => {
        console.error('Error reading file');
        showToast('Error reading file', 'error');
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// Helper function to show toast notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    // Hide the toast after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.initializeApp();
    }

    initializeApp() {
        this.initializeTheme();
        this.initializeNavigation();
        this.initializeDataManagement();
        this.showPage(this.currentPage);
    }

    initializeTheme() {
        const theme = storage.getTheme();
        document.body.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Update theme icon
        this.updateThemeIcon(theme);
    }

    updateThemeIcon(theme) {
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    initializeNavigation() {
        document.querySelectorAll('.nav-links li').forEach(item => {
            item.addEventListener('click', () => {
                const pageId = item.getAttribute('data-page');
                this.showPage(pageId);
                
                // Reset form when navigating to Add Trade page
                if (pageId === 'add-trade') {
                    const form = document.getElementById('trade-form');
                    if (form) {
                        form.reset();
                        delete form.dataset.editId;
                        const formTitle = form.querySelector('h2');
                        const submitButton = form.querySelector('button[type="submit"]');
                        if (formTitle) formTitle.textContent = 'Add New Trade';
                        if (submitButton) submitButton.textContent = 'Add Trade';
                    }
                }
            });
        });
    }

    initializeDataManagement() {
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');

        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => this.importData(e));
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Remove active class from all nav links
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected page
        const selectedPage = document.getElementById(pageId);
        if (selectedPage) {
            selectedPage.classList.add('active');
            this.currentPage = pageId;

            // Add active class to corresponding nav link
            const activeLink = document.querySelector(`.nav-links li[data-page="${pageId}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }

            // Update charts if on analytics page
            if (pageId === 'analytics') {
                chartManager.updateAllCharts();
            }
        }
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        storage.setTheme(newTheme);
        this.updateThemeIcon(newTheme);
    }

    exportData() {
        const data = storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trading_journal_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Data exported successfully', 'success');
    }

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const success = await storage.importData(e.target.result);
            if (success) {
                this.showToast('Data imported successfully', 'success');
                // Refresh the current view
                if (this.currentPage === 'dashboard') {
                    tradeManager.updateDashboardStats();
                } else if (this.currentPage === 'trade-history') {
                    tradeManager.updateTradeHistory();
                } else if (this.currentPage === 'analytics') {
                    chartManager.updateAllCharts();
                }
            } else {
                this.showToast('Error importing data', 'error');
            }
        };
        reader.readAsText(file);
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

// Create and export a single instance
const app = new App();
export default app; 