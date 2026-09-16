import unittest

from predictor import ModelPredictor


class PredictorContractTests(unittest.TestCase):
    def test_active_model_returns_the_stable_prediction_contract(self):
        result = ModelPredictor().predict({
            "elevation_m": 1200,
            "slope_deg": 31.2,
            "fault_distance_m": 4300,
            "rainfall_3d_mm": 156.4,
            "rainfall_24h_mm": 84.2,
            "soil_moisture_pct": 72.5,
            "lithology": "crystalline metamorphic rocks",
        })
        self.assertEqual(set(result), {"probability", "risk_score", "confidence", "model_version"})
        self.assertGreaterEqual(result["probability"], 0)
        self.assertLessEqual(result["probability"], 1)
        self.assertEqual(result["risk_score"], round(result["probability"] * 100))


if __name__ == "__main__":
    unittest.main()
