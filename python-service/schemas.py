"""Feature validation and the legacy-model input adapter.

This module deliberately owns feature ordering and categorical encoding. Node
only sends named, normalized feature values; no model-specific preprocessing
ever leaks into the public backend.
"""

import json
import math
import os
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SCHEMA_PATH = BASE_DIR / "feature_schema.json"


class FeatureValidationError(ValueError):
    def __init__(self, message, missing_features=None):
        super().__init__(message)
        self.missing_features = missing_features or []


def load_feature_schema(path=None):
    schema_path = Path(path or os.environ.get("FEATURE_SCHEMA_PATH", DEFAULT_SCHEMA_PATH))
    with schema_path.open("r", encoding="utf-8") as schema_file:
        schema = json.load(schema_file)
    if not isinstance(schema.get("features"), list):
        raise ValueError("Feature schema must contain a features array")
    return schema


def validate_features(features, schema):
    clean = {}
    missing = []
    for definition in schema["features"]:
        name = definition["name"]
        value = features.get(name)
        if value is None:
            if definition["type"] == "categorical":
                clean[name] = "unknown"
            else:
                clean[name] = float("nan")
            continue

        if definition["type"] == "numeric":
            if isinstance(value, bool):
                raise FeatureValidationError(f"{name} must be a finite number")
            try:
                value = float(value)
            except (TypeError, ValueError) as error:
                raise FeatureValidationError(f"{name} must be a finite number") from error
            if not math.isfinite(value):
                raise FeatureValidationError(f"{name} must be a finite number")
            if "minimum" in definition and value < definition["minimum"]:
                raise FeatureValidationError(f"{name} must be at least {definition['minimum']}")
        elif definition["type"] == "categorical":
            # CatBoost categorical features strictly require string values.
            # Coerce numeric placeholders (0, 0.0) and empty strings to
            # "unknown" so live API data never triggers a type error.
            value = str(value).strip().lower()
            if value in ("", "0", "0.0", "none", "null", "nan"):
                value = "unknown"
        else:
            raise FeatureValidationError(f"Unsupported schema type for {name}")
        clean[name] = value

    if missing:
        raise FeatureValidationError("Required model features are unavailable", missing)
    return clean


def build_model_frame(features, schema, model_columns):
    """Build precisely the frame expected by the bundled model.

    Categorical features are always stored as strings (CatBoost requirement).
    Numeric features default to 0.0 when absent.
    """
    # Identify which schema features are categorical so we can set proper defaults
    categorical_cols = set()
    for definition in schema["features"]:
        if definition["type"] == "categorical":
            # For legacy one-hot models, prefix columns are numeric.
            # For CatBoost native, the model_column (if present) is categorical.
            if "model_column" in definition:
                categorical_cols.add(definition["model_column"])

    row = {}
    for column in model_columns:
        row[column] = "unknown" if column in categorical_cols else 0.0

    for definition in schema["features"]:
        value = features.get(definition["name"])
        if value is None:
            continue
        if definition["type"] == "numeric":
            model_column = definition.get("model_column", definition["name"])
            if model_column not in row:
                raise FeatureValidationError(f"Active model does not accept {definition['name']}")
            row[model_column] = value
        else:
            # CatBoost native categorical — set the column directly as a string
            if "model_column" in definition and definition["model_column"] in row:
                row[definition["model_column"]] = str(value)
            # Legacy one-hot encoding fallback
            elif "model_column_prefix" in definition:
                encoded_column = f"{definition['model_column_prefix']}{value}"
                if encoded_column in row:
                    row[encoded_column] = 1.0
    return pd.DataFrame([[row[column] for column in model_columns]], columns=model_columns)


def build_raw_feature_frame(features, schema):
    """Preserve configured feature ordering for a replacement preprocessor.

    Categorical values are explicitly cast to strings so that CatBoost
    (or any downstream categorical handler) never receives a numeric type.
    """
    columns = [definition["name"] for definition in schema["features"]]
    values = []
    for definition in schema["features"]:
        value = features.get(definition["name"])
        if definition["type"] == "categorical":
            value = str(value) if value is not None else "unknown"
        values.append(value)
    return pd.DataFrame([values], columns=columns)


def build_model_frame_batch(features_list, schema, model_columns):
    categorical_cols = set()
    for definition in schema["features"]:
        if definition["type"] == "categorical":
            if "model_column" in definition:
                categorical_cols.add(definition["model_column"])

    all_rows = []
    for features in features_list:
        row = {}
        for column in model_columns:
            row[column] = "unknown" if column in categorical_cols else 0.0

        for definition in schema["features"]:
            value = features.get(definition["name"])
            if value is None:
                continue
            if definition["type"] == "numeric":
                model_column = definition.get("model_column", definition["name"])
                if model_column not in row:
                    raise FeatureValidationError(f"Active model does not accept {definition['name']}")
                row[model_column] = value
            else:
                if "model_column" in definition and definition["model_column"] in row:
                    row[definition["model_column"]] = str(value)
                elif "model_column_prefix" in definition:
                    encoded_column = f"{definition['model_column_prefix']}{value}"
                    if encoded_column in row:
                        row[encoded_column] = 1.0
        all_rows.append([row[column] for column in model_columns])
        
    return pd.DataFrame(all_rows, columns=model_columns)


def build_raw_feature_frame_batch(features_list, schema):
    columns = [definition["name"] for definition in schema["features"]]
    all_values = []
    for features in features_list:
        values = []
        for definition in schema["features"]:
            value = features.get(definition["name"])
            if definition["type"] == "categorical":
                value = str(value) if value is not None else "unknown"
            values.append(value)
        all_values.append(values)
    return pd.DataFrame(all_values, columns=columns)
