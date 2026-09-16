/**
 * Client-side geo utilities for building corridors and risk areas
 * from live AI prediction points. No external dependencies — pure math.
 */

// ── Distance helper ────────────────────────────────────────────────────

/** Haversine distance between two points in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Risk level ordering ────────────────────────────────────────────────

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MODERATE: 2, MEDIUM: 2, LOW: 1 };

function riskRank(level) {
  return RISK_ORDER[(level || '').toUpperCase()] ?? 0;
}

function highestRisk(levels) {
  let best = '';
  let bestRank = 0;
  for (const l of levels) {
    const r = riskRank(l);
    if (r > bestRank) { bestRank = r; best = l; }
  }
  return best;
}

// ── Convex Hull (Graham Scan) ──────────────────────────────────────────

function cross(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

/**
 * Compute the convex hull of a set of 2D points.
 * @param {Array<[number, number]>} pts — array of [lat, lng]
 * @returns {Array<[number, number]>} — hull vertices in order
 */
export function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const sorted = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Grid-indexed DBSCAN clustering of geo points.
 * Uses a spatial hash grid so regionQuery checks only 9 neighboring cells
 * instead of all N points — O(n×k) instead of O(n²).
 *
 * @param {Array<{lat, lng, ...}>} points
 * @param {number} epsKm — max distance to consider neighbours
 * @param {number} minPts — min cluster size
 * @returns {Array<Array<object>>} — array of clusters (each an array of points)
 */
function dbscan(points, epsKm, minPts) {
  const n = points.length;
  if (n === 0) return [];

  // Approximate cell size in degrees (1° lat ≈ 111 km)
  const cellDeg = epsKm / 111;

  // Build spatial hash grid: cellKey → [pointIndex, ...]
  const grid = new Map();
  const cellKeys = new Array(n);

  function getCellKey(lat, lng) {
    const ci = Math.floor(lat / cellDeg);
    const cj = Math.floor(lng / cellDeg);
    return `${ci},${cj}`;
  }

  for (let i = 0; i < n; i++) {
    const key = getCellKey(points[i].lat, points[i].lng);
    cellKeys[i] = key;
    let bucket = grid.get(key);
    if (!bucket) { bucket = []; grid.set(key, bucket); }
    bucket.push(i);
  }

  /** Return indices of all points within epsKm of points[idx]. */
  function regionQuery(idx) {
    const p = points[idx];
    const ci = Math.floor(p.lat / cellDeg);
    const cj = Math.floor(p.lng / cellDeg);
    const neighbours = [];

    // Check 3×3 neighborhood of cells
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const bucket = grid.get(`${ci + di},${cj + dj}`);
        if (!bucket) continue;
        for (const i of bucket) {
          if (haversineKm(p.lat, p.lng, points[i].lat, points[i].lng) <= epsKm) {
            neighbours.push(i);
          }
        }
      }
    }
    return neighbours;
  }

  const labels = new Int32Array(n).fill(-1); // -1 = unvisited
  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbours = regionQuery(i);
    if (neighbours.length < minPts) {
      labels[i] = -2; // noise
      continue;
    }
    labels[i] = clusterId;
    const seed = [...neighbours];
    const inSeed = new Set(seed);
    for (let j = 0; j < seed.length; j++) {
      const q = seed[j];
      if (labels[q] === -2) labels[q] = clusterId;
      if (labels[q] !== -1) continue;
      labels[q] = clusterId;
      const qNeighbours = regionQuery(q);
      if (qNeighbours.length >= minPts) {
        for (const nb of qNeighbours) {
          if (!inSeed.has(nb)) {
            inSeed.add(nb);
            seed.push(nb);
          }
        }
      }
    }
    clusterId++;
  }

  const clusters = [];
  for (let i = 0; i < n; i++) {
    if (labels[i] >= 0) {
      if (!clusters[labels[i]]) clusters[labels[i]] = [];
      clusters[labels[i]].push(points[i]);
    }
  }
  return clusters.filter(Boolean);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Build risk corridors from nearby high/critical-risk points.
 *
 * @param {Array<object>} features — GeoJSON Point features with properties
 * @param {number} [maxDistKm=30] — max distance to connect two points
 * @returns {Array<{ coords: [[lat,lng],...], riskLevel: string, avgProbability: number }>}
 */
export function buildCorridors(features, maxDistKm = 30) {
  // Filter to HIGH + CRITICAL only
  const highRisk = features.filter(
    (f) => riskRank(f.properties?.riskLevel) >= 3
  );
  if (highRisk.length < 2) return [];

  // Build adjacency graph
  const adj = highRisk.map(() => []);
  for (let i = 0; i < highRisk.length; i++) {
    for (let j = i + 1; j < highRisk.length; j++) {
      const pi = highRisk[i].properties;
      const pj = highRisk[j].properties;
      const dist = haversineKm(pi.center_lat, pi.center_lng, pj.center_lat, pj.center_lng);
      if (dist <= maxDistKm && dist > 0) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // Extract connected chains via DFS
  const visited = new Set();
  const corridors = [];

  for (let start = 0; start < highRisk.length; start++) {
    if (visited.has(start) || adj[start].length === 0) continue;
    const chain = [];
    const stack = [start];
    while (stack.length) {
      const node = stack.pop();
      if (visited.has(node)) continue;
      visited.add(node);
      chain.push(node);
      for (const neighbour of adj[node]) {
        if (!visited.has(neighbour)) stack.push(neighbour);
      }
    }
    if (chain.length >= 2) {
      // Sort chain by latitude for consistent rendering
      chain.sort((a, b) => highRisk[a].properties.center_lat - highRisk[b].properties.center_lat);
      const coords = chain.map((idx) => [
        highRisk[idx].properties.center_lat,
        highRisk[idx].properties.center_lng,
      ]);
      const levels = chain.map((idx) => highRisk[idx].properties.riskLevel);
      const probs = chain.map((idx) => highRisk[idx].properties.probability ?? 0);
      corridors.push({
        coords,
        riskLevel: highestRisk(levels),
        avgProbability: probs.reduce((s, v) => s + v, 0) / probs.length,
      });
    }
  }

  return corridors;
}

/**
 * Build risk area polygons from concentrated prediction clusters.
 *
 * @param {Array<object>} features — GeoJSON Point features with properties
 * @param {number} [epsKm=40] — DBSCAN epsilon in km
 * @param {number} [minPts=3] — minimum cluster size
 * @returns {Array<{ coords: [[lat,lng],...], riskLevel: string, avgProbability: number, pointCount: number }>}
 */
export function buildRiskAreas(features, epsKm = 40, minPts = 3) {
  // Filter to MODERATE and above
  const risky = features.filter(
    (f) => riskRank(f.properties?.riskLevel) >= 2
  );
  if (risky.length < minPts) return [];

  const points = risky.map((f) => ({
    lat: f.properties.center_lat,
    lng: f.properties.center_lng,
    riskLevel: f.properties.riskLevel,
    probability: f.properties.probability ?? 0,
  }));

  const clusters = dbscan(points, epsKm, minPts);
  const areas = [];

  for (const cluster of clusters) {
    if (cluster.length < 3) continue; // need at least 3 points for a polygon
    const hullInput = cluster.map((p) => [p.lat, p.lng]);
    const hull = convexHull(hullInput);
    if (hull.length < 3) continue;

    // Close the polygon
    const closed = [...hull, hull[0]];
    const probs = cluster.map((p) => p.probability);
    areas.push({
      coords: closed,
      riskLevel: highestRisk(cluster.map((p) => p.riskLevel)),
      avgProbability: probs.reduce((s, v) => s + v, 0) / probs.length,
      pointCount: cluster.length,
    });
  }

  return areas;
}
