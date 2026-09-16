import logging
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from predictor import ModelNotReadyError, PredictionError, get_predictor
from schemas import FeatureValidationError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    CORS(app)

    @app.get("/health")
    def health():
        try:
            predictor = get_predictor()
            return jsonify({
                "status": "ok",
                "ready": True,
                "model_version": predictor.model_version,
            })
        except ModelNotReadyError as error:
            return jsonify({"status": "degraded", "ready": False, "error": str(error)}), 503

    @app.post("/predict")
    def predict():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("features"), dict):
            return jsonify({"error": "Request body must contain a features object"}), 400

        try:
            return jsonify(get_predictor().predict(payload["features"]))
        except FeatureValidationError as error:
            return jsonify({"error": str(error), "missing_features": error.missing_features}), 422
        except ModelNotReadyError as error:
            return jsonify({"error": str(error)}), 503
        except PredictionError as error:
            logger.warning("Prediction rejected: %s", error)
            return jsonify({"error": str(error)}), 422
        except Exception:
            logger.exception("Unexpected prediction error")
            return jsonify({"error": "Prediction failed"}), 500

    @app.post("/predict_batch")
    def predict_batch():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("points"), list):
            return jsonify({"error": "Request body must contain a points array"}), 400
            
        points = payload.get("points", [])
        if not points:
            return jsonify({"error": "Points array cannot be empty"}), 400
            
        raw_features_list = []
        for p in points:
            if not isinstance(p, dict) or not isinstance(p.get("features"), dict):
                return jsonify({"error": "Each point must contain a features object"}), 400
            raw_features_list.append(p["features"])

        try:
            results = get_predictor().predict_batch(raw_features_list)
            return jsonify({"results": results})
        except FeatureValidationError as error:
            return jsonify({"error": str(error), "missing_features": error.missing_features}), 422
        except ModelNotReadyError as error:
            return jsonify({"error": str(error)}), 503
        except PredictionError as error:
            logger.warning("Batch prediction rejected: %s", error)
            return jsonify({"error": str(error)}), 422
        except Exception:
            logger.exception("Unexpected batch prediction error")
            return jsonify({"error": "Batch prediction failed"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "5001")))
