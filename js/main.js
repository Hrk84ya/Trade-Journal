import storage from './storage.js';
import tradeManager from './trades.js';
import chartManager from './charts.js';

class App {
    constructor() {
        this.currentPage = 'dashboard';
    }

    async start() {
        // Wait for storage to finish loading server data before touching the UI
        await storage.ready;

        // Refresh trade data now that storage is ready
        tradeManager.trades = storage.getTrades();
        tradeManager.setupTags = storage.getSetupTags();

        this.initializeTheme();
        this.initializeNavigation();
        this.initializeDataManagement();
        this.showPage(this.currentPage);

        // Initial UI render
        tradeManager.updateUI();
    }

    // --- Theme ---

    initializeTheme() {
        const theme = storage.getTheme();
        document.body.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        storage.setTheme(newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // --- Navigation ---

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
                        const formTitle = document.querySelector('#add-trade h2');
                        const submitButton = form.querySelector('button[type="submit"]');
                        if (formTitle) formTitle.textContent = 'Add New Trade';
                        if (submitButton) submitButton.textContent = 'Save Trade';
                    }
                }
            });
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-links li').forEach(link => link.classList.remove('active'));

        const selectedPage = document.getElementById(pageId);
        if (selectedPage) {
            selectedPage.classList.add('active');
            this.currentPage = pageId;

            const activeLink = document.querySelector(`.nav-links li[data-page="${pageId}"]`);
            if (activeLink) activeLink.classList.add('active');

            if (pageId === 'analytics') {
                chartManager.updateAllCharts();
            }
        }
    }

    // --- Data Management ---

    initializeDataManagement() {
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => this.importData(e));
        }
    }

    exportData() {
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

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const success = await storage.importData(e.target.result);
                if (success) {
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
            event.target.value = '';
        };
        reader.onerror = () => {
            console.error('Error reading file');
            showToast('Error reading file', 'error');
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}

// --- Toast helper (module-scoped) ---

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// --- Bootstrap ---

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();
});
