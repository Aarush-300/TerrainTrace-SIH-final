import os
from pathlib import Path

import joblib

from schemas import (
    build_model_frame,
    build_model_frame_batch,
    build_raw_feature_frame,
    build_raw_feature_frame_batch,
    load_feature_schema,
    validate_features,
)


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_ACTIVE_MODEL = BASE_DIR / "models" / "active" / "model.joblib"
DEFAULT_LEGACY_MODEL = BASE_DIR / "models" / "active" / "landslide_model_package.joblib"
DEFAULT_PREPROCESSING = BASE_DIR / "models" / "active" / "preprocessing.joblib"


class ModelNotReadyError(RuntimeError):
    pass


class PredictionError(RuntimeError):
    pass


class ModelPredictor:
    """Replaceable inference interface for the Python service."""

    def __init__(self, model_path=None, schema_path=None):
        self.schema = load_feature_schema(schema_path)
        self.model_version = os.environ.get("MODEL_VERSION", self.schema.get("model_version", "v1"))
        requested_path = model_path or os.environ.get("MODEL_PATH")
        self.model_path = Path(requested_path) if requested_path else (
            DEFAULT_ACTIVE_MODEL if DEFAULT_ACTIVE_MODEL.exists() else DEFAULT_LEGACY_MODEL
        )
        requested_preprocessing = os.environ.get("PREPROCESSING_PATH")
        self.preprocessing_path = Path(requested_preprocessing) if requested_preprocessing else DEFAULT_PREPROCESSING
        try:
            package = joblib.load(self.model_path)
            self.model = package["model"] if isinstance(package, dict) else package
            self.model_columns = package.get("feature_columns") if isinstance(package, dict) else None
            self.preprocessor = joblib.load(self.preprocessing_path) if self.preprocessing_path.exists() else None
            if not self.model_columns:
                self.model_columns = list(getattr(self.model, "feature_names_in_", []))
            if (not self.model_columns and self.preprocessor is None) or not hasattr(self.model, "predict_proba"):
                raise ModelNotReadyError("Active model must expose predict_proba and either feature columns or preprocessing")
        except ModelNotReadyError:
            raise
        except Exception as error:
            raise ModelNotReadyError(f"Unable to load active model: {error}") from error

    def predict(self, raw_features):
        features = validate_features(raw_features, self.schema)
        frame = (
            self.preprocessor.transform(build_raw_feature_frame(features, self.schema))
            if self.preprocessor is not None
            else build_model_frame(features, self.schema, self.model_columns)
        )
        try:
            probabilities = self.model.predict_proba(frame)[0]
            classes = list(self.model.classes_)
            positive_index = classes.index(1)
            probability = float(probabilities[positive_index])
        except Exception as error:
            raise PredictionError(f"Active model could not score this feature vector: {error}") from error

        return {
            "probability": probability,
            "risk_score": int(round(probability * 100)),
            # This is a class-separation confidence heuristic, not a claim of
            # calibrated uncertainty. A calibrated model can keep this field.
            "confidence": float(max(probability, 1 - probability)),
            "model_version": self.model_version,
        }

    def predict_batch(self, raw_features_list):
        features_list = [validate_features(raw_features, self.schema) for raw_features in raw_features_list]
        frame = (
            self.preprocessor.transform(build_raw_feature_frame_batch(features_list, self.schema))
            if self.preprocessor is not None
            else build_model_frame_batch(features_list, self.schema, self.model_columns)
        )
        try:
            probabilities_batch = self.model.predict_proba(frame)
            classes = list(self.model.classes_)
            positive_index = classes.index(1)
            probabilities = [float(p[positive_index]) for p in probabilities_batch]
        except Exception as error:
            raise PredictionError(f"Active model could not score this batch: {error}") from error

        results = []
        for probability in probabilities:
            results.append({
                "probability": probability,
                "risk_score": int(round(probability * 100)),
                "confidence": float(max(probability, 1 - probability)),
                "model_version": self.model_version,
            })
        return results


_predictor = None
_initialization_error = None


def get_predictor():
    global _predictor, _initialization_error
    if _predictor is None and _initialization_error is None:
        try:
            _predictor = ModelPredictor()
        except ModelNotReadyError as error:
            _initialization_error = error
    if _initialization_error:
        raise _initialization_error
    return _predictor
