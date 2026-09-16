const mongoose = require('mongoose');

const LandslideSchema = new mongoose.Schema({
  event_id: Number,
  event_date: Date,
  event_title: String,
  location_description: String,
  landslide_category: String,
  landslide_trigger: String,
  landslide_size: String,
  fatality_count: Number,
  country_name: String,
  latitude: Number,
  longitude: Number,
  location: {         // GeoJSON Point
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  }
});

LandslideSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Landslide', LandslideSchema);
