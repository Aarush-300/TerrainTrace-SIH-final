const axios = require('axios');
const mongoose = require('mongoose');
const FieldReport = require('../../models/FieldReport');

async function getTriageTable(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    
    const reports = await FieldReport.find({ type: 'ROAD_BLOCKAGE', status: 'VERIFIED' });
    
    const triageEntries = reports.map(report => {
      const isolationHours = (Date.now() - new Date(report.reportedAt).getTime()) / (1000 * 60 * 60);
      return {
        id: report._id,
        location: { lat: report.latitude, lng: report.longitude },
        reportedAt: report.reportedAt,
        isolationHours,
        severity: report.severity || 'MODERATE'
      };
    });
    
    const severityRank = { 'CRITICAL': 4, 'HIGH': 3, 'MODERATE': 2, 'LOW': 1 };
    
    triageEntries.sort((a, b) => {
      const rankA = severityRank[a.severity] || 0;
      const rankB = severityRank[b.severity] || 0;
      if (rankA !== rankB) return rankB - rankA;
      return b.isolationHours - a.isolationHours;
    });
    
    return res.json(triageEntries);
  } catch (error) {
    return next(error);
  }
}

async function findRoute(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required (lat,lng)' });
    
    const [fromLat, fromLng] = from.split(',');
    const [toLat, toLng] = to.split(',');
    
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await axios.get(osrmUrl);
    
    const osrmData = response.data;
    const blockedSegments = [];
    
    if (mongoose.connection.readyState === 1 && osrmData.routes) {
      const blockageReports = await FieldReport.find({ type: 'ROAD_BLOCKAGE', status: 'VERIFIED' });
      const threshold = 0.005; // ~500m
      
      for (const report of blockageReports) {
        let isNearRoute = false;
        for (const route of osrmData.routes) {
          if (route.geometry && route.geometry.coordinates) {
            for (const coord of route.geometry.coordinates) {
              if (Math.abs(coord[0] - report.longitude) < threshold && Math.abs(coord[1] - report.latitude) < threshold) {
                isNearRoute = true;
                break;
              }
            }
          }
          if (isNearRoute) break;
        }
        
        if (isNearRoute) {
          blockedSegments.push({
            lat: report.latitude,
            lng: report.longitude,
            severity: report.severity
          });
        }
      }
    }
    
    osrmData.blockedSegments = blockedSegments;
    return res.json(osrmData);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getTriageTable, findRoute };
