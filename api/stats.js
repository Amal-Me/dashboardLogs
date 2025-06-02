const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const dbPath = path.resolve(__dirname, '../db/logs.db');
const db = new sqlite3.Database(dbPath);

// Promisify db.all and db.get for async/await usage
function dbAllAsync(query, params) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGetAsync(query, params) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// GET : récupérer tous les logs (limité à 5) - for diagnostics
router.get('/alllogs', (req, res) => {
  const query = `
    SELECT * FROM logs
    ORDER BY timestamp DESC
    LIMIT 5
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching all logs:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET : logs récents pour l'affichage brut dans la table
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

// GET : statistiques agrégées pour le dashboard
router.get('/stats', async (req, res) => {
  try {
    let targetWeek;
    const currentWeekStats = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime') AS INTEGER) AS weekNum", []);

    if (currentWeekStats === undefined || currentWeekStats.weekNum === null) {
      console.error("Could not determine current week number for /api/stats. Defaulting targetWeek to -99.");
      targetWeek = -99; // Fallback to a value that likely yields no results
      // Consider throwing an error for more explicit handling:
      // throw new Error("Critical: Cannot determine current week number for statistics.");
    } else if (currentWeekStats.weekNum === 0) {
      // Current week is 00 (first week of year, Sunday-based). Target last week of previous year.
      // SQLite's %W with 'start of year' and '-1 day' should give the last day of the previous year, then its week number.
      const prevYearLastWeekData = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime', 'start of year', '-1 day') AS INTEGER) AS value", []);
      if (prevYearLastWeekData && prevYearLastWeekData.value !== null) {
        targetWeek = prevYearLastWeekData.value;
      } else {
        // Fallback if the specific query fails, e.g. very old SQLite or unusual setup
        console.warn("Could not determine last week of previous year via SQLite strftime. Defaulting to 52.");
        targetWeek = 52;
      }
      console.log(`Current week is 00. Targeting last week of previous year: ${targetWeek}`);
    } else {
      targetWeek = currentWeekStats.weekNum - 1;
    }
    console.log('Target week for /api/stats queries:', targetWeek);

    const queryTotalLogs = `SELECT COUNT(*) as count FROM logs WHERE processed = FALSE AND week_number = ?`;
    const queryUrgentLogs = `SELECT COUNT(*) as count FROM logs WHERE severity = 'urgent' AND processed = FALSE AND week_number = ?`;
    const queryLogsByServer = `SELECT server_type, COUNT(*) as count FROM logs WHERE processed = FALSE AND week_number = ? GROUP BY server_type`;
    // For weeklyTrend, let's get the last 4 full weeks of data, including the targetWeek if it has data.
    // To be robust, we should define weeks based on 'YYYY-WW' format.
    // The query should cover roughly 28-35 days to ensure 4 distinct YYYY-WW periods.
    const queryWeeklyTrend = `
      SELECT strftime('%Y-%W', timestamp, 'localtime') as week, COUNT(*) as count
      FROM logs
      WHERE processed = FALSE
        AND timestamp >= date('now', 'localtime', '-35 days')
        AND timestamp < date('now', 'localtime', '-' || (CAST(strftime('%w', 'now', 'localtime') AS INTEGER)) || ' days') /* up to start of current week (Sunday) */
      GROUP BY week
      ORDER BY week DESC
      LIMIT 4
    `;
    // Note: The original 'processed = FALSE AND week_number = ?' logic might mean that once a week's logs are processed,
    // they no longer contribute to these 'current stats'. The weeklyTrend might want to show all logs regardless of 'processed' status.
    // For now, keeping 'processed = FALSE' for trend as well, for consistency.

    const [
      totalResult,
      urgentResult,
      serverData,
      trendData
    ] = await Promise.all([
      dbGetAsync(queryTotalLogs, [targetWeek]),
      dbGetAsync(queryUrgentLogs, [targetWeek]),
      dbAllAsync(queryLogsByServer, [targetWeek]),
      dbAllAsync(queryWeeklyTrend, []) // trendData query defines its own time window
    ]);

    res.json({
      totalLogsCount: totalResult ? totalResult.count : 0,
      urgentLogsCount: urgentResult ? urgentResult.count : 0,
      logsByServer: serverData || [], // Ensure it's an array
      weeklyTrend: trendData ? trendData.sort((a,b) => a.week.localeCompare(b.week)) : [] // Ensure sorted ascending for charts
    });

  } catch (err) {
    console.error('Error in /api/stats:', err.message);
    res.status(500).json({ error: 'Failed to retrieve statistics: ' + err.message });
  }
});

module.exports = router;
