const mongoose = require('mongoose');

const FieldReportSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  type: {
    type: String,
    required: true,
    enum: ['CRACK', 'SLOPE_MOVEMENT', 'LANDSLIDE', 'ROCKFALL', 'ROAD_BLOCKAGE', 'OTHER']
  },
  description: { type: String, trim: true, maxlength: 5000 },
  imageReference: { type: String, trim: true, maxlength: 2048 },
  videoReference: { type: String, trim: true, maxlength: 2048 },
  severity: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] },
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING', index: true },
  mediaPath: { type: String, trim: true, maxlength: 2048 },
  reportedAt: { type: Date, required: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true }
  }
}, { timestamps: true });

FieldReportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FieldReport', FieldReportSchema);
