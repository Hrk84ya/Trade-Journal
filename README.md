# Zoro Trade Journal

Zoro is a private, browser-based trade journal for desktop traders. It tracks trades, risk, discipline, daily notes, playbooks, and performance without a server or account.

## Highlights

- Premium light and dark design with a soft-gold accent
- Static HTML, CSS, and JavaScript
- Ready for GitHub Pages
- Indian Rupee formatting and Indian Standard Time
- Browser-only storage with JSON backup and restore
- Support for stocks, options, futures, crypto, and forex

## Features

### Dashboard

- Total, realised, and open P&L
- Win rate and profit factor
- Equity curve
- Recent trades
- Daily loss, profit, and trade-count limits
- Guided empty state for first-time use

### Trade Tracking

- Open and closed trades
- Long and short positions
- Multiple entries and exits
- Weighted prices and automatic net P&L
- Current price tracking for open positions
- Stop loss, target, fees, risk amount, and planned R:R
- Setup, fixed tags, and custom tags
- Mood, confidence, rule-following, mistakes, and notes
- Edit, inspect, and delete trades

### Trade History

- Search by symbol, setup, or tag
- Filter by market, status, and result
- View today, this week, this month, or custom dates
- Sort the trade table
- Open a full trade-detail drawer
- Confirm before deleting a trade

### Daily Journal

Each date has four note sections:

- Pre-market
- Trade plan
- Day review
- Lessons

Notes are saved in the current browser.

### Setup Playbook

- Save setup rules and checklists
- Add market details and notes
- Edit or delete saved playbooks
- Reuse playbook names when recording trades
- Set daily loss, profit, and trade-count limits

### Analytics

- Expectancy, best trade, worst trade, and max drawdown
- Equity and drawdown chart
- Win and loss mix
- P&L by market
- Weekday and time-of-day reports
- Clickable daily P&L calendar
- Setup scorecards and best-setup ranking
- Tag performance
- Repeated-mistake costs
- Mood and confidence results
- Rule-following score
- Automatic weekly review
- Printable monthly report

## Tech Stack

| Part | Tool |
|---|---|
| App | HTML5, CSS3, vanilla JavaScript |
| Charts | Chart.js 4.5 |
| Icons | Font Awesome Free 6.7 |
| Fonts | Google Fonts |
| Storage | Browser `localStorage` |
| Hosting | GitHub Pages or any static host |

Chart.js, Font Awesome, and Google Fonts load from public CDNs. An internet connection is needed for those assets.

## Project Structure

```text
Trade-Journal/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── README.md
└── LICENSE
```

## Run Locally

No install or build step is needed.

```bash
python3 -m http.server 8777 --bind 127.0.0.1
```

Open [http://127.0.0.1:8777](http://127.0.0.1:8777).

Run the command from the project folder.

## Data and Backups

Zoro stores all data in the current browser using `localStorage`.

- No data is sent to a server.
- Different browsers keep separate data.
- Clearing browser data removes the journal.
- Use **Export** often to download a JSON backup.
- Use **Import** to restore a saved backup.

Do not use Import with a file you do not trust.

## Desktop Support

Zoro is designed for desktop web browsers. Mobile layouts are not supported.

## License

Released under the [MIT License](LICENSE).
