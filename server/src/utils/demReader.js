const GeoTIFF = require('geotiff');
const path = require('path');

let tiffImage = null;
let bbox = null;
let pixelWidth = null;
let pixelHeight = null;

const fs = require('fs');

async function initDem() {
  if (tiffImage) return;
  
  const demPath = path.join(__dirname, '../../../himalayan_cop90_dem.tif');
  if (!fs.existsSync(demPath)) {
    throw new Error("DEM file not found at " + demPath);
  }

  const tiff = await GeoTIFF.fromFile(demPath);
  const image = await tiff.getImage();
  const box = image.getBoundingBox();
  
  const resolution = image.getResolution();
  if (!resolution || !resolution[0]) {
    throw new Error("Unable to parse DEM resolution");
  }

  // Atomic assignment to prevent half-initialized state
  bbox = box;
  pixelWidth = Math.abs(resolution[0]);
  pixelHeight = Math.abs(resolution[1]);
  tiffImage = image;
}

async function getSlope(lat, lng) {
  if (!tiffImage) await initDem();
  if (!tiffImage) return 0; // fallback if DEM missing
  
  if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
    return 0; // outside DEM bounds
  }

  const originX = bbox[0];
  const originY = bbox[3]; // Max lat is origin Y (North-up)
  
  const x = Math.floor((lng - originX) / pixelWidth);
  const y = Math.floor((originY - lat) / pixelHeight);
  
  // Read a 3x3 window around the pixel
  const rasters = await tiffImage.readRasters({
    window: [Math.max(0, x - 1), Math.max(0, y - 1), x + 2, y + 2],
    samples: [0]
  });
  
  if (!rasters || !rasters[0]) {
    return 0; // Fail-safe for undefined raster extraction
  }
  
  const elevationData = rasters[0];
  const width = rasters.width;
  const height = rasters.height;
  
  if (width < 3 || height < 3) return 0; // Edge case
  
  const north = elevationData[1];
  const south = elevationData[2 * width + 1];
  const west = elevationData[width];
  const east = elevationData[width + 2];

  const northSouthMetres = 2 * pixelHeight * 111320;
  const eastWestMetres = 2 * pixelWidth * 111320 * Math.max(Math.cos(lat * Math.PI / 180), 0.1);
  
  const riseNorthSouth = (north - south) / northSouthMetres;
  const riseEastWest = (east - west) / eastWestMetres;
  
  const slopeDeg = Math.atan(Math.hypot(riseNorthSouth, riseEastWest)) * 180 / Math.PI;
  return slopeDeg;
}

module.exports = { initDem, getSlope };

