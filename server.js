const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

// Increase JSON body limit for base64 screenshots
app.use(express.json({ limit: '50mb' }));

// Serve static files
app.use(express.static('.'));

// Serve uploaded screenshots
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
(async () => {
    try { await fs.mkdir('uploads', { recursive: true }); }
    catch (e) { /* already exists */ }
})();

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

// POST endpoint to upload a screenshot (base64)
app.post('/api/screenshots', async (req, res) => {
    try {
        const { data, filename } = req.body;
        if (!data || !filename) {
            return res.status(400).json({ error: 'Missing data or filename' });
        }

        // Strip the data URL prefix if present
        const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Sanitize filename and add timestamp
        const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const filePath = path.join('uploads', safeName);

        await fs.writeFile(filePath, buffer);
        res.json({ url: `/uploads/${safeName}` });
    } catch (error) {
        console.error('Screenshot upload error:', error);
        res.status(500).json({ error: 'Failed to upload screenshot' });
    }
});

// DELETE endpoint to remove a screenshot
app.delete('/api/screenshots/:filename', async (req, res) => {
    try {
        const safeName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
        const filePath = path.join('uploads', safeName);
        await fs.unlink(filePath);
        res.json({ message: 'Screenshot deleted' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ message: 'File already removed' });
        } else {
            res.status(500).json({ error: 'Failed to delete screenshot' });
        }
    }
});

app.listen(port, (error) => {
    if (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
    console.log(`Server running at http://localhost:${port}`);
});
