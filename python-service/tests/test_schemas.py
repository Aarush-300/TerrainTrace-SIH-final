import unittest

from schemas import FeatureValidationError, build_model_frame, load_feature_schema, validate_features


VALID_FEATURES = {
    "elevation_m": 1200,
    "slope_deg": 31.2,
    "fault_distance_m": 4300,
    "rainfall_3d_mm": 156.4,
    "rainfall_24h_mm": 84.2,
    "soil_moisture_pct": 72.5,
    "lithology": "crystalline metamorphic rocks",
}


class FeatureSchemaTests(unittest.TestCase):
    def setUp(self):
        self.schema = load_feature_schema()

    def test_missing_live_data_is_nan_filled(self):
        features = dict(VALID_FEATURES)
        del features["soil_moisture_pct"]
        clean = validate_features(features, self.schema)
        import math
        self.assertTrue(math.isnan(clean["soil_moisture_pct"]))

    def test_known_lithology_is_encoded_in_model_order(self):
        clean = validate_features(VALID_FEATURES, self.schema)
        columns = [
            "elevation_m", "slope_deg", "fault_distance_m", "rainfall_3d_mm",
            "rainfall_24h_intensity", "soil_moisture_pct",
            "lithology_crystalline metamorphic rocks",
        ]
        frame = build_model_frame(clean, self.schema, columns)
        self.assertEqual(frame.loc[0, "rainfall_24h_intensity"], 84.2)
        self.assertEqual(frame.loc[0, "lithology_crystalline metamorphic rocks"], 1.0)

    def test_unknown_observed_category_is_not_treated_as_missing(self):
        features = dict(VALID_FEATURES, lithology="unmapped material")
        clean = validate_features(features, self.schema)
        columns = [
            "elevation_m", "slope_deg", "fault_distance_m", "rainfall_3d_mm",
            "rainfall_24h_intensity", "soil_moisture_pct",
            "lithology_crystalline metamorphic rocks", "lithology_sedimentary rocks",
        ]
        frame = build_model_frame(clean, self.schema, columns)
        self.assertEqual(frame.loc[0, "lithology_crystalline metamorphic rocks"], 0.0)
        self.assertEqual(frame.loc[0, "lithology_sedimentary rocks"], 0.0)


if __name__ == "__main__":
    unittest.main()
