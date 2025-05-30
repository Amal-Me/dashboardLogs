const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database('/path/to/your/logs.db'); // Ajustez le chemin

// Routes API
app.get('/api/stats', (req, res) => {
  const queries = {
    totalLogs: "SELECT COUNT(*) as count FROM logs",
    logsByServer: `SELECT server_type, COUNT(*) as count 
                   FROM logs 
                   GROUP BY server_type`,
    recentUrgent: `SELECT COUNT(*) as count 
                   FROM logs 
                   WHERE severity = 'urgent' 
                   AND datetime(timestamp) > datetime('now', '-7 days')`,
    weeklyTrend: `SELECT 
                    strftime('%Y-%W', timestamp) as week,
                    COUNT(*) as count
                  FROM logs 
                  WHERE datetime(timestamp) > datetime('now', '-30 days')
                  GROUP BY week 
                  ORDER BY week`
  };

  const results = {};
  let completed = 0;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, rows) => {
      if (err) {
        console.error(`Error in ${key}:`, err);
        results[key] = [];
      } else {
        results[key] = rows;
      }
      
      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(results);
      }
    });
  });
});

app.get('/api/recent-logs/:limit?', (req, res) => {
  const limit = req.params.limit || 50;
  const query = `SELECT * FROM logs 
                 ORDER BY timestamp DESC 
                 LIMIT ?`;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/urgent-logs', (req, res) => {
  const query = `SELECT * FROM logs 
                 WHERE severity = 'urgent' 
                 ORDER BY timestamp DESC 
                 LIMIT 20`;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('Database connection closed.');
    process.exit(0);
  });
});