import storage from './storage.js';

class ChartManager {
    constructor() {
        this.charts = {};
        this.heatmapYear = new Date().getFullYear();
        this.initDashboardChart();
    }

    // Dashboard P&L chart (created eagerly since dashboard is the default page)
    initDashboardChart() {
        const el = document.getElementById('pnl-chart');
        if (!el) return;
        this.charts.pnl = new Chart(el, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Cumulative Net P&L', data: [], borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.1)', fill: true, tension: 0.2 }] },
            options: { responsive: true, plugins: { title: { display: true, text: 'Cumulative Net P&L' } }, scales: { y: { ticks: { callback: v => `$${v}` } } } }
        });
    }

    // Lazy-init analytics charts (only when analytics page is shown)
    initAnalyticsCharts() {
        if (this.analyticsInitialized) return;
        this.analyticsInitialized = true;

        const make = (id, type, cfg) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return new Chart(el, { type, ...cfg });
        };

        // Equity + Drawdown (dual axis)
        this.charts.equityDD = make('equity-dd-chart', 'line', {
            data: { labels: [], datasets: [
                { label: 'Equity', data: [], borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)', fill: true, tension: 0.2, yAxisID: 'y' },
                { label: 'Drawdown', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.2, yAxisID: 'y1' }
            ] },
            options: { responsive: true, interaction: { mode: 'index', intersect: false },
                scales: { y: { position: 'left', ticks: { callback: v => `$${v}` } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => `$${v}` } } } }
        });

        this.charts.setupComparison = make('setup-comparison-chart', 'bar', {
            data: { labels: [], datasets: [
                { label: 'Win Rate %', data: [], backgroundColor: '#4f46e5' },
                { label: 'Avg Net P&L', data: [], backgroundColor: '#10b981' }
            ] },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        this.charts.tickerComparison = make('ticker-comparison-chart', 'bar', {
            data: { labels: [], datasets: [{ label: 'Total Net P&L', data: [], backgroundColor: [] }] },
            options: { responsive: true, indexAxis: 'y', scales: { x: { ticks: { callback: v => `$${v}` } } } }
        });

        this.charts.dow = make('dow-chart', 'bar', {
            data: { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets: [
                { label: 'Avg Net P&L', data: [], backgroundColor: '#6366f1' },
                { label: 'Trade Count', data: [], backgroundColor: '#a5b4fc', yAxisID: 'y1' }
            ] },
            options: { responsive: true, scales: { y: { position: 'left', ticks: { callback: v => `$${v}` } }, y1: { position: 'right', grid: { drawOnChartArea: false } } } }
        });

        this.charts.hour = make('hour-chart', 'bar', {
            data: { labels: [], datasets: [{ label: 'Avg Net P&L', data: [], backgroundColor: [] }] },
            options: { responsive: true, scales: { y: { ticks: { callback: v => `$${v}` } } } }
        });

        this.charts.session = make('session-chart', 'bar', {
            data: { labels: ['Asia (00-08)', 'London (08-13)', 'New York (13-21)', 'Off-Hours'], datasets: [
                { label: 'Total Net P&L', data: [], backgroundColor: ['#f59e0b','#3b82f6','#10b981','#6b7280'] },
                { label: 'Win Rate %', data: [], backgroundColor: ['#fbbf24','#60a5fa','#34d399','#9ca3af'] }
            ] },
            options: { responsive: true }
        });

        this.charts.winLoss = make('win-loss-chart', 'pie', {
            data: { labels: ['Wins','Losses','Breakeven'], datasets: [{ data: [0,0,0], backgroundColor: ['#22c55e','#ef4444','#eab308'] }] },
            options: { responsive: true }
        });

        this.charts.monthly = make('monthly-performance-chart', 'bar', {
            data: { labels: [], datasets: [{ label: 'Monthly Net P&L', data: [], backgroundColor: [] }] },
            options: { responsive: true, scales: { y: { ticks: { callback: v => `$${v}` } } } }
        });

        this.charts.streak = make('streak-chart', 'bar', {
            data: { labels: [], datasets: [{ label: 'Streak P&L', data: [], backgroundColor: [] }] },
            options: { responsive: true, scales: { y: { ticks: { callback: v => `$${v}` } } } }
        });

        // Heatmap controls
        document.getElementById('heatmap-prev')?.addEventListener('click', () => { this.heatmapYear--; this.renderHeatmap(storage.getTrades()); });
        document.getElementById('heatmap-next')?.addEventListener('click', () => { this.heatmapYear++; this.renderHeatmap(storage.getTrades()); });
    }

    // --- Core P&L helper ---
    netPnl(t) {
        if (t.netPnl !== undefined) return t.netPnl;
        const diff = t.exitPrice - t.entryPrice;
        const mul = t.direction === 'long' ? 1 : -1;
        return (diff * t.positionSize * mul) - (t.fees || 0);
    }

    sorted(trades) {
        return [...trades].sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
    }

    // --- Master update ---
    updateAllCharts() {
        const trades = storage.getTrades();
        this.updateDashboardPnL(trades);
        this.initAnalyticsCharts();
        this.computeMetrics(trades);
        this.updateEquityDrawdown(trades);
        this.updateSetupComparison(trades);
        this.updateTickerComparison(trades);
        this.updateDayOfWeek(trades);
        this.updateHourOfDay(trades);
        this.updateSession(trades);
        this.updateWinLoss(trades);
        this.updateMonthly(trades);
        this.updateStreaks(trades);
        this.renderHeatmap(trades);
    }

    // --- Dashboard chart ---
    updateDashboardPnL(trades) {
        if (!this.charts.pnl) return;
        const s = this.sorted(trades);
        let cum = 0;
        const labels = [], data = [];
        s.forEach(t => { cum += this.netPnl(t); labels.push(new Date(t.entryDate).toLocaleDateString()); data.push(cum); });
        this.charts.pnl.data.labels = labels;
        this.charts.pnl.data.datasets[0].data = data;
        this.charts.pnl.update();
    }

    // --- Key Metrics ---
    computeMetrics(trades) {
        const pnls = this.sorted(trades).map(t => this.netPnl(t));
        const n = pnls.length;
        if (n === 0) return;

        const wins = pnls.filter(p => p > 0);
        const losses = pnls.filter(p => p < 0);
        const winRate = wins.length / n;
        const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

        // Expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)
        const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss);

        // Profit Factor = gross wins / |gross losses|
        const grossWin = wins.reduce((a, b) => a + b, 0);
        const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
        const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

        // Sharpe-like: mean(pnl) / stddev(pnl)
        const mean = pnls.reduce((a, b) => a + b, 0) / n;
        const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / n;
        const sharpe = variance > 0 ? mean / Math.sqrt(variance) : 0;

        // Max drawdown + recovery
        let peak = 0, cum = 0, maxDD = 0, ddStart = 0, ddEnd = 0, recoveryTrades = 0;
        let inDD = false, ddTradeCount = 0;
        const equities = [];
        pnls.forEach((p, i) => {
            cum += p;
            equities.push(cum);
            if (cum > peak) { peak = cum; if (inDD) { recoveryTrades = ddTradeCount; inDD = false; } ddTradeCount = 0; }
            const dd = peak - cum;
            if (dd > maxDD) { maxDD = dd; ddStart = i; }
            if (dd > 0) { inDD = true; ddTradeCount++; }
        });
        if (inDD && ddTradeCount > recoveryTrades) recoveryTrades = ddTradeCount;

        // Streaks
        let curStreak = 0, bestWin = 0, worstLoss = 0;
        pnls.forEach(p => {
            if (p > 0) curStreak = curStreak > 0 ? curStreak + 1 : 1;
            else if (p < 0) curStreak = curStreak < 0 ? curStreak - 1 : -1;
            else curStreak = 0;
            if (curStreak > bestWin) bestWin = curStreak;
            if (curStreak < worstLoss) worstLoss = curStreak;
        });

        const $ = id => document.getElementById(id);
        $('metric-expectancy').textContent = `$${expectancy.toFixed(2)}`;
        $('metric-profit-factor').textContent = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2);
        $('metric-sharpe').textContent = sharpe.toFixed(3);
        $('metric-max-dd').textContent = `$${maxDD.toFixed(2)}`;
        $('metric-max-dd').className = maxDD > 0 ? 'negative' : '';
        $('metric-dd-recovery').textContent = recoveryTrades > 0 ? `${recoveryTrades} trades` : '—';
        $('metric-win-streak').textContent = bestWin;
        $('metric-loss-streak').textContent = Math.abs(worstLoss);
        $('metric-avg-win').textContent = `$${avgWin.toFixed(2)}`;
        $('metric-avg-win').className = 'positive';
        $('metric-avg-loss').textContent = `$${avgLoss.toFixed(2)}`;
        $('metric-avg-loss').className = avgLoss < 0 ? 'negative' : '';
    }

    // --- Equity Curve + Drawdown ---
    updateEquityDrawdown(trades) {
        const c = this.charts.equityDD;
        if (!c) return;
        const s = this.sorted(trades);
        let cum = 0, peak = 0;
        const labels = [], equity = [], dd = [];
        s.forEach(t => {
            cum += this.netPnl(t);
            if (cum > peak) peak = cum;
            labels.push(new Date(t.entryDate).toLocaleDateString());
            equity.push(cum);
            dd.push(cum - peak); // negative or zero
        });
        c.data.labels = labels;
        c.data.datasets[0].data = equity;
        c.data.datasets[1].data = dd;
        c.update();
    }

    // --- Setup Comparison ---
    updateSetupComparison(trades) {
        const c = this.charts.setupComparison;
        if (!c) return;
        const map = {};
        trades.forEach(t => {
            const s = t.setup || 'Unknown';
            if (!map[s]) map[s] = { wins: 0, total: 0, pnl: 0 };
            map[s].total++;
            const p = this.netPnl(t);
            map[s].pnl += p;
            if (p > 0) map[s].wins++;
        });
        const keys = Object.keys(map).sort((a, b) => map[b].pnl - map[a].pnl);
        c.data.labels = keys;
        c.data.datasets[0].data = keys.map(k => (map[k].wins / map[k].total * 100).toFixed(1));
        c.data.datasets[1].data = keys.map(k => (map[k].pnl / map[k].total).toFixed(2));
        c.update();
    }

    // --- Ticker Comparison ---
    updateTickerComparison(trades) {
        const c = this.charts.tickerComparison;
        if (!c) return;
        const map = {};
        trades.forEach(t => { const tk = t.ticker || '?'; map[tk] = (map[tk] || 0) + this.netPnl(t); });
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
        c.data.labels = sorted.map(e => e[0]);
        c.data.datasets[0].data = sorted.map(e => e[1]);
        c.data.datasets[0].backgroundColor = sorted.map(e => e[1] >= 0 ? '#22c55e' : '#ef4444');
        c.update();
    }

    // --- Day of Week ---
    updateDayOfWeek(trades) {
        const c = this.charts.dow;
        if (!c) return;
        const days = [0,1,2,3,4,5,6].map(() => ({ pnl: 0, count: 0 }));
        trades.forEach(t => {
            const d = new Date(t.entryDate).getDay(); // 0=Sun
            const idx = d === 0 ? 6 : d - 1; // shift to Mon=0
            days[idx].pnl += this.netPnl(t);
            days[idx].count++;
        });
        c.data.datasets[0].data = days.map(d => d.count ? (d.pnl / d.count).toFixed(2) : 0);
        c.data.datasets[1].data = days.map(d => d.count);
        c.update();
    }

    // --- Hour of Day ---
    updateHourOfDay(trades) {
        const c = this.charts.hour;
        if (!c) return;
        const hours = Array.from({ length: 24 }, () => ({ pnl: 0, count: 0 }));
        trades.forEach(t => {
            const h = new Date(t.entryDate).getHours();
            hours[h].pnl += this.netPnl(t);
            hours[h].count++;
        });
        const active = hours.map((h, i) => ({ h: i, ...h })).filter(h => h.count > 0);
        c.data.labels = active.map(h => `${h.h}:00`);
        c.data.datasets[0].data = active.map(h => (h.pnl / h.count).toFixed(2));
        c.data.datasets[0].backgroundColor = active.map(h => h.pnl >= 0 ? '#22c55e' : '#ef4444');
        c.update();
    }

    // --- Session Performance ---
    updateSession(trades) {
        const c = this.charts.session;
        if (!c) return;
        // Asia 00-08 UTC, London 08-13 UTC, NY 13-21 UTC, Off 21-00
        const sessions = [{ pnl: 0, w: 0, n: 0 }, { pnl: 0, w: 0, n: 0 }, { pnl: 0, w: 0, n: 0 }, { pnl: 0, w: 0, n: 0 }];
        trades.forEach(t => {
            const h = new Date(t.entryDate).getUTCHours();
            const idx = h < 8 ? 0 : h < 13 ? 1 : h < 21 ? 2 : 3;
            const p = this.netPnl(t);
            sessions[idx].pnl += p;
            sessions[idx].n++;
            if (p > 0) sessions[idx].w++;
        });
        c.data.datasets[0].data = sessions.map(s => s.pnl.toFixed(2));
        c.data.datasets[1].data = sessions.map(s => s.n ? (s.w / s.n * 100).toFixed(1) : 0);
        c.update();
    }

    // --- Win/Loss Pie ---
    updateWinLoss(trades) {
        const c = this.charts.winLoss;
        if (!c) return;
        let w = 0, l = 0, b = 0;
        trades.forEach(t => { const p = this.netPnl(t); if (p > 0) w++; else if (p < 0) l++; else b++; });
        c.data.datasets[0].data = [w, l, b];
        c.update();
    }

    // --- Monthly ---
    updateMonthly(trades) {
        const c = this.charts.monthly;
        if (!c) return;
        const map = {};
        trades.forEach(t => {
            const d = new Date(t.entryDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            map[key] = (map[key] || 0) + this.netPnl(t);
        });
        const keys = Object.keys(map).sort();
        c.data.labels = keys.map(k => { const [y, m] = k.split('-'); return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: 'numeric' }); });
        c.data.datasets[0].data = keys.map(k => map[k]);
        c.data.datasets[0].backgroundColor = keys.map(k => map[k] >= 0 ? '#22c55e' : '#ef4444');
        c.update();
    }

    // --- Streak Chart ---
    updateStreaks(trades) {
        const c = this.charts.streak;
        if (!c) return;
        const s = this.sorted(trades);
        const streaks = []; // { type, length, pnl }
        let cur = null;
        s.forEach(t => {
            const p = this.netPnl(t);
            const type = p > 0 ? 'win' : p < 0 ? 'loss' : 'be';
            if (cur && cur.type === type) { cur.length++; cur.pnl += p; }
            else { if (cur) streaks.push(cur); cur = { type, length: 1, pnl: p }; }
        });
        if (cur) streaks.push(cur);
        // Show last 30 streaks
        const recent = streaks.slice(-30);
        c.data.labels = recent.map((s, i) => `${s.type === 'win' ? 'W' : s.type === 'loss' ? 'L' : 'B'}${s.length}`);
        c.data.datasets[0].data = recent.map(s => s.pnl);
        c.data.datasets[0].backgroundColor = recent.map(s => s.type === 'win' ? '#22c55e' : s.type === 'loss' ? '#ef4444' : '#eab308');
        c.update();
    }

    // --- Calendar Heatmap — fluid CSS Grid that fills the card ---
    renderHeatmap(trades) {
        const container = document.getElementById('calendar-heatmap');
        const yearLabel = document.getElementById('heatmap-year');
        if (!container) return;
        const year = this.heatmapYear;
        if (yearLabel) yearLabel.textContent = year;

        const dailyPnl = {};
        trades.forEach(t => {
            const d = new Date(t.entryDate).toISOString().split('T')[0];
            dailyPnl[d] = (dailyPnl[d] || 0) + this.netPnl(t);
        });
        const vals = Object.values(dailyPnl).filter(v => v !== 0);
        const maxAbs = vals.length ? Math.max(...vals.map(Math.abs)) : 1;

        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay();
        const startDate = new Date(jan1);
        startDate.setDate(startDate.getDate() - startDay);

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        // Month labels row — uses same grid as cells
        let html = '<div class="hm-months">';
        for (let m = 0; m < 12; m++) {
            const firstOfMonth = new Date(year, m, 1);
            const weekIdx = Math.floor((firstOfMonth - startDate) / (7 * 86400000));
            html += '<span style="grid-column:' + (weekIdx + 2) + '">' + months[m] + '</span>';
        }
        html += '</div>';

        // Flat grid: 7 rows × (1 label col + 53 week cols), all 1fr
        html += '<div class="hm-grid">';
        const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        for (let d = 0; d < 7; d++) {
            html += '<div class="hm-label">' + (d % 2 === 1 ? dayLabels[d] : '') + '</div>';
            const cursor = new Date(startDate);
            cursor.setDate(cursor.getDate() + d);
            for (let w = 0; w < 53; w++) {
                const dateStr = cursor.toISOString().split('T')[0];
                const inYear = cursor.getFullYear() === year;
                const pnl = dailyPnl[dateStr] || 0;
                const color = !inYear ? 'transparent' : this.heatmapColor(pnl, maxAbs);
                const tip = inYear ? dateStr + ': $' + pnl.toFixed(2) : '';
                html += '<div class="hm-cell" style="background:' + color + '" title="' + tip + '"></div>';
                cursor.setDate(cursor.getDate() + 7);
            }
        }
        html += '</div>';
        container.innerHTML = html;
    }

    heatmapColor(pnl, maxAbs) {
        if (pnl === 0) return '#e5e7eb';
        const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
        if (pnl > 0) {
            const r = Math.round(229 - intensity * 195);
            const g = Math.round(231 + intensity * 24);
            const b = Math.round(235 - intensity * 175);
            return `rgb(${r},${g},${b})`;
        } else {
            const r = Math.round(229 + intensity * 10);
            const g = Math.round(231 - intensity * 163);
            const b = Math.round(235 - intensity * 167);
            return `rgb(${r},${g},${b})`;
        }
    }
}

const chartManager = new ChartManager();
export default chartManager;
