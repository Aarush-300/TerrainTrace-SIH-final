# Active model location

Place a replacement model at `model.joblib` (and any model-owned preprocessing
artifact beside it) or set `MODEL_PATH`. The existing repository model remains
at the project root for backwards compatibility and is used automatically when
this directory has no `model.joblib`.
