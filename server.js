const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares globaux
app.use(cors());
app.use(express.json()); // pour lire le body JSON

// Routes API (modulaires)
const ingestRoutes = require('./api/ingest'); // Insertion et marquage des logs
const statsRoutes = require('./api/stats');   // Requêtes de consultation

// Enregistrement des routes
app.use('/api', ingestRoutes);
app.use('/api', statsRoutes);


app.use(express.static('public')); // sert les fichiers statiques (index.html, css, etc.)

// Route principale pour le dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close(err => {
    if (err) console.error('Erreur fermeture DB :', err.message);
    else console.log('DB fermée proprement');
    process.exit(0);
  });
});

