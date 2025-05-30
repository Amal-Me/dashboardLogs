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
                fetch('/api/recent-logs/20').then(r => r.json())
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
        // Total logs
        document.getElementById('totalLogs').textContent = 
            stats.totalLogs[0]?.count || '0';

        // Urgences récentes
        const urgentCount = stats.recentUrgent[0]?.count || 0;
        document.getElementById('urgentLogs').textContent = urgentCount;
        
        // Statut global
        const statusEl = document.getElementById('globalStatus');
        if (urgentCount > 5) {
            statusEl.textContent = 'Attention';
            statusEl.className = 'text-2xl font-bold text-red-600';
        } else if (urgentCount > 0) {
            statusEl.textContent = 'Surveillé';
            statusEl.className = 'text-2xl font-bold text-yellow-600';
        } else {
            statusEl.textContent = 'Stable';
            statusEl.className = 'text-2xl font-bold text-green-600';
        }

        // Serveurs actifs
        document.getElementById('activeServers').textContent = 
            stats.logsByServer?.length || '0';
    }

    updateCharts(stats) {
        // Graphique répartition serveurs
        this.createServerChart(stats.logsByServer || []);
        
        // Graphique tendance
        this.createTrendChart(stats.weeklyTrend || []);
    }

    createServerChart(data) {
        const ctx = document.getElementById('serverChart').getContext('2d');
        
        if (this.charts.server) {
            this.charts.server.destroy();
        }

        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'
        ];

        this.charts.server = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.server_type.toUpperCase()),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    createTrendChart(data) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => `S${d.week.split('-')[1]}`),
                datasets: [{
                    label: 'Logs par semaine',
                    data: data.map(d => d.count),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3B82F6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    updateLogsTable(logs) {
        const tbody = document.getElementById('logsTable');
        tbody.innerHTML = '';

        logs.forEach(log => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            // Format timestamp
            const date = new Date(log.timestamp);
            const formattedDate = date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Severity badge
            let severityClass = 'status-online';
            if (log.severity === 'urgent') severityClass = 'status-error';
            else if (log.severity === 'warning') severityClass = 'status-warning';

            // Log preview (first 60 chars)
            const logPreview = log.raw_logs.length > 60 
                ? log.raw_logs.substring(0, 60) + '...' 
                : log.raw_logs;

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formattedDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        ${log.server_type.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${severityClass}">
                        ${log.severity}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <code class="bg-gray-100 px-2 py-1 rounded text-xs">
                        ${this.escapeHtml(logPreview)}
                    </code>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    initEventListeners() {
        document.getElementById('refreshLogs').addEventListener('click', () => {
            this.loadData();
        });
    }

    startAutoRefresh() {
        // Refresh toutes les 5 minutes
        setInterval(() => {
            this.loadData();
        }, 5 * 60 * 1000);
    }

    updateLastUpdateTime() {
        const updateTime = () => {
            const now = new Date();
            document.getElementById('lastUpdate').textContent = 
                now.toLocaleTimeString('fr-FR');
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HomelabDashboard();
});