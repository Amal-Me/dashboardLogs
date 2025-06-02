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

// GET : récupérer tous les logs (limité à 5)
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

// GET : récupérer les logs hebdo non traités
router.get('/stats', (req, res) => {
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
    // Determine target week (previous week)
    // Using SQLite's strftime to be consistent with how week_number might be populated
    const targetWeekRow = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime', '-7 days') AS INTEGER) AS value", []);
    if (targetWeekRow === undefined || targetWeekRow.value === null) {
        // This can happen at the very beginning of a year if 'now' is week 00 and '-7 days' is in previous year's week 52 or 53.
        // Or if the database is empty / strftime behaves unexpectedly.
        // Fallback or specific handling might be needed. For now, let's try to get previous week regardless of year.
        // A more robust way: get current week, if it's 0 (first week), target 52/53 of prev year.
        // Simplified: If 'now' is week 0, strftime('%W', 'now', '-7 days') might give last week of prev year.
        // If 'now' is week 1, strftime('%W', 'now', '-7 days') gives week 0.
        // The problem states "week_number = strftime('%W', 'now') - 1".
        // Let's use "SELECT CAST(strftime('%W', 'now') AS INTEGER) - 1 AS value"
        const currentWeekMinusOneRow = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime') AS INTEGER) - 1 AS value", []);
        if (currentWeekMinusOneRow === undefined || currentWeekMinusOneRow.value === null || currentWeekMinusOneRow.value < 0) {
             // If current week is 00, then 0-1 = -1. We need to handle this by querying for week 52 or 53 of the previous year.
             // For simplicity as per original query, we'll stick to the direct calculation,
             // assuming week_number column handles year transitions if populated by a similar strftime.
             // The original query was `week_number = strftime('%W', 'now') - 1`.
             // This might be problematic if `strftime('%W', 'now')` is "00".
             // Let's assume for now that `week_number` in the table is comparable to `strftime('%W', date)`.
             // A direct query for target week number:
            const targetWeekCalc = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime') AS INTEGER) AS current_week_num", []);
            let targetWeek;
            if (targetWeekCalc.current_week_num === 0) {
                // It's the first week of the year (00). Previous week was last week of prior year.
                // Need to find actual week number of (today - 7 days).
                const prevWeekActual = await dbGetAsync("SELECT CAST(strftime('%W', 'now', 'localtime', '-7 days') AS INTEGER) AS prev_week", []);
                targetWeek = prevWeekActual.prev_week;
            } else {
                targetWeek = targetWeekCalc.current_week_num - 1;
            }
            console.log(`Calculated targetWeek: ${targetWeek} (current: ${targetWeekCalc.current_week_num})`);
            // If targetWeek becomes -1 (current week 0), it won't match typical week_number values (0-53).
            // The original query `week_number = strftime('%W', 'now') - 1` has this potential issue.
            // For this task, we proceed with the calculated targetWeek.
            // A more robust solution would involve year in the condition: `strftime('%Y-%W', ...)`.
            // Given the constraint to match `week_number = strftime('%W', 'now') - 1`, we'll use that logic.
            // The most direct interpretation for targetWeek is:
            const targetWeekDirectQuery = await dbGetAsync("SELECT (CAST(strftime('%W', 'now', 'localtime') AS INTEGER) - 1) AS value", []);
            targetWeek = targetWeekDirectQuery.value;
            // This can result in -1 if current week is 0. The queries below would likely find nothing.
            // This is consistent with the original flawed logic if `strftime('%W', 'now')` is '00'.
        } else {
            targetWeek = targetWeekRow.value; // Use week of 7 days ago.
        }
        // If targetWeek is -1 (because current week is 00), this means we are looking for week -1.
        // This is usually not what's intended. The logs table for "previous week"
        // would typically mean week 52/53 of the previous year.
        // However, to stick to the original query `week_number = strftime('%W', 'now') - 1`:
        const targetWeekFromOriginalLogic = await dbGetAsync("SELECT strftime('%W', 'now', 'localtime') - 1 AS value", []);
        targetWeek = targetWeekFromOriginalLogic.value;
        console.log('Target week for queries (based on strftime(\'%W\', \'now\') - 1):', targetWeek);


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
