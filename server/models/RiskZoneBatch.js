const mongoose = require('mongoose');

// This small pointer document makes changing the visible prediction batch a
// single database operation. Risk-zone rows can be prepared in the background
// without exposing an incomplete grid to readers.
const RiskZoneBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true, index: true },
  computedAt: { type: Date, required: true },
  isActive: { type: Boolean, default: false, index: true }
});

module.exports = mongoose.model('RiskZoneBatch', RiskZoneBatchSchema);
