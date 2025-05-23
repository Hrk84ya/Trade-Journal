import storage from './storage.js';
import tradeManager from './trades.js';
import chartManager from './charts.js';

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
        const navLinks = document.querySelectorAll('.nav-links li');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const page = link.getAttribute('data-page');
                this.showPage(page);
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