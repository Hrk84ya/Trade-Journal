import storage from './storage.js';
import chartManager from './charts.js';

const SORT_COLUMN_MAP = {
    entryDate: 'entryDate', ticker: 'ticker', assetClass: 'assetClass',
    direction: 'direction', netPnl: 'netPnl', rr: 'rr', setup: 'setup'
};

class TradeManager {
    constructor() {
        this.trades = storage.getTrades();
        this.setupTags = storage.getSetupTags();
        this.entryIndex = 1;
        this.exitIndex = 1;
        this.pendingScreenshots = []; // files waiting to be uploaded on save
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const form = document.getElementById('trade-form');
        if (form) form.addEventListener('submit', (e) => this.handleTradeSubmit(e));

        // Table sorting
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });

        // Filters
        const ids = ['search-trades', 'date-from', 'date-to', 'filter-setup', 'filter-result', 'filter-asset-class'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', () => this.applyFilters());
        });

        // Event delegation for edit/delete/view buttons
        document.addEventListener('click', (e) => {
            const edit = e.target.closest('[data-action="edit"]');
            if (edit) { this.editTrade(edit.dataset.tradeId); return; }
            const del = e.target.closest('[data-action="delete"]');
            if (del) { this.deleteTrade(del.dataset.tradeId); return; }
            const view = e.target.closest('[data-action="view"]');
            if (view) { this.viewTradeDetail(view.dataset.tradeId); return; }
        });

        // Asset class toggle
        const assetClassSelect = document.getElementById('asset-class');
        if (assetClassSelect) assetClassSelect.addEventListener('change', () => this.toggleAssetFields());

        // Partial entries/exits
        document.getElementById('add-entry-btn')?.addEventListener('click', () => this.addPartialRow('entries'));
        document.getElementById('add-exit-btn')?.addEventListener('click', () => this.addPartialRow('exits'));

        // Confidence slider display
        const conf = document.getElementById('confidence');
        if (conf) conf.addEventListener('input', () => {
            document.getElementById('confidence-value').textContent = conf.value;
        });

        // Screenshot file input
        const ssInput = document.getElementById('screenshot-input');
        if (ssInput) ssInput.addEventListener('change', (e) => this.handleScreenshotSelect(e));

        // Custom tag buttons
        document.getElementById('add-setup-tag-btn')?.addEventListener('click', () => this.addNewSetupTag());
        document.getElementById('add-custom-tag-btn')?.addEventListener('click', () => this.addNewCustomTag());

        // Modal close
        document.getElementById('modal-close')?.addEventListener('click', () => {
            document.getElementById('trade-detail-modal').style.display = 'none';
        });

        // Populate dynamic dropdowns
        this.populateSetupDropdown();
        this.populateTagsCheckboxes();
    }

    // --- Dynamic UI helpers ---

    toggleAssetFields() {
        document.querySelectorAll('.asset-fields').forEach(f => f.style.display = 'none');
        const cls = document.getElementById('asset-class')?.value;
        if (cls === 'options') document.getElementById('options-fields').style.display = '';
        else if (cls === 'futures') document.getElementById('futures-fields').style.display = '';
        else if (cls === 'crypto') document.getElementById('crypto-fields').style.display = '';
    }

    addPartialRow(type) {
        const container = document.getElementById(type === 'entries' ? 'entries-container' : 'exits-container');
        const idx = type === 'entries' ? this.entryIndex++ : this.exitIndex++;
        const prefix = type === 'entries' ? 'entry' : 'exit';
        const row = document.createElement('div');
        row.className = 'partial-row';
        row.dataset.index = idx;
        row.innerHTML = `
            <div class="form-grid form-grid-4">
                <div class="form-group">
                    <label>${type === 'entries' ? 'Entry' : 'Exit'} Date</label>
                    <input type="datetime-local" name="${prefix}-date-${idx}" required>
                </div>
                <div class="form-group">
                    <label>${type === 'entries' ? 'Entry' : 'Exit'} Price</label>
                    <input type="number" name="${prefix}-price-${idx}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Shares/Qty</label>
                    <input type="number" name="${prefix}-qty-${idx}" step="any" required>
                </div>
                <div class="form-group form-group-btn">
                    <button type="button" class="btn-icon btn-remove-${prefix}" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>`;
        row.querySelector(`.btn-remove-${prefix}`).addEventListener('click', () => row.remove());
        container.appendChild(row);
    }

    populateSetupDropdown() {
        const select = document.getElementById('setup');
        if (!select) return;
        const tags = storage.getSetupTags();
        select.innerHTML = tags.map(t => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`).join('');
    }

    populateTagsCheckboxes() {
        const container = document.getElementById('tags-container');
        if (!container) return;
        const tags = storage.getCustomTags();
        container.innerHTML = tags.map(t => `
            <label class="tag-checkbox">
                <input type="checkbox" name="tags" value="${this.escapeHtml(t)}">
                <span class="tag-label">${this.escapeHtml(t)}</span>
            </label>
        `).join('');
    }

    async addNewSetupTag() {
        const input = document.getElementById('new-setup-tag');
        const val = input?.value.trim();
        if (!val) return;
        await storage.addSetupTag(val);
        this.populateSetupDropdown();
        input.value = '';
        this.showToast(`Setup "${val}" added`);
    }

    async addNewCustomTag() {
        const input = document.getElementById('new-custom-tag');
        const val = input?.value.trim();
        if (!val) return;
        await storage.addCustomTag(val);
        this.populateTagsCheckboxes();
        input.value = '';
        this.showToast(`Tag "${val}" added`);
    }

    // --- Screenshot handling ---

    handleScreenshotSelect(e) {
        const files = Array.from(e.target.files);
        const preview = document.getElementById('screenshot-preview');
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.pendingScreenshots.push({ data: ev.target.result, filename: file.name });
                const img = document.createElement('div');
                img.className = 'screenshot-thumb';
                img.innerHTML = `<img src="${ev.target.result}" alt="screenshot"><button type="button" class="btn-icon screenshot-remove"><i class="fas fa-times"></i></button>`;
                img.querySelector('.screenshot-remove').addEventListener('click', () => {
                    const idx = this.pendingScreenshots.findIndex(s => s.filename === file.name);
                    if (idx > -1) this.pendingScreenshots.splice(idx, 1);
                    img.remove();
                });
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    }

    async uploadScreenshots() {
        const urls = [];
        for (const ss of this.pendingScreenshots) {
            try {
                const res = await fetch('/api/screenshots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: ss.data, filename: ss.filename })
                });
                if (res.ok) {
                    const { url } = await res.json();
                    urls.push(url);
                }
            } catch (err) { console.error('Screenshot upload failed:', err); }
        }
        this.pendingScreenshots = [];
        document.getElementById('screenshot-preview').innerHTML = '';
        return urls;
    }

    // --- Collect partial entries/exits from form ---

    collectPartials(formData, prefix) {
        const partials = [];
        const container = document.getElementById(prefix === 'entry' ? 'entries-container' : 'exits-container');
        container.querySelectorAll('.partial-row').forEach(row => {
            const idx = row.dataset.index;
            const date = formData.get(`${prefix}-date-${idx}`);
            const price = parseFloat(formData.get(`${prefix}-price-${idx}`));
            const qty = parseFloat(formData.get(`${prefix}-qty-${idx}`));
            if (date && !isNaN(price) && !isNaN(qty)) {
                partials.push({ date, price, qty });
            }
        });
        return partials;
    }

    // --- Form submission ---

    async handleTradeSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const entries = this.collectPartials(formData, 'entry');
        const exits = this.collectPartials(formData, 'exit');

        if (entries.length === 0 || exits.length === 0) {
            this.showToast('At least one entry and one exit are required.');
            return;
        }

        // Weighted average prices
        const totalEntryQty = entries.reduce((s, e) => s + e.qty, 0);
        const totalExitQty = exits.reduce((s, e) => s + e.qty, 0);
        const avgEntryPrice = entries.reduce((s, e) => s + e.price * e.qty, 0) / totalEntryQty;
        const avgExitPrice = exits.reduce((s, e) => s + e.price * e.qty, 0) / totalExitQty;

        const selectedTags = Array.from(form.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value);

        const screenshots = await this.uploadScreenshots();

        const trade = {
            assetClass: formData.get('asset-class'),
            ticker: formData.get('ticker').toUpperCase(),
            direction: formData.get('direction'),
            positionSize: parseFloat(formData.get('position-size')),
            entries,
            exits,
            entryPrice: avgEntryPrice,
            exitPrice: avgExitPrice,
            entryDate: entries[0].date,
            exitDate: exits[exits.length - 1].date,
            stopLoss: parseFloat(formData.get('stop-loss')) || null,
            takeProfit: parseFloat(formData.get('take-profit')) || null,
            fees: parseFloat(formData.get('fees')) || 0,
            setup: formData.get('setup'),
            tags: selectedTags,
            emotionalState: formData.get('emotional-state') || null,
            confidence: parseInt(formData.get('confidence')) || 5,
            notes: formData.get('notes') || '',
            screenshots: [],
            // Asset-class specific
            optionType: formData.get('option-type') || null,
            strikePrice: parseFloat(formData.get('strike-price')) || null,
            expirationDate: formData.get('expiration-date') || null,
            contracts: parseInt(formData.get('contracts')) || null,
            contractMonth: formData.get('contract-month') || null,
            tickValue: parseFloat(formData.get('tick-value')) || null,
            exchange: formData.get('exchange') || null,
            leverage: parseFloat(formData.get('leverage')) || null,
        };

        // Calculations
        trade.pnl = this.calculatePnL(trade);
        trade.netPnl = trade.pnl - trade.fees;
        trade.rr = this.calculateRR(trade);

        // Merge existing + new screenshots on edit
        const existingScreenshots = form.dataset.editId
            ? (this.trades.find(t => t.id === form.dataset.editId)?.screenshots || [])
            : [];
        trade.screenshots = [...existingScreenshots, ...screenshots];

        try {
            if (form.dataset.editId) {
                trade.id = form.dataset.editId;
                await storage.updateTrade(trade.id, trade);
                this.showToast('Trade updated successfully!');
                delete form.dataset.editId;
            } else {
                trade.id = Date.now().toString();
                await storage.addTrade(trade);
                this.showToast('Trade added successfully!');
            }
            this.trades = storage.getTrades();
            form.reset();
            this.resetFormUI();
            this.updateUI();
            document.querySelector('.nav-links li[data-page="dashboard"]')?.click();
        } catch (error) {
            console.error('Error saving trade:', error);
            this.showToast('Error saving trade. Please try again.');
        }
    }

    resetFormUI() {
        // Reset partial rows back to single entry/exit
        const ec = document.getElementById('entries-container');
        const xc = document.getElementById('exits-container');
        if (ec) { const rows = ec.querySelectorAll('.partial-row'); rows.forEach((r, i) => { if (i > 0) r.remove(); }); }
        if (xc) { const rows = xc.querySelectorAll('.partial-row'); rows.forEach((r, i) => { if (i > 0) r.remove(); }); }
        this.entryIndex = 1;
        this.exitIndex = 1;
        this.pendingScreenshots = [];
        document.getElementById('screenshot-preview').innerHTML = '';
        document.getElementById('confidence-value').textContent = '5';
        this.toggleAssetFields();
    }

    // --- Calculations ---

    calculatePnL(trade) {
        const priceDiff = trade.exitPrice - trade.entryPrice;
        const multiplier = trade.direction === 'long' ? 1 : -1;
        return priceDiff * trade.positionSize * multiplier;
    }

    /**
     * Real Risk:Reward ratio using stop-loss.
     * Risk = |entry - stopLoss| * positionSize
     * Reward = actual P&L
     * Returns null if no stop-loss is set.
     */
    calculateRR(trade) {
        if (!trade.stopLoss || !trade.entryPrice) return null;
        const risk = Math.abs(trade.entryPrice - trade.stopLoss) * trade.positionSize;
        if (risk === 0) return null;
        const reward = this.calculatePnL(trade);
        return reward / risk;
    }

    // --- Sorting ---

    handleSort(column) {
        const prop = SORT_COLUMN_MAP[column];
        if (!prop) return;
        const trades = this.getFilteredTrades();
        trades.sort((a, b) => {
            let vA = a[prop], vB = b[prop];
            if (prop === 'entryDate' || prop === 'exitDate') return new Date(vA) - new Date(vB);
            if (typeof vA === 'number' && typeof vB === 'number') return vA - vB;
            return String(vA ?? '').localeCompare(String(vB ?? ''));
        });
        this.renderTradesTable(trades);
    }

    // --- Filtering ---

    applyFilters() { this.renderTradesTable(this.getFilteredTrades()); }

    getFilteredTrades() {
        let trades = [...this.trades];
        const q = document.getElementById('search-trades')?.value.toLowerCase();
        const dateFrom = document.getElementById('date-from')?.value;
        const dateTo = document.getElementById('date-to')?.value;
        const setupF = document.getElementById('filter-setup')?.value;
        const resultF = document.getElementById('filter-result')?.value;
        const classF = document.getElementById('filter-asset-class')?.value;

        if (q) trades = trades.filter(t =>
            t.ticker.toLowerCase().includes(q) ||
            t.setup.toLowerCase().includes(q) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
            t.notes?.toLowerCase().includes(q)
        );
        if (dateFrom) trades = trades.filter(t => t.entryDate >= dateFrom);
        if (dateTo) trades = trades.filter(t => t.entryDate <= dateTo);
        if (setupF) trades = trades.filter(t => t.setup === setupF);
        if (classF) trades = trades.filter(t => t.assetClass === classF);
        if (resultF) trades = trades.filter(t => {
            const pnl = (t.netPnl !== undefined) ? t.netPnl : this.calculatePnL(t) - (t.fees || 0);
            if (resultF === 'win') return pnl > 0;
            if (resultF === 'loss') return pnl < 0;
            return pnl === 0;
        });
        return trades;
    }

    // --- UI Updates ---

    updateUI() {
        this.updateStats();
        this.updateRecentTrades();
        this.updateTradeHistory();
        this.populateSetupDropdown();
        this.populateTagsCheckboxes();
        this.populateFilterSetups();
        chartManager.updateAllCharts();
    }

    populateFilterSetups() {
        const select = document.getElementById('filter-setup');
        if (!select) return;
        const current = select.value;
        const tags = storage.getSetupTags();
        select.innerHTML = '<option value="">All Setups</option>' +
            tags.map(t => `<option value="${this.escapeHtml(t)}">${this.escapeHtml(t)}</option>`).join('');
        select.value = current;
    }

    updateStats() {
        const trades = this.trades;
        const total = trades.length;
        const wins = trades.filter(t => (t.netPnl ?? this.calculatePnL(t) - (t.fees || 0)) > 0).length;
        const totalPnL = trades.reduce((s, t) => s + this.calculatePnL(t), 0);
        const totalFees = trades.reduce((s, t) => s + (t.fees || 0), 0);
        const netPnL = totalPnL - totalFees;
        const rrValues = trades.map(t => t.rr ?? this.calculateRR(t)).filter(v => v !== null);
        const avgRR = rrValues.length ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : 0;

        document.getElementById('total-trades').textContent = total;
        document.getElementById('win-rate').textContent = `${((wins / total) * 100 || 0).toFixed(1)}%`;
        document.getElementById('total-pnl').textContent = `$${totalPnL.toFixed(2)}`;
        document.getElementById('total-fees').textContent = `$${totalFees.toFixed(2)}`;
        document.getElementById('net-pnl').textContent = `$${netPnL.toFixed(2)}`;
        document.getElementById('avg-rr').textContent = avgRR ? avgRR.toFixed(2) : 'N/A';
    }

    updateRecentTrades() {
        const recent = [...this.trades].sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate)).slice(0, 5);
        const tbody = document.querySelector('#recent-trades-table tbody');
        if (tbody) tbody.innerHTML = recent.map(t => this.createRecentRow(t)).join('');
    }

    updateTradeHistory() { this.renderTradesTable(this.getFilteredTrades()); }

    renderTradesTable(trades) {
        const tbody = document.querySelector('#trades-table tbody');
        if (tbody) tbody.innerHTML = trades.map(t => this.createTradeRow(t)).join('');
    }

    createRecentRow(trade) {
        const netPnl = trade.netPnl ?? (this.calculatePnL(trade) - (trade.fees || 0));
        const cls = netPnl > 0 ? 'positive' : netPnl < 0 ? 'negative' : '';
        const rr = trade.rr ?? this.calculateRR(trade);
        return `<tr>
            <td>${new Date(trade.entryDate).toLocaleDateString()}</td>
            <td>${this.escapeHtml(trade.ticker)}</td>
            <td>${this.escapeHtml(trade.assetClass || 'stocks')}</td>
            <td>${this.escapeHtml(trade.direction)}</td>
            <td class="${cls}">$${netPnl.toFixed(2)}</td>
            <td>${rr !== null ? rr.toFixed(2) : '—'}</td>
            <td>${this.escapeHtml(trade.setup)}</td>
        </tr>`;
    }

    createTradeRow(trade) {
        const netPnl = trade.netPnl ?? (this.calculatePnL(trade) - (trade.fees || 0));
        const cls = netPnl > 0 ? 'positive' : netPnl < 0 ? 'negative' : '';
        const rr = trade.rr ?? this.calculateRR(trade);
        const entrySummary = (trade.entries || []).map(e => `${e.qty}@${e.price}`).join(', ') || `${trade.entryPrice?.toFixed(2) ?? ''}`;
        const exitSummary = (trade.exits || []).map(e => `${e.qty}@${e.price}`).join(', ') || `${trade.exitPrice?.toFixed(2) ?? ''}`;
        const tags = (trade.tags || []).map(t => `<span class="tag-pill">${this.escapeHtml(t)}</span>`).join(' ');

        return `<tr>
            <td>${new Date(trade.entryDate).toLocaleDateString()}</td>
            <td>${this.escapeHtml(trade.ticker)}</td>
            <td>${this.escapeHtml(trade.assetClass || 'stocks')}</td>
            <td>${this.escapeHtml(trade.direction)}</td>
            <td class="partial-summary">${entrySummary}</td>
            <td class="partial-summary">${exitSummary}</td>
            <td class="${cls}">$${netPnl.toFixed(2)}</td>
            <td>${rr !== null ? rr.toFixed(2) : '—'}</td>
            <td>${this.escapeHtml(trade.setup)}</td>
            <td>${tags}</td>
            <td class="action-btns">
                <button data-action="view" data-trade-id="${trade.id}" class="btn-icon" title="Details"><i class="fas fa-eye"></i></button>
                <button data-action="edit" data-trade-id="${trade.id}" class="btn-icon" title="Edit"><i class="fas fa-edit"></i></button>
                <button data-action="delete" data-trade-id="${trade.id}" class="btn-icon btn-icon-danger" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }

    // --- Trade detail modal ---

    viewTradeDetail(tradeId) {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade) return;
        const netPnl = trade.netPnl ?? (this.calculatePnL(trade) - (trade.fees || 0));
        const rr = trade.rr ?? this.calculateRR(trade);
        const pnlClass = netPnl > 0 ? 'positive' : netPnl < 0 ? 'negative' : '';

        const emotionMap = { calm: '😌 Calm', confident: '💪 Confident', anxious: '😰 Anxious', fearful: '😨 Fearful', greedy: '🤑 Greedy', revenge: '😤 Revenge', fomo: '😱 FOMO', bored: '😐 Bored' };

        let html = `<h2>${this.escapeHtml(trade.ticker)} — ${this.escapeHtml(trade.direction.toUpperCase())}</h2>`;
        html += `<div class="detail-grid">`;
        html += `<div><strong>Asset Class:</strong> ${this.escapeHtml(trade.assetClass || 'stocks')}</div>`;
        html += `<div><strong>Setup:</strong> ${this.escapeHtml(trade.setup)}</div>`;
        html += `<div><strong>Position Size:</strong> ${trade.positionSize}</div>`;
        html += `<div><strong>Avg Entry:</strong> $${trade.entryPrice?.toFixed(2)}</div>`;
        html += `<div><strong>Avg Exit:</strong> $${trade.exitPrice?.toFixed(2)}</div>`;
        html += `<div><strong>Gross P&L:</strong> $${this.calculatePnL(trade).toFixed(2)}</div>`;
        html += `<div><strong>Fees:</strong> $${(trade.fees || 0).toFixed(2)}</div>`;
        html += `<div class="${pnlClass}"><strong>Net P&L:</strong> $${netPnl.toFixed(2)}</div>`;
        if (trade.stopLoss) html += `<div><strong>Stop Loss:</strong> $${trade.stopLoss.toFixed(2)}</div>`;
        if (trade.takeProfit) html += `<div><strong>Take Profit:</strong> $${trade.takeProfit.toFixed(2)}</div>`;
        html += `<div><strong>R:R:</strong> ${rr !== null ? rr.toFixed(2) : 'N/A'}</div>`;
        if (trade.emotionalState) html += `<div><strong>Emotion:</strong> ${emotionMap[trade.emotionalState] || trade.emotionalState}</div>`;
        if (trade.confidence) html += `<div><strong>Confidence:</strong> ${trade.confidence}/10</div>`;
        html += `</div>`;

        // Entries/Exits
        if (trade.entries?.length) {
            html += `<h3>Entries</h3><table class="detail-table"><tr><th>Date</th><th>Price</th><th>Qty</th></tr>`;
            trade.entries.forEach(e => { html += `<tr><td>${new Date(e.date).toLocaleString()}</td><td>$${e.price.toFixed(2)}</td><td>${e.qty}</td></tr>`; });
            html += `</table>`;
        }
        if (trade.exits?.length) {
            html += `<h3>Exits</h3><table class="detail-table"><tr><th>Date</th><th>Price</th><th>Qty</th></tr>`;
            trade.exits.forEach(e => { html += `<tr><td>${new Date(e.date).toLocaleString()}</td><td>$${e.price.toFixed(2)}</td><td>${e.qty}</td></tr>`; });
            html += `</table>`;
        }

        // Tags
        if (trade.tags?.length) {
            html += `<div class="detail-tags">${trade.tags.map(t => `<span class="tag-pill">${this.escapeHtml(t)}</span>`).join(' ')}</div>`;
        }

        // Screenshots
        if (trade.screenshots?.length) {
            html += `<h3>Screenshots</h3><div class="detail-screenshots">`;
            trade.screenshots.forEach(url => { html += `<a href="${url}" target="_blank"><img src="${url}" alt="chart screenshot"></a>`; });
            html += `</div>`;
        }

        // Notes
        if (trade.notes) html += `<h3>Notes</h3><p class="detail-notes">${this.escapeHtml(trade.notes)}</p>`;

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('trade-detail-modal').style.display = 'flex';
    }

    // --- Edit trade (populate form) ---

    async editTrade(tradeId) {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade) return;

        document.querySelector('.nav-links li[data-page="add-trade"]')?.click();
        await new Promise(r => setTimeout(r, 100));

        const form = document.getElementById('trade-form');
        if (!form) return;
        form.dataset.editId = tradeId;

        // Core fields
        form.elements['asset-class'].value = trade.assetClass || 'stocks';
        this.toggleAssetFields();
        form.elements['ticker'].value = trade.ticker || '';
        form.elements['direction'].value = trade.direction || 'long';
        form.elements['position-size'].value = trade.positionSize || '';

        // Partial entries
        const ec = document.getElementById('entries-container');
        const xc = document.getElementById('exits-container');
        ec.querySelectorAll('.partial-row').forEach((r, i) => { if (i > 0) r.remove(); });
        xc.querySelectorAll('.partial-row').forEach((r, i) => { if (i > 0) r.remove(); });

        (trade.entries || []).forEach((entry, i) => {
            if (i > 0) this.addPartialRow('entries');
            const row = ec.querySelectorAll('.partial-row')[i];
            if (row) {
                row.querySelector(`[name^="entry-date"]`).value = entry.date || '';
                row.querySelector(`[name^="entry-price"]`).value = entry.price || '';
                row.querySelector(`[name^="entry-qty"]`).value = entry.qty || '';
            }
        });
        (trade.exits || []).forEach((exit, i) => {
            if (i > 0) this.addPartialRow('exits');
            const row = xc.querySelectorAll('.partial-row')[i];
            if (row) {
                row.querySelector(`[name^="exit-date"]`).value = exit.date || '';
                row.querySelector(`[name^="exit-price"]`).value = exit.price || '';
                row.querySelector(`[name^="exit-qty"]`).value = exit.qty || '';
            }
        });

        // Risk
        if (trade.stopLoss) form.elements['stop-loss'].value = trade.stopLoss;
        if (trade.takeProfit) form.elements['take-profit'].value = trade.takeProfit;
        form.elements['fees'].value = trade.fees || 0;

        // Setup & tags
        form.elements['setup'].value = trade.setup || '';
        document.querySelectorAll('#tags-container input[type="checkbox"]').forEach(cb => {
            cb.checked = (trade.tags || []).includes(cb.value);
        });

        // Psychology
        if (trade.emotionalState) form.elements['emotional-state'].value = trade.emotionalState;
        form.elements['confidence'].value = trade.confidence || 5;
        document.getElementById('confidence-value').textContent = trade.confidence || 5;

        // Asset-class specific
        if (trade.optionType) form.elements['option-type'].value = trade.optionType;
        if (trade.strikePrice) form.elements['strike-price'].value = trade.strikePrice;
        if (trade.expirationDate) form.elements['expiration-date'].value = trade.expirationDate;
        if (trade.contracts) form.elements['contracts'].value = trade.contracts;
        if (trade.contractMonth) form.elements['contract-month'].value = trade.contractMonth;
        if (trade.tickValue) form.elements['tick-value'].value = trade.tickValue;
        if (trade.exchange) form.elements['exchange'].value = trade.exchange;
        if (trade.leverage) form.elements['leverage'].value = trade.leverage;

        form.elements['notes'].value = trade.notes || '';

        // Show existing screenshots
        const preview = document.getElementById('screenshot-preview');
        preview.innerHTML = '';
        (trade.screenshots || []).forEach(url => {
            const div = document.createElement('div');
            div.className = 'screenshot-thumb';
            div.innerHTML = `<img src="${url}" alt="screenshot">`;
            preview.appendChild(div);
        });

        const formTitle = document.querySelector('#add-trade h2');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (formTitle) formTitle.textContent = 'Edit Trade';
        if (submitBtn) submitBtn.textContent = 'Update Trade';
    }

    async deleteTrade(tradeId) {
        if (!confirm('Are you sure you want to delete this trade?')) return;
        try {
            await storage.deleteTrade(tradeId);
            this.trades = storage.getTrades();
            this.updateUI();
            this.showToast('Trade deleted successfully!');
        } catch (error) {
            console.error('Error deleting trade:', error);
            this.showToast('Error deleting trade.');
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 3000);
        }
    }
}

const tradeManager = new TradeManager();
export default tradeManager;
