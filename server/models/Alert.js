const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  sender: { type: String, default: 'TerrainTrace' },
  sent: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['Actual', 'Exercise', 'Test'], default: 'Actual' },
  msgType: { type: String, enum: ['Alert', 'Update', 'Cancel'], default: 'Alert' },
  scope: { type: String, default: 'Public' },
  severity: { type: String, enum: ['Extreme', 'Severe', 'Moderate', 'Minor'], required: true },
  certainty: { type: String, default: 'Observed' },
  urgency: { type: String, default: 'Immediate' },
  headline: { type: String, required: true, maxlength: 500 },
  description: { type: String, required: true, maxlength: 5000 },
  areaDesc: { type: String, required: true },
  circle: {
    lat: Number,
    lng: Number,
    radiusKm: Number
  },
  expires: { type: Date },
  language: { type: String, default: 'en' },
  deliveryChannels: [{ type: String, enum: ['SMS', 'Push', 'Dashboard'] }]
}, { timestamps: true });

AlertSchema.index({ sent: -1 });
AlertSchema.index({ severity: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
