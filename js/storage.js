class Storage {
    constructor() {
        this.STORAGE_KEYS = {
            TRADES: 'trades',
            SETUP_TAGS: 'setup_tags',
            CUSTOM_TAGS: 'custom_tags',
            JOURNAL: 'journal_entries',
            THEME: 'theme'
        };

        this.DEFAULT_SETUP_TAGS = [
            'Breakout', 'Breakdown', 'Reversal', 'Continuation',
            'Gap Fill', 'VWAP Bounce', 'Moving Avg Bounce', 'Pullback',
            'Momentum', 'Mean Reversion', 'Scalp', 'Swing'
        ];

        this.DEFAULT_CUSTOM_TAGS = [
            'High Conviction', 'Earnings Play', 'News Catalyst',
            'Technical', 'Fundamental', 'Revenge Trade', 'FOMO'
        ];

        this.DATA_FILE = 'trading_journal_data.json';
        this.ready = this.initializeStorage();
    }

    async initializeStorage() {
        try {
            const response = await fetch('/trading_journal_data.json');
            if (response.ok) {
                const data = await response.json();
                this.loadData(data);
            } else {
                await this.initializeWithDefaults();
            }
        } catch (error) {
            console.log('Error loading data, initializing with defaults', error);
            await this.initializeWithDefaults();
        }
    }

    async initializeWithDefaults() {
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify([]));
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(this.DEFAULT_SETUP_TAGS));
        localStorage.setItem(this.STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(this.DEFAULT_CUSTOM_TAGS));
        localStorage.setItem(this.STORAGE_KEYS.JOURNAL, JSON.stringify({}));
        localStorage.setItem(this.STORAGE_KEYS.THEME, 'light');
        try { await this.saveToServer(); }
        catch (error) { console.error('Failed to initialize with defaults on server:', error); }
    }

    loadData(data) {
        if (data.trades) localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(data.trades));
        if (data.setupTags) localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(data.setupTags));
        if (data.customTags) localStorage.setItem(this.STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(data.customTags));
        if (data.journal) localStorage.setItem(this.STORAGE_KEYS.JOURNAL, JSON.stringify(data.journal));
        if (data.theme) localStorage.setItem(this.STORAGE_KEYS.THEME, data.theme);
    }

    async saveToServer() {
        const data = {
            trades: this.getTrades(),
            setupTags: this.getSetupTags(),
            customTags: this.getCustomTags(),
            journal: this.getAllJournalEntries(),
            theme: this.getTheme()
        };
        const response = await fetch('/trading_journal_data.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data, null, 2)
        });
        if (!response.ok) throw new Error('Failed to save data');
    }

    // --- Trade CRUD ---

    async addTrade(trade) {
        const trades = this.getTrades();
        trade.id = Date.now().toString();
        trades.push(trade);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
        await this.saveToServer();
    }

    async updateTrade(tradeId, updatedTrade) {
        const trades = this.getTrades();
        const index = trades.findIndex(t => t.id === tradeId);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...updatedTrade };
            localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
            await this.saveToServer();
        }
    }

    async deleteTrade(tradeId) {
        const trades = this.getTrades().filter(t => t.id !== tradeId);
        localStorage.setItem(this.STORAGE_KEYS.TRADES, JSON.stringify(trades));
        await this.saveToServer();
    }

    getTrades() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TRADES)) || [];
    }

    // --- Setup tags ---

    getSetupTags() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SETUP_TAGS)) || this.DEFAULT_SETUP_TAGS;
    }

    async addSetupTag(tag) {
        const tags = this.getSetupTags();
        if (!tags.includes(tag)) { tags.push(tag); localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(tags)); await this.saveToServer(); }
    }

    async removeSetupTag(tag) {
        const tags = this.getSetupTags().filter(t => t !== tag);
        localStorage.setItem(this.STORAGE_KEYS.SETUP_TAGS, JSON.stringify(tags));
        await this.saveToServer();
    }

    // --- Custom tags (labels) ---

    getCustomTags() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CUSTOM_TAGS)) || this.DEFAULT_CUSTOM_TAGS;
    }

    async addCustomTag(tag) {
        const tags = this.getCustomTags();
        if (!tags.includes(tag)) { tags.push(tag); localStorage.setItem(this.STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(tags)); await this.saveToServer(); }
    }

    async removeCustomTag(tag) {
        const tags = this.getCustomTags().filter(t => t !== tag);
        localStorage.setItem(this.STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(tags));
        await this.saveToServer();
    }

    // --- Journal entries ---
    // Stored as an object keyed by date string (YYYY-MM-DD)
    // Each entry: { premarket, review, lessons, freeform, updatedAt }

    getAllJournalEntries() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.JOURNAL)) || {};
    }

    getJournalEntry(dateStr) {
        const all = this.getAllJournalEntries();
        return all[dateStr] || null;
    }

    async saveJournalEntry(dateStr, entry) {
        const all = this.getAllJournalEntries();
        all[dateStr] = { ...entry, updatedAt: new Date().toISOString() };
        localStorage.setItem(this.STORAGE_KEYS.JOURNAL, JSON.stringify(all));
        await this.saveToServer();
    }

    async deleteJournalEntry(dateStr) {
        const all = this.getAllJournalEntries();
        delete all[dateStr];
        localStorage.setItem(this.STORAGE_KEYS.JOURNAL, JSON.stringify(all));
        await this.saveToServer();
    }

    getJournalDates() {
        return Object.keys(this.getAllJournalEntries()).sort().reverse();
    }

    // --- Theme ---

    async setTheme(theme) {
        localStorage.setItem(this.STORAGE_KEYS.THEME, theme);
        try { await this.saveToServer(); } catch (e) { /* non-critical */ }
    }

    getTheme() {
        return localStorage.getItem(this.STORAGE_KEYS.THEME) || 'light';
    }

    // --- Export / Import ---

    exportData() {
        return JSON.stringify({
            version: '2.0',
            lastUpdated: new Date().toISOString(),
            trades: this.getTrades(),
            setupTags: this.getSetupTags(),
            customTags: this.getCustomTags(),
            journal: this.getAllJournalEntries(),
            theme: this.getTheme()
        }, null, 2);
    }

    async importData(data) {
        try {
            const parsedData = JSON.parse(data);
            if (!parsedData || typeof parsedData !== 'object') return false;

            const backup = {
                trades: this.getTrades(),
                setupTags: this.getSetupTags(),
                customTags: this.getCustomTags(),
                journal: this.getAllJournalEntries(),
                theme: this.getTheme()
            };
            try {
                this.loadData(parsedData);
                await this.saveToServer();
                return true;
            } catch (error) {
                this.loadData(backup);
                throw error;
            }
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    async clearData() { await this.initializeWithDefaults(); }
}

const storage = new Storage();
export default storage;
