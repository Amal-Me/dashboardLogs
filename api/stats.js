const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const dbPath = path.resolve(__dirname, '../db/logs.db');
const db = new sqlite3.Database(dbPath);

// GET : récupérer les logs hebdo non traités
router.get('/stats', (req, res) => {
  const query = `
    SELECT * FROM logs
    WHERE processed = FALSE
    AND week_number = strftime('%W', 'now') - 1
    ORDER BY server_type, timestamp
  `;

  // GET : logs récents
router.get('/recentLogs/:limit', (req, res) => {
    const limit = parseInt(req.params.limit, 10) || 20;
  
    const query = `
      SELECT * FROM logs
      ORDER BY timestamp DESC
      LIMIT ?
    `;
  
    db.all(query, [limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
  

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
