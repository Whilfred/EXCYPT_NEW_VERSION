const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');
const { query } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS - Accepter toutes les origines en développement
app.use(cors({
  origin: '*',  // Accepter toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'OK', database: 'connected', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'disconnected', error: error.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

app.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📊 Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('🔗 CORS enabled for all origins');
});
