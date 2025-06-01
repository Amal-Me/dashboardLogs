const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const dbPath = path.resolve(__dirname, '../db/logs.db');
const db = new sqlite3.Database(dbPath);

// Créer la table si elle n'existe pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_type TEXT,
      severity TEXT,
      raw_logs TEXT,
      week_number INTEGER DEFAUT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed BOOLEAN DEFAULT FALSE
    )
  `);
});

// POST : insertion de logs
router.post('/logs', (req, res) => {
  const { server_type, severity, raw_logs } = req.body;

  const query = `
    INSERT INTO logs (server_type, severity, raw_logs, week_number)
    VALUES (?, ?, ?, strftime('%W', 'now'))
  `;

  db.run(query, [server_type, severity, JSON.stringify(raw_logs)], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Log inserted successfully' });
  });
});

// PUT : marquer comme traité
router.put('/logs/processed', (req, res) => {
  const ids = req.body.ids;
  const placeholders = ids.map(() => '?').join(',');
  const query = `UPDATE logs SET processed = TRUE WHERE id IN (${placeholders})`;

  db.run(query, ids, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

module.exports = router;
