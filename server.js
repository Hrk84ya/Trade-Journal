const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files
app.use(express.static('.'));

// GET endpoint to read data file
app.get('/trading_journal_data.json', async (req, res) => {
    try {
        const data = await fs.readFile('trading_journal_data.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Data file not found' });
        } else {
            res.status(500).json({ error: 'Error reading data file' });
        }
    }
});

// PUT endpoint to write data file
app.put('/trading_journal_data.json', async (req, res) => {
    try {
        await fs.writeFile(
            'trading_journal_data.json',
            JSON.stringify(req.body, null, 2),
            'utf8'
        );
        res.json({ message: 'Data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error saving data file' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 