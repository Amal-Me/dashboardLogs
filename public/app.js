// Dashboard JavaScript
class HomelabDashboard {
    constructor() {
      this.charts = {};
      this.init();
    }
  
    async init() {
      await this.loadData();
      this.initEventListeners();
      this.startAutoRefresh();
      this.updateLastUpdateTime();
    }
  
    async loadData() {
      try {
        const [stats, recentLogs] = await Promise.all([
          fetch('/api/stats').then(r => r.json()),
          fetch('/api/recentLogs/20').then(r => r.json())
        ]);

        console.log('Fetched recentLogs:', recentLogs);
  
        console.log('Fetched recentLogs:', recentLogs);
        this.updateStats(stats);
        this.updateCharts(stats);
        this.updateLogsTable(recentLogs);
      } catch (error) {
        console.error('Erreur chargement données:', error);
        this.showError('Erreur de connexion au serveur');
      }
    }
  
    updateStats(stats) {
      // Sécurise l'accès au tableau
      const total = stats.totalLogs?.[0]?.count ?? 0;
      document.getElementById('totalLogs').textContent = total;
  
      const urgentCount = stats.recentUrgent?.[0]?.count ?? 0;
      document.getElementById('urgentLogs').textContent = urgentCount;
  
      const globalStatus = document.getElementById('globalStatus');
      if (urgentCount > 5) {
        globalStatus.textContent = 'Attention';
        globalStatus.className = 'text-2xl font-bold text-red-600';
      } else if (urgentCount > 0) {
        globalStatus.textContent = 'Surveillé';
        globalStatus.className = 'text-2xl font-bold text-yellow-600';
      } else {
        globalStatus.textContent = 'Stable';
        globalStatus.className = 'text-2xl font-bold text-green-600';
      }
  
      const activeServers = stats.logsByServer?.length ?? 0;
      document.getElementById('activeServers').textContent = activeServers;
    }
  
    updateCharts(stats) {
      this.createServerChart(stats.logsByServer || []);
      this.createTrendChart(stats.weeklyTrend || []);
    }
  
    createServerChart(data) {
      const ctx = document.getElementById('serverChart')?.getContext('2d');
      if (!ctx) return;
  
      if (this.charts.server) this.charts.server.destroy();
  
      const colors = ['#E84444', '#1080B1', '#F5B06E', '#B68CFC'];
  
      this.charts.server = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.server_type.toUpperCase()),
          datasets: [{
            data: data.map(d => d.count),
            backgroundColor: colors.slice(0, data.length),
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 20, usePointStyle: true }
            }
          }
        }
      });
    }
  
    createTrendChart(data) {
      const ctx = document.getElementById('trendChart')?.getContext('2d');
      if (!ctx) return;
  
      if (this.charts.trend) this.charts.trend.destroy();
  
      this.charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => `${d.week.split('-')[1]}`),
          datasets: [{
            label: 'Logs par semaine',
            data: data.map(d => d.count),
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            borderColor: '#3B82F6',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#3B82F6',
            pointRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { display: true },
            y: { display: true }
          }
        }
      });
    }
  
    updateLogsTable(logs) {
      console.log('Entering updateLogsTable. Received logs:', logs);
      const tbody = document.querySelector('#logTable tbody');
      if (!tbody) {
        console.error('CRITICAL: HTML element #logTable tbody not found! Cannot update logs table.');
        return;
      }
      console.log('Found #logTable tbody element:', tbody);
      tbody.innerHTML = ''; // Clears the table
  
      if (!Array.isArray(logs)) {
        console.error('CRITICAL: Data passed to updateLogsTable is not an array. Received:', logs);
        return;
      }
      if (logs.length === 0) {
        console.log('Info: updateLogsTable received an empty array. No logs to display.');
        // Optionally, you could add a message to the table like:
        // tbody.innerHTML = '<tr><td colspan="4">No logs to display.</td></tr>';
        return;
      }
      console.log(`Info: updateLogsTable will now process ${logs.length} log entries.`);
      logs.forEach((log, index) => {
        console.log(`Processing log entry index ${index}:`, log);
        const row = document.createElement('tr');

        let raw_logs_display = 'Error displaying raw_logs';
        if (log.raw_logs === undefined) {
            console.warn(`Log entry index ${index} has undefined raw_logs.`);
            raw_logs_display = 'N/A (undefined)';
        } else if (typeof log.raw_logs === 'string') {
            try {
                const parsed_raw_logs = JSON.parse(log.raw_logs);
                raw_logs_display = JSON.stringify(parsed_raw_logs, null, 2);
            } catch (e) {
                console.error(`Error parsing raw_logs for log entry index ${index}. Content:`, log.raw_logs, 'Error:', e);
                raw_logs_display = `Error parsing: ${log.raw_logs}`;
            }
        } else {
            console.warn(`Log entry index ${index} raw_logs is not a string. Attempting direct stringify. Content:`, log.raw_logs);
            try {
                raw_logs_display = JSON.stringify(log.raw_logs, null, 2); // Fallback for already parsed objects or other types
            } catch (e) {
                console.error(`Error stringifying non-string raw_logs for log entry index ${index}. Content:`, log.raw_logs, 'Error:', e);
                raw_logs_display = 'Error stringifying raw_logs content.';
            }
        }
        // Ensure other properties are also handled safely if they might be missing
        const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
        const server_type = log.server_type || 'N/A';
        const severity = log.severity || 'N/A';

        // The row.innerHTML part should use these safe variables:
        row.innerHTML = `
          <td>${timestamp}</td>
          <td>${server_type}</td>
          <td>${severity}</td>
          <td><pre>${raw_logs_display}</pre></td>
        `;
        tbody.appendChild(row);
        console.log(`Appended row for log index ${index} to tbody.`);
      });
      console.log('Finished updateLogsTable.');
    }
  
    updateLastUpdateTime() {
      const el = document.getElementById('lastUpdate');
      if (el) {
        el.textContent = new Date().toLocaleTimeString();
      }
    }
  
    startAutoRefresh() {
      setInterval(() => {
        this.loadData();
        this.updateLastUpdateTime();
      }, 60000); // rafraîchit toutes les minutes
    }
  
    initEventListeners() {
      document.getElementById('refreshBtn')?.addEventListener('click', () => {
        this.loadData();
        this.updateLastUpdateTime();
      });
    }
  
    showError(message) {
      alert(message);
    }
  }
  
  window.addEventListener('DOMContentLoaded', () => new HomelabDashboard());
  