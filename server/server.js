require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./src/app');

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/landslide-gis';

// The database is used for reports and the optional cached risk grid. A
// temporary database outage must not prevent point-risk calculations.
try {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('[Server] Connected to MongoDB'))
    .catch((error) => console.warn('[Server] MongoDB connection failed (starting without DB):', error.message));
} catch (error) {
  console.warn('[Server] MongoDB initialization failed (starting without DB):', error.message);
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`[Server] Listening on port ${PORT}`));
}

module.exports = app;
