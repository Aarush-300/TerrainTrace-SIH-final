# TerrainTrace

TerrainTrace is a Northeast India landslide early-warning prototype. The React
GIS UI is unchanged; it talks only to the Node API, which owns validation and
feature collection.

```text
React GIS UI -> Node/Express API -> Feature service -> Python ML API -> active model
                              |-> weather / terrain / geology adapters
                              |-> MongoDB reports and optional cached grid
```

## Run locally

Prerequisites: Node.js 18+, Python 3.10+, and MongoDB only if you need reports,
historical events, or the cached grid. The existing
`landslide_model_package.joblib` stays in the repository root.

```powershell
cd python-service
python -m pip install -r requirements.txt
python app.py
```

```powershell
cd server
npm install
npm start
```

```powershell
cd client
npm install
npm run dev
```

The client runs at `http://localhost:3000`, Node at port `5000`, and the ML
service at port `5001`. `start.ps1` still launches all three from the project
root.

## Stable backend API

`POST /api/risk/predict`

```json
{ "latitude": 25.57, "longitude": 91.88 }
```

On complete source data, it returns a standard response such as:

```json
{
  "status": "ok",
  "location": { "latitude": 25.57, "longitude": 91.88 },
  "risk_score": 82,
  "risk_level": "CRITICAL",
  "probability": 0.82,
  "confidence": 0.82,
  "model_version": "v1",
  "features": { "elevation_m": 1200, "slope_deg": 31.2 },
  "data_timestamp": "2026-01-01T00:00"
}
```

If a required live source is unavailable, the API returns HTTP `424` with
`status: "partial"`, `missing_features`, and the features that really were
collected. It never inserts fabricated zeroes into a prediction.

`GET /api/risk/grid` returns the currently persisted GeoJSON grid. It is
intentionally cache-only: a full-country refresh should be an explicit
operational process, rather than thousands of live provider calls on a UI
request. The old `/api/risk-zones` and `/api/predict-point` remain lightweight
adapters for the existing frontend.

`POST /api/reports`

```json
{
  "latitude": 25.57,
  "longitude": 91.88,
  "type": "CRACK",
  "description": "Fresh crack beside the road",
  "image_reference": "https://example.org/report.jpg",
  "timestamp": "2026-09-12T10:00:00Z"
}
```

Allowed report types are `CRACK`, `SLOPE_MOVEMENT`, `LANDSLIDE`, `ROCKFALL`,
`ROAD_BLOCKAGE`, and `OTHER`. Image and video references are stored for future
analysis; no computer vision or physics calculations are performed.

`GET /api/health` reports ML and database readiness.

## Configuration and extension

`server/src/config/features.json` is the central backend feature registry. To
add or remove a feature, update it, update or add its small provider adapter,
then update `python-service/feature_schema.json` for the active model’s input
mapping. The Node layer sends only named features to `POST /predict`; it has no
joblib, model-column, or preprocessing knowledge.

The default adapters use Open-Meteo for weather/elevation, Macrostrat for
lithology, and GEM active-fault data. They have bounded in-memory caches and
report failures as missing data. `ML_SERVICE_URL`, `MODEL_PATH`, `MODEL_VERSION`,
`MONGO_URI`, `PREPROCESSING_PATH`, and provider URL/timeout variables can be set in environment files.

To replace the model, place it at
`python-service/models/active/model.joblib` (or set `MODEL_PATH`), optionally
place its fitted `preprocessing.joblib` beside it, update its ML-side schema,
and set `MODEL_VERSION`.
The frontend and public Node API do not change. A pipeline model, neural model,
or future physics-informed ML component belongs behind this same Python
`POST /predict` contract.

## Focused checks

```powershell
cd server; npm test
cd ../python-service; python -m unittest discover -s tests
```
