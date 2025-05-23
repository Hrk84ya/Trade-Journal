import storage from './storage.js';

class ChartManager {
    constructor() {
        this.charts = {};
        this.initializeCharts();
    }

    initializeCharts() {
        // P&L Chart
        this.charts.pnl = new Chart(
            document.getElementById('pnl-chart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Cumulative P&L',
                        data: [],
                        borderColor: '#4CAF50',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Cumulative P&L Over Time'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: value => `$${value}`
                            }
                        }
                    }
                }
            }
        );

        // Setup Performance Chart
        this.charts.setupPerformance = new Chart(
            document.getElementById('setup-performance-chart'),
            {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Win Rate',
                        data: [],
                        backgroundColor: '#2196F3'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Setup Performance'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => `${value}%`
                            }
                        }
                    }
                }
            }
        );

        // Win/Loss Distribution Chart
        this.charts.winLoss = new Chart(
            document.getElementById('win-loss-chart'),
            {
                type: 'pie',
                data: {
                    labels: ['Wins', 'Losses', 'Breakeven'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#4CAF50', '#F44336', '#FFC107']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Win/Loss Distribution'
                        }
                    }
                }
            }
        );

        // Monthly Performance Chart
        this.charts.monthlyPerformance = new Chart(
            document.getElementById('monthly-performance-chart'),
            {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Monthly P&L',
                        data: [],
                        backgroundColor: '#9C27B0'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Monthly Performance'
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: value => `$${value}`
                            }
                        }
                    }
                }
            }
        );
    }

    updateAllCharts() {
        const trades = storage.getTrades();
        this.updatePnLChart(trades);
        this.updateSetupPerformanceChart(trades);
        this.updateWinLossChart(trades);
        this.updateMonthlyPerformanceChart(trades);
    }

    updatePnLChart(trades) {
        const sortedTrades = [...trades].sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
        let cumulativePnL = 0;
        const data = sortedTrades.map(trade => {
            const pnl = this.calculatePnL(trade);
            cumulativePnL += pnl;
            return {
                x: new Date(trade.entryDate),
                y: cumulativePnL
            };
        });

        this.charts.pnl.data.labels = data.map(d => d.x.toLocaleDateString());
        this.charts.pnl.data.datasets[0].data = data.map(d => d.y);
        this.charts.pnl.update();
    }

    updateSetupPerformanceChart(trades) {
        const setups = [...new Set(trades.map(trade => trade.setup))];
        const data = setups.map(setup => {
            const setupTrades = trades.filter(trade => trade.setup === setup);
            const winningTrades = setupTrades.filter(trade => this.calculatePnL(trade) > 0);
            return {
                setup,
                winRate: (winningTrades.length / setupTrades.length) * 100
            };
        });

        this.charts.setupPerformance.data.labels = data.map(d => d.setup);
        this.charts.setupPerformance.data.datasets[0].data = data.map(d => d.winRate);
        this.charts.setupPerformance.update();
    }

    updateWinLossChart(trades) {
        const wins = trades.filter(trade => this.calculatePnL(trade) > 0).length;
        const losses = trades.filter(trade => this.calculatePnL(trade) < 0).length;
        const breakeven = trades.filter(trade => this.calculatePnL(trade) === 0).length;

        this.charts.winLoss.data.datasets[0].data = [wins, losses, breakeven];
        this.charts.winLoss.update();
    }

    updateMonthlyPerformanceChart(trades) {
        const monthlyPnL = {};
        trades.forEach(trade => {
            const month = new Date(trade.entryDate).toLocaleString('default', { month: 'short', year: 'numeric' });
            const pnl = this.calculatePnL(trade);
            monthlyPnL[month] = (monthlyPnL[month] || 0) + pnl;
        });

        const months = Object.keys(monthlyPnL).sort((a, b) => {
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');
            return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
        });

        this.charts.monthlyPerformance.data.labels = months;
        this.charts.monthlyPerformance.data.datasets[0].data = months.map(month => monthlyPnL[month]);
        this.charts.monthlyPerformance.update();
    }

    calculatePnL(trade) {
        const priceDiff = trade.exitPrice - trade.entryPrice;
        const multiplier = trade.direction === 'long' ? 1 : -1;
        return priceDiff * trade.positionSize * multiplier;
    }
}

// Create and export a single instance
const chartManager = new ChartManager();
export default chartManager; 