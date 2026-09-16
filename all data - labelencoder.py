import os
import math
import tempfile
import requests
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from pyproj import Transformer
from shapely.geometry import Point
import joblib
from config import API_KEY
# =========================================================
# CONFIGURATION & HIMALAYAN BOUNDS
# =========================================================


# Expanded bounds to match the updated training data
LAT_MIN, LAT_MAX = 21.0, 34.0
LON_MIN, LON_MAX = 75.0, 98.0


def get_landslide_features(lat, lon, opentopo_key, expected_model_columns=None):
    if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
        raise ValueError(
            f"Coordinates are outside the supported bounds (Lat: {LAT_MIN}-{LAT_MAX}, Lon: {LON_MIN}-{LON_MAX})."
        )

    features = {}
    print("\nExtracting feature vector...")

    # ---------------------------------------------------------
    # 1. OPEN-METEO API: Dynamic Hydro-Meteorological Data
    # ---------------------------------------------------------
    print("Fetching Open-Meteo data...")
    meteo_url = "https://api.open-meteo.com/v1/forecast"
    meteo_params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,soil_moisture_0_to_7cm",
        "past_days": 3,
        "forecast_days": 1,
        "timezone": "auto",
    }

    res = requests.get(meteo_url, params=meteo_params)
    res.raise_for_status()
    meteo_data = res.json()

    precip = meteo_data["hourly"]["precipitation"]
    soil_m = meteo_data["hourly"]["soil_moisture_0_to_7cm"]

    features["rainfall_3d_mm"] = sum(precip[-72:])
    features["rainfall_24h_intensity"] = max(precip[-24:])
    features["soil_moisture_pct"] = (
        (soil_m[-1] * 100) if soil_m[-1] is not None else 0.0
    )

    # ---------------------------------------------------------
    # 2. OPENTOPOGRAPHY API: Static Terrain Data
    # ---------------------------------------------------------
    print("Downloading Local DEM from OpenTopography...")
    area = 0.005
    topo_url = "https://portal.opentopography.org/API/globaldem"
    topo_params = {
        "demtype": "COP30",
        "south": lat - area,
        "north": lat + area,
        "west": lon - area,
        "east": lon + area,
        "outputFormat": "GTiff",
        "API_Key": opentopo_key,
    }

    topo_res = requests.get(topo_url, params=topo_params, timeout=120)
    topo_res.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as temp_dem:
        temp_dem.write(topo_res.content)
        temp_dem_path = temp_dem.name

    try:
        with rasterio.open(temp_dem_path) as src:
            utm_zone = int(math.floor((lon + 180) / 6) + 1)
            utm_crs = (
                f"EPSG:{32600 + utm_zone}" if lat >= 0 else f"EPSG:{32700 + utm_zone}"
            )

            transform, width, height = calculate_default_transform(
                src.crs, utm_crs, src.width, src.height, *src.bounds
            )
            dem_proj = np.full((height, width), np.nan, dtype=np.float32)
            reproject(
                source=rasterio.band(src, 1),
                destination=dem_proj,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs=utm_crs,
                resampling=Resampling.bilinear,
            )

            dz_dy, dz_dx = np.gradient(dem_proj, abs(transform.e), transform.a)
            slope_deg = np.degrees(np.arctan(np.sqrt(dz_dx**2 + dz_dy**2)))

            transformer = Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
            x, y = transformer.transform(lon, lat)
            col, row = ~transform * (x, y)

            col = max(0, min(int(col), width - 1))
            row = max(0, min(int(row), height - 1))

            features["elevation_m"] = float(dem_proj[row, col])
            features["slope_deg"] = float(slope_deg[row, col])
    finally:
        os.remove(temp_dem_path)

    # ---------------------------------------------------------
    # 3. MACROSTRAT API: Geological Lithology Data
    # ---------------------------------------------------------
    print("Fetching Geological data from Macrostrat API...")
    try:
        macro_res = requests.get(
            "https://macrostrat.org/api/v2/geologic_units/map",
            params={"lat": lat, "lng": lon},
            timeout=10,
        )
        macro_res.raise_for_status()
        macro_data = macro_res.json()

        if (
            "success" in macro_data
            and "data" in macro_data["success"]
            and len(macro_data["success"]["data"]) > 0
        ):
            features["lithology"] = macro_data["success"]["data"][0].get(
                "lith", "unknown"
            )
            print(f"  -> Lithology found: {features['lithology']}")
        else:
            features["lithology"] = "unknown"
            print("  -> No geologic data found for this location.")
    except Exception as e:
        print(f"  -> Macrostrat API error: {e}")
        features["lithology"] = "unknown"

    # ---------------------------------------------------------
    # 4. GEM GLOBAL ACTIVE FAULTS
    # ---------------------------------------------------------
    print("Calculating distance to tectonic faults...")
    gem_url = "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults.geojson"
    faults_gdf = gpd.read_file(gem_url)
    central_utm_crs = "EPSG:32645"

    faults_clipped = gpd.clip(faults_gdf, [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX]).to_crs(
        central_utm_crs
    )
    fault_network = faults_clipped.geometry.unary_union

    user_point = gpd.GeoDataFrame(
        [{"geometry": Point(lon, lat)}], crs="EPSG:4326"
    ).to_crs(central_utm_crs)
    features["fault_distance_m"] = float(
        user_point.geometry.distance(fault_network).iloc[0]
    )

    # ---------------------------------------------------------
    # FORMAT FOR INFERENCE
    # ---------------------------------------------------------
    feature_names = [
        "slope_deg",
        "elevation_m",
        "lithology",
        "rainfall_3d_mm",
        "rainfall_24h_intensity",
        "soil_moisture_pct",
        "fault_distance_m",
    ]

    df_inf = pd.DataFrame(
        [[features[name] for name in feature_names]], columns=feature_names
    )

    # Apply One-Hot Encoding to the single row
    df_inf = pd.get_dummies(df_inf, columns=["lithology"], dtype=int)

    # ALIGNMENT: Ensure inference matrix perfectly matches training columns
    if expected_model_columns is not None:
        df_inf = df_inf.reindex(columns=expected_model_columns, fill_value=0)

    return df_inf


if __name__ == "__main__":
    try:
        user_lat = float(input("Enter Latitude (e.g., 25.57 for Meghalaya): "))
        user_lon = float(input("Enter Longitude (e.g., 91.88): "))

        # Load the compiled package from your training script
        try:
            model_package = joblib.load("landslide_model_package.joblib")
            rf_model = model_package["model"]
            expected_cols = model_package["feature_columns"]
            print("\nSuccessfully loaded model and feature configurations.")
        except FileNotFoundError:
            print(
                "\nWarning: 'landslide_model_package.joblib' not found. Extracting mock columns for testing..."
            )
            rf_model = None
            expected_cols = [
                "slope_deg",
                "elevation_m",
                "rainfall_3d_mm",
                "rainfall_24h_intensity",
                "soil_moisture_pct",
                "fault_distance_m",
                "lithology_Sandstone",
                "lithology_Shale",
                "lithology_unknown",
            ]

        ml_vector = get_landslide_features(
            user_lat, user_lon, API_KEY, expected_model_columns=expected_cols
        )

        print("\n=============================================")
        print("ML INFERENCE FEATURE VECTOR READY")
        print("=============================================")
        print(ml_vector.to_string(index=False))

        # Run Live Prediction if Joblib is present
        if rf_model is not None:
            prediction = rf_model.predict(ml_vector)
            probability = rf_model.predict_proba(ml_vector)[0][1]

            print("\n=============================================")
            print(
                f"LANDSLIDE RISK PREDICTION: {'HIGH RISK' if prediction[0] == 1 else 'LOW RISK'}"
            )
            print(f"Probability of Failure: {probability:.2%}")
            print("=============================================")

    except ValueError as e:
        print(f"\nInput Error: {e}")
