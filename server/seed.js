require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Landslide = require('./models/Landslide');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/landslide-gis';
const CSV_FILE_PATH = path.join(__dirname, '../Global_Landslide_Catalog_Export_rows.csv');

async function seedDatabase() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[Seed] Connected successfully.');

    // Clear existing data (optional, but good for re-running)
    await Landslide.deleteMany({});
    console.log('[Seed] Cleared existing landslide records.');

    const results = [];
    console.log(`[Seed] Reading CSV from ${CSV_FILE_PATH}...`);

    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (data) => {
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);

        // Filter events in the study area (lat 21-34, lon 75-98)
        if (!isNaN(lat) && !isNaN(lon) && lat >= 21 && lat <= 34 && lon >= 75 && lon <= 98) {
          results.push({
            event_id: parseInt(data.event_id, 10),
            event_date: data.event_date ? new Date(data.event_date) : null,
            event_title: data.event_title,
            location_description: data.location_description,
            landslide_category: data.landslide_category,
            landslide_trigger: data.landslide_trigger,
            landslide_size: data.landslide_size,
            fatality_count: data.fatality_count ? parseInt(data.fatality_count, 10) : 0,
            country_name: data.country_name,
            latitude: lat,
            longitude: lon,
            location: {
              type: 'Point',
              coordinates: [lon, lat]
            }
          });
        }
      })
      .on('end', async () => {
        console.log(`[Seed] Finished reading CSV. Found ${results.length} valid records in study area.`);
        
        if (results.length > 0) {
          try {
            await Landslide.insertMany(results);
            console.log(`[Seed] Successfully inserted ${results.length} records into database.`);
          } catch (insertError) {
            console.error('[Seed] Error inserting records:', insertError);
          }
        }
        
        await mongoose.disconnect();
        console.log('[Seed] Disconnected from MongoDB.');
      })
      .on('error', (err) => {
        console.error('[Seed] Error reading CSV:', err);
        mongoose.disconnect();
      });

  } catch (error) {
    console.error('[Seed] Database connection error:', error);
    process.exit(1);
  }
}

seedDatabase();
