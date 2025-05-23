class Storage {
    constructor() {
        this.STORAGE_KEYS = {
            TRADES: 'trades',
            SETUP_TAGS: 'setup_tags',
            THEME: 'theme'
        };

        this.DEFAULT_SETUP_TAGS = [
            'Breakout',
            'Breakdown',
            'Reversal',
            'Continuation'
        ];

        this.DATA_FILE = 'trading_journal_data.json';
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            // Try to load data from file
            const response = await fetch(this.DATA_FILE);
            if (response.ok) {
                const data = await response.json();
                this.loadData(data);
            } else {
                // If file doesn't exist, initialize with defaults
                this.initializeWithDefaults();
            }
        } catch (error) {
            console.log('No existing data file found, initializing with defaults');
            this.initializeWithDefaults();
        }
    }

    initializeWithDefaults() {
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify([]));
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(this.DEFAULT_SETUP_TAGS));
        localStorage.setItem(this.STORAGE_KEYS.THEME, 'light');
        this.saveToFile();
    }

    loadData(data) {
        if (data.trades) {
            localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(data.trades));
        }
        if (data.setupTags) {
            localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(data.setupTags));
        }
        if (data.theme) {
            localStorage.setItem(this.STORAGE_KEYS.THEME, data.theme);
        }
    }

    async saveToFile() {
        const data = {
            trades: this.getTrades(),
            setupTags: this.getSetupTags(),
            theme: this.getTheme()
        };

        try {
            const response = await fetch(this.DATA_FILE, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data, null, 2)
            });

            if (!response.ok) {
                throw new Error('Failed to save data to file');
            }
        } catch (error) {
            console.error('Error saving data to file:', error);
            // Fallback to localStorage only
            console.log('Falling back to localStorage only');
        }
    }

    // Trade management
    async addTrade(trade) {
        const trades = this.getTrades();
        trade.id = Date.now().toString(); // Generate unique ID
        trades.push(trade);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
        await this.saveToFile();
    }

    async updateTrade(tradeId, updatedTrade) {
        const trades = this.getTrades();
        const index = trades.findIndex(trade => trade.id === tradeId);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...updatedTrade };
            localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
            await this.saveToFile();
        }
    }

    async deleteTrade(tradeId) {
        const trades = this.getTrades();
        const filteredTrades = trades.filter(trade => trade.id !== tradeId);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(filteredTrades));
        await this.saveToFile();
    }

    getTrades() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TRADES)) || [];
    }

    // Setup tags management
    async addSetupTag(tag) {
        const tags = this.getSetupTags();
        if (!tags.includes(tag)) {
            tags.push(tag);
            localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(tags));
            await this.saveToFile();
        }
    }

    async removeSetupTag(tag) {
        const tags = this.getSetupTags();
        const filteredTags = tags.filter(t => t !== tag);
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(filteredTags));
        await this.saveToFile();
    }

    getSetupTags() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SETUP_TAGS)) || this.DEFAULT_SETUP_TAGS;
    }

    // Theme management
    async setTheme(theme) {
        localStorage.setItem(this.STORAGE_KEYS.THEME, theme);
        await this.saveToFile();
    }

    getTheme() {
        return localStorage.getItem(this.STORAGE_KEYS.THEME) || 'light';
    }

    // Data export/import
    exportData() {
        const data = {
            trades: this.getTrades(),
            setupTags: this.getSetupTags(),
            theme: this.getTheme()
        };
        return JSON.stringify(data, null, 2);
    }

    async importData(data) {
        try {
            const parsedData = JSON.parse(data);
            this.loadData(parsedData);
            await this.saveToFile();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data
    async clearData() {
        this.initializeWithDefaults();
    }
}

// Create and export a single instance
const storage = new Storage();
export default storage; 