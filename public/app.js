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
      const tbody = document.querySelector('#logTable tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
  
      logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${new Date(log.timestamp).toLocaleString()}</td>
          <td>${log.server_type}</td>
          <td>${log.severity}</td>
          <td><pre>${JSON.stringify(log.raw_logs, null, 2)}</pre></td>
        `;
        tbody.appendChild(row);
      });
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
  