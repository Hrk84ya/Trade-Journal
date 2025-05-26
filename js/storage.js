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
            // Try to load data from server
            const response = await fetch('/trading_journal_data.json');
            if (response.ok) {
                const data = await response.json();
                this.loadData(data);
            } else {
                // If no data exists, initialize with defaults
                this.initializeWithDefaults();
            }
        } catch (error) {
            console.log('Error loading data, initializing with defaults', error);
            this.initializeWithDefaults();
        }
    }

    async initializeWithDefaults() {
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify([]));
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(this.DEFAULT_SETUP_TAGS));
        localStorage.setItem(this.STORAGE_KEYS.THEME, 'light');
        try {
            await this.saveToServer();
        } catch (error) {
            console.error('Failed to initialize with defaults on server:', error);
            // Continue even if server save fails, as we've set the local storage
        }
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

    async saveToServer() {
        try {
            const data = {
                trades: this.getTrades(),
                setupTags: this.getSetupTags(),
                theme: this.getTheme()
            };
            
            // Save data to server
            const response = await fetch('/trading_journal_data.json', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data, null, 2)
            });

            if (!response.ok) {
                throw new Error('Failed to save data');
            }
            
            console.log('Data saved successfully');
        } catch (error) {
            console.error('Error saving data:', error);
            throw error; // Re-throw to allow error handling in calling code
        }
    }

    // Trade management
    async addTrade(trade) {
        const trades = this.getTrades();
        trade.id = Date.now().toString(); // Generate unique ID
        trades.push(trade);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
        try {
            await this.saveToServer();
        } catch (error) {
            console.error('Failed to save trade to server:', error);
            throw error; // Re-throw to handle in the UI
        }
    }

    async updateTrade(tradeId, updatedTrade) {
        const trades = this.getTrades();
        const index = trades.findIndex(trade => trade.id === tradeId);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...updatedTrade };
            localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
            try {
                await this.saveToServer();
            } catch (error) {
                console.error('Failed to update trade on server:', error);
                throw error;
            }
        }
    }

    async deleteTrade(tradeId) {
        const trades = this.getTrades();
        const filteredTrades = trades.filter(trade => trade.id !== tradeId);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(filteredTrades));
        try {
            await this.saveToServer();
        } catch (error) {
            console.error('Failed to delete trade from server:', error);
            throw error;
        }
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
            try {
                await this.saveToServer();
            } catch (error) {
                console.error('Failed to save setup tag to server:', error);
                throw error;
            }
        }
    }

    async removeSetupTag(tag) {
        const tags = this.getSetupTags();
        const filteredTags = tags.filter(t => t !== tag);
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(filteredTags));
        try {
            await this.saveToServer();
        } catch (error) {
            console.error('Failed to remove setup tag from server:', error);
            throw error;
        }
    }

    getSetupTags() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SETUP_TAGS)) || this.DEFAULT_SETUP_TAGS;
    }

    // Theme management
    async setTheme(theme) {
        localStorage.setItem(this.STORAGE_KEYS.THEME, theme);
        try {
            await this.saveToServer();
        } catch (error) {
            console.error('Failed to save theme to server:', error);
            // Don't throw for theme changes to avoid breaking UI
        }
    }

    getTheme() {
        return localStorage.getItem(this.STORAGE_KEYS.THEME) || 'light';
    }

    // Data export/import
    exportData() {
        try {
            const data = {
                version: '1.0',
                lastUpdated: new Date().toISOString(),
                trades: this.getTrades(),
                setupTags: this.getSetupTags(),
                theme: this.getTheme()
            };
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async importData(data) {
        try {
            const parsedData = JSON.parse(data);
            
            // Validate the imported data structure
            if (!parsedData || typeof parsedData !== 'object') {
                console.error('Invalid data format');
                return false;
            }
            
            // Create a backup of current data before importing
            const backup = {
                trades: this.getTrades(),
                setupTags: this.getSetupTags(),
                theme: this.getTheme()
            };
            
            try {
                // Load the new data
                this.loadData(parsedData);
                
                // Save to server
                await this.saveToServer();
                
                // If we got here, the import was successful
                return true;
                
            } catch (error) {
                // Restore from backup if something goes wrong
                console.error('Error during import, restoring backup:', error);
                this.loadData(backup);
                throw error;
            }
            
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data
    async clearData() {
        await this.initializeWithDefaults();
    }
}

// Create and export a single instance
const storage = new Storage();
export default storage; 