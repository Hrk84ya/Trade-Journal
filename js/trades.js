import storage from './storage.js';
import chartManager from './charts.js';

class TradeManager {
    constructor() {
        this.trades = storage.getTrades();
        this.setupTags = storage.getSetupTags();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Trade form submission
        const tradeForm = document.getElementById('trade-form');
        if (tradeForm) {
            tradeForm.addEventListener('submit', (e) => this.handleTradeSubmit(e));
        }

        // Trade history table sorting
        const tableHeaders = document.querySelectorAll('th[data-sort]');
        tableHeaders.forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });

        // Trade filters
        const searchInput = document.getElementById('search-trades');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Date filters
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        if (dateFrom && dateTo) {
            dateFrom.addEventListener('change', () => this.applyFilters());
            dateTo.addEventListener('change', () => this.applyFilters());
        }

        // Setup filter
        const setupFilter = document.getElementById('filter-setup');
        if (setupFilter) {
            setupFilter.addEventListener('change', () => this.applyFilters());
        }

        // Result filter
        const resultFilter = document.getElementById('filter-result');
        if (resultFilter) {
            resultFilter.addEventListener('change', () => this.applyFilters());
        }

        // Initialize the UI
        this.updateUI();
    }

    // Trade form handling
    async handleTradeSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const trade = {
            ticker: formData.get('ticker').toUpperCase(),
            direction: formData.get('direction'),
            entryDate: formData.get('entry-date'),
            exitDate: formData.get('exit-date'),
            entryPrice: parseFloat(formData.get('entry-price')),
            exitPrice: parseFloat(formData.get('exit-price')),
            positionSize: parseInt(formData.get('position-size')),
            setup: formData.get('setup'),
            notes: formData.get('notes')
        };

        // Calculate P&L and R:R
        trade.pnl = this.calculatePnL(trade);
        trade.rr = this.calculateRR(trade);

        try {
            // Check if this is an edit or new trade
            const isEdit = form.dataset.editId;
            
            if (isEdit) {
                // Update existing trade
                trade.id = form.dataset.editId;
                await storage.updateTrade(trade.id, trade);
                this.showToast('Trade updated successfully!');
                delete form.dataset.editId;
            } else {
                // Add new trade
                trade.id = Date.now().toString();
                await storage.addTrade(trade);
                this.showToast('Trade added successfully!');
            }

            // Update local state
            this.trades = storage.getTrades();
            
            // Reset form and update UI
            form.reset();
            this.updateUI();
            
            // Navigate back to dashboard
            document.querySelector('.nav-links li[data-page="dashboard"]')?.click();
            
        } catch (error) {
            console.error('Error saving trade:', error);
            this.showToast('Error saving trade. Please try again.');
        }
    }

    // Trade calculations
    calculatePnL(trade) {
        const priceDiff = trade.exitPrice - trade.entryPrice;
        const multiplier = trade.direction === 'long' ? 1 : -1;
        return priceDiff * trade.positionSize * multiplier;
    }

    calculateRR(trade) {
        const priceDiff = Math.abs(trade.exitPrice - trade.entryPrice);
        const entryPrice = trade.entryPrice;
        return (priceDiff / entryPrice) * 100;
    }

    // Trade sorting
    handleSort(column) {
        const trades = this.getFilteredTrades();
        trades.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // Handle date sorting
            if (column === 'entryDate' || column === 'exitDate') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            }

            // Handle numeric sorting
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return valueA - valueB;
            }

            // Handle string sorting
            return String(valueA).localeCompare(String(valueB));
        });

        this.renderTradesTable(trades);
    }

    // Trade filtering
    handleSearch(query) {
        this.applyFilters();
    }

    applyFilters() {
        const trades = this.getFilteredTrades();
        this.renderTradesTable(trades);
    }

    getFilteredTrades() {
        let trades = [...this.trades];
        const searchQuery = document.getElementById('search-trades')?.value.toLowerCase();
        const dateFrom = document.getElementById('date-from')?.value;
        const dateTo = document.getElementById('date-to')?.value;
        const setupFilter = document.getElementById('filter-setup')?.value;
        const resultFilter = document.getElementById('filter-result')?.value;

        // Apply search filter
        if (searchQuery) {
            trades = trades.filter(trade => 
                trade.ticker.toLowerCase().includes(searchQuery) ||
                trade.setup.toLowerCase().includes(searchQuery) ||
                trade.notes?.toLowerCase().includes(searchQuery)
            );
        }

        // Apply date filters
        if (dateFrom) {
            trades = trades.filter(trade => trade.entryDate >= dateFrom);
        }
        if (dateTo) {
            trades = trades.filter(trade => trade.entryDate <= dateTo);
        }

        // Apply setup filter
        if (setupFilter) {
            trades = trades.filter(trade => trade.setup === setupFilter);
        }

        // Apply result filter
        if (resultFilter) {
            trades = trades.filter(trade => {
                const pnl = this.calculatePnL(trade);
                if (resultFilter === 'win') return pnl > 0;
                if (resultFilter === 'loss') return pnl < 0;
                if (resultFilter === 'breakeven') return pnl === 0;
                return true;
            });
        }

        return trades;
    }

    // UI Updates
    updateUI() {
        this.updateStats();
        this.updateRecentTrades();
        this.updateTradeHistory();
        chartManager.updateAllCharts();
    }

    updateStats() {
        const trades = this.trades;
        const totalTrades = trades.length;
        const winningTrades = trades.filter(trade => this.calculatePnL(trade) > 0).length;
        const totalPnL = trades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0);
        const avgRR = trades.reduce((sum, trade) => sum + this.calculateRR(trade), 0) / totalTrades || 0;

        document.getElementById('total-trades').textContent = totalTrades;
        document.getElementById('win-rate').textContent = `${((winningTrades / totalTrades) * 100 || 0).toFixed(1)}%`;
        document.getElementById('total-pnl').textContent = `$${totalPnL.toFixed(2)}`;
        document.getElementById('avg-rr').textContent = avgRR.toFixed(2);
    }

    updateRecentTrades() {
        const recentTrades = [...this.trades]
            .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate))
            .slice(0, 5);

        const tbody = document.querySelector('#recent-trades-table tbody');
        if (tbody) {
            tbody.innerHTML = recentTrades.map(trade => this.createTradeRow(trade)).join('');
        }
    }

    updateTradeHistory() {
        const trades = this.getFilteredTrades();
        this.renderTradesTable(trades);
    }

    renderTradesTable(trades) {
        const tbody = document.querySelector('#trades-table tbody');
        if (tbody) {
            tbody.innerHTML = trades.map(trade => this.createTradeRow(trade)).join('');
        }
    }

    createTradeRow(trade) {
        const pnl = this.calculatePnL(trade);
        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '';
        
        return `
            <tr>
                <td>${new Date(trade.entryDate).toLocaleDateString()}</td>
                <td>${trade.ticker}</td>
                <td>${trade.direction}</td>
                <td>$${trade.entryPrice.toFixed(2)}</td>
                <td>$${trade.exitPrice.toFixed(2)}</td>
                <td class="${pnlClass}">$${pnl.toFixed(2)}</td>
                <td>${trade.setup}</td>
                <td>
                    <button onclick="tradeManager.editTrade('${trade.id}')" class="btn-secondary">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="tradeManager.deleteTrade('${trade.id}')" class="btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    // Trade actions
    async editTrade(tradeId) {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade) return;

        // Navigate to the add trade page
        document.querySelectorAll('.nav-links li').forEach(li => {
            if (li.dataset.page === 'add-trade') {
                li.click();
            }
        });

        // Wait for the form to be visible
        await new Promise(resolve => setTimeout(resolve, 100));

        // Populate form with trade data
        const form = document.getElementById('trade-form');
        if (!form) return;

        // Store the trade ID for update
        form.dataset.editId = tradeId;

        // Populate form fields
        form.elements['ticker'].value = trade.ticker || '';
        form.elements['direction'].value = trade.direction || 'long';
        form.elements['entry-date'].value = trade.entryDate ? trade.entryDate.split('T')[0] : '';
        form.elements['exit-date'].value = trade.exitDate ? trade.exitDate.split('T')[0] : '';
        form.elements['entry-price'].value = trade.entryPrice || '';
        form.elements['exit-price'].value = trade.exitPrice || '';
        form.elements['position-size'].value = trade.positionSize || '';
        form.elements['setup'].value = trade.setup || '';
        form.elements['notes'].value = trade.notes || '';

        // Update form title and submit button
        const formTitle = form.querySelector('h2');
        const submitButton = form.querySelector('button[type="submit"]');
        if (formTitle) formTitle.textContent = 'Edit Trade';
        if (submitButton) submitButton.textContent = 'Update Trade';
    }

    async deleteTrade(tradeId) {
        if (!confirm('Are you sure you want to delete this trade?')) {
            return;
        }

        try {
            await storage.deleteTrade(tradeId);
            this.trades = storage.getTrades();
            this.updateUI();
            this.showToast('Trade deleted successfully!');
        } catch (error) {
            console.error('Error deleting trade:', error);
            this.showToast('Error deleting trade. Please try again.');
        }
    }

    // Utility functions
    showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }
}

// Create and export a single instance
const tradeManager = new TradeManager();

// Make tradeManager globally accessible for inline event handlers
window.tradeManager = tradeManager;

export default tradeManager;