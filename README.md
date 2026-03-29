# Trading Journal

A premium trading journal application for serious traders. Track every trade with rich detail, analyze performance with advanced metrics, and build discipline through daily journaling — all in a polished, responsive interface.

![Node.js](https://img.shields.io/badge/Node.js-22-green) ![Express](https://img.shields.io/badge/Express-5.x-blue) ![Chart.js](https://img.shields.io/badge/Chart.js-4.5-orange) ![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## Features

### Dashboard
- Hero banner with net P&L, win rate, and trade count at a glance
- Equity curve chart with cumulative net P&L
- Quick-stat cards for total P&L, fees, and average R:R
- Recent trades table

### Rich Trade Data Model
- Multi-asset support: Stocks, Options, Futures, Crypto — each with class-specific fields (strike/expiry for options, tick value for futures, leverage for crypto)
- Partial entries and exits for scaling in/out with weighted average price calculation
- Stop-loss and take-profit prices with real risk:reward ratio
- Fees and commissions tracking (net P&L = gross P&L minus fees)
- Flexible tag system: setup types + custom labels, both user-extensible
- Emotional state tracking (calm, confident, anxious, FOMO, revenge, etc.)
- Confidence level slider (1–10)
- Screenshot attachments per trade (uploaded to server)
- Free-form notes

### Daily Journal
- Four sections per day: Pre-Market Plan, End-of-Day Review, Lessons Learned, Free Notes
- Markdown editor with toolbar (bold, italic, headings, lists, blockquotes, code blocks, checklists)
- Live markdown preview toggle (powered by marked.js)
- Keyboard shortcuts (Cmd/Ctrl+S to save, Cmd/Ctrl+B/I for formatting)
- 2-second autosave with status indicator
- Date navigation with prev/next arrows and "Today" button
- Recent entries sidebar with snippets and section indicators

### Advanced Analytics
- Key metrics: Expectancy, Profit Factor, Sharpe Ratio, Max Drawdown, DD Recovery, Win/Loss Streaks, Avg Win, Avg Loss
- Equity curve with drawdown overlay (dual Y-axis)
- GitHub-style P&L calendar heatmap with year navigation
- Setup comparison (win rate + avg P&L per setup)
- Ticker performance (top 15 by total net P&L)
- Performance by day of week, hour of day, and trading session (Asia/London/NY)
- Win/loss distribution pie chart
- Monthly performance bars
- Streak visualization (last 30 consecutive win/loss streaks)

### Trade History
- Full trade table with sorting by any column
- Filters: search, date range, asset class, setup, win/loss
- Trade detail modal with full breakdown, entries/exits table, screenshots, tags, psychology data
- Inline edit and delete with confirmation

### UI/UX
- Premium design with amber-to-red gradient accent, glassmorphism cards, and DM Sans + Playfair Display + JetBrains Mono typography
- Collapsible sidebar with icon-only mode (state persisted)
- Light and dark themes with smooth transitions
- Bento grid analytics layout
- Fluid calendar heatmap that fills the card width
- Responsive down to mobile (sidebar auto-collapses)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Grid, Flexbox, Custom Properties), Vanilla JS (ES6 Modules) |
| Charts | Chart.js 4.5 |
| Markdown | marked.js 16.3 |
| Icons | Font Awesome 6.7 |
| Fonts | Google Fonts (DM Sans, Playfair Display, JetBrains Mono) |
| Backend | Node.js 22, Express 5.x |
| Container | Docker (single-stage, Node alpine) |

## Project Structure

```
├── index.html              # SPA entry point
├── server.js               # Express API (data persistence + screenshot uploads)
├── logo.svg                # App icon (amber-red gradient)
├── package.json
├── Dockerfile
├── nginx.conf              # Reverse-proxy config (optional)
├── css/
│   └── styles.css          # Full premium stylesheet
├── js/
│   ├── main.js             # App bootstrap, theme, navigation, sidebar
│   ├── trades.js           # Trade CRUD, form handling, table rendering
│   ├── charts.js           # All Chart.js charts + analytics engine + heatmap
│   ├── journal.js          # Daily journal manager
│   └── storage.js          # LocalStorage + server sync, tags, journal entries
└── uploads/                # Screenshot uploads (gitignored)
```

## Getting Started

### Prerequisites

- Node.js 22 or higher
- npm

### Local Development

```bash
git clone https://github.com/yourusername/trade-journal.git
cd trade-journal
npm install
node server.js
```

Open `http://localhost:3000`

### Docker

```bash
docker build -t trade-journal .
docker run -p 3000:3000 trade-journal
```

## Usage

### Adding a Trade
Click "New Trade" in the sidebar. The form is split into two columns — core trade data on the left (asset class, entries/exits, risk management) and metadata on the right (setup, tags, psychology, screenshots, notes). Add multiple entries/exits for scaling. Save navigates back to the dashboard.

### Journal
Navigate to "Journal" to write daily pre-market plans and end-of-day reviews. Switch between four sections via tabs. Write in Markdown — toggle preview with the eye icon. Entries autosave after 2 seconds of inactivity.

### Analytics
The analytics page shows key performance metrics in a hero banner, followed by a bento grid of charts. The calendar heatmap shows daily P&L for the selected year. All calculations use net P&L (after fees).

### Export / Import
In Trade History, use Export to download all data as JSON. Use Import to restore from a previous export. Journal entries, custom tags, and theme preference are all included.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trading_journal_data.json` | Read all app data |
| PUT | `/trading_journal_data.json` | Write all app data |
| POST | `/api/screenshots` | Upload a screenshot (base64) |
| DELETE | `/api/screenshots/:filename` | Delete a screenshot |

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- [Chart.js](https://www.chartjs.org/) — charts
- [marked.js](https://marked.js.org/) — markdown rendering
- [Font Awesome](https://fontawesome.com/) — icons
- [Google Fonts](https://fonts.google.com/) — DM Sans, Playfair Display, JetBrains Mono
