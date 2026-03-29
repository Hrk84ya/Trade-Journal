# Trading Journal App

A comprehensive trading journal application built with modern web technologies to help traders track, analyze, and improve their trading performance. The application features a clean, intuitive interface with powerful analytics and data management capabilities.

## ✨ Features

- 📊 **Interactive Dashboard** - Track key metrics including win rate, total P&L, and average risk/reward ratio
- 📝 **Trade Management** - Add, edit, and delete trades with detailed information
- 📈 **Advanced Analytics** - Visualize trading performance with interactive charts
- 🔍 **Smart Filtering** - Filter trades by date, setup, result, and more
- 💾 **Data Persistence** - Save your trading data locally or export/import as JSON
- 🌓 **Dark/Light Mode** - Choose your preferred theme for comfortable viewing
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🔄 **Real-time Updates** - See your stats update instantly as you log trades

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Charts**: Chart.js for beautiful, interactive data visualization
- **Styling**: CSS Grid, Flexbox, and CSS Variables for theming
- **Backend**: Node.js with Express for data persistence
- **Containerization**: Docker support for easy deployment

## 📦 Project Structure

```
trade-journal/
├── index.html            # Main application entry point
├── server.js             # Express server for data persistence
├── nginx.conf            # Nginx configuration for production
├── Dockerfile            # Docker configuration
├── package.json          # Project dependencies
├── /css
│   └── styles.css        # Main stylesheet with theming support
├── /js
│   ├── main.js           # Application initialization and routing
│   ├── trades.js         # Trade management and business logic
│   ├── charts.js         # Chart rendering and visualization
│   └── storage.js        # Data persistence and server communication
└── trading_journal_data.json  # Default data storage file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v22 or higher)
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/trade-journal.git
   cd trade-journal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   node server.js
   ```
   The app will be available at `http://localhost:3000`

### Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t trade-journal .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:80 trade-journal
   ```
   The app will be available at `http://localhost:3000`

## 📚 Usage

1. **Adding a Trade**
   - Click "Add Trade" in the sidebar
   - Fill in the trade details (ticker, direction, entry/exit prices, etc.)
   - Click "Add Trade" to save

2. **Viewing Trades**
   - Navigate to "Trade History" to see all your trades
   - Use filters to find specific trades
   - Click the edit (✏️) or delete (🗑️) icons to modify trades

3. **Exporting/Importing Data**
   - Go to "Trade History"
   - Click "Export Data" to download your trades as JSON
   - Use "Import Data" to load previously exported data

## 🛠 Development

The application follows a modular architecture:

- `main.js` - Handles application initialization, routing, and UI updates
- `trades.js` - Manages trade-related operations (CRUD, calculations, filtering)
- `charts.js` - Handles data visualization using Chart.js
- `storage.js` - Manages data persistence and server communication

### Building for Production

To create a production build:

1. Minify and bundle assets
2. Optimize images
3. Generate service worker for offline support

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Chart.js](https://www.chartjs.org/) for beautiful charts
- [Font Awesome](https://fontawesome.com/) for icons
- All the amazing open-source projects that made this possible