from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT / "src"))

from preprocess import split_preprocess_smote  # noqa: E402


MODELS_DIR = PROJECT_ROOT / "models" / "saved"
RESULTS_DIR = PROJECT_ROOT / "results"


def normalize(series: pd.Series) -> pd.Series:
    total = series.sum()
    if total == 0:
        return series
    return series / total


def load_artifact(model_name: str) -> dict:
    artifact_path = MODELS_DIR / f"{model_name}.pkl"
    if not artifact_path.exists():
        raise FileNotFoundError(f"Missing model artifact: {artifact_path}")
    return joblib.load(artifact_path)


def get_shap_importance(xgboost_artifact: dict, X_test: pd.DataFrame) -> pd.Series:
    explainer = shap.TreeExplainer(xgboost_artifact["model"])
    shap_values = explainer.shap_values(X_test)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    return pd.Series(np.abs(shap_values).mean(axis=0), index=X_test.columns, name="shap_mean_abs")


def get_random_forest_importance(random_forest_artifact: dict) -> pd.Series:
    model = random_forest_artifact["model"]
    feature_names = random_forest_artifact["feature_names"]
    return pd.Series(model.feature_importances_, index=feature_names, name="rf_importance")


def get_xgboost_gain_importance(xgboost_artifact: dict) -> pd.Series:
    model = xgboost_artifact["model"]
    feature_names = xgboost_artifact["feature_names"]
    booster_scores = model.get_booster().get_score(importance_type="gain")

    mapped_scores = {}
    for key, value in booster_scores.items():
        if key.startswith("f") and key[1:].isdigit():
            idx = int(key[1:])
            if idx < len(feature_names):
                mapped_scores[feature_names[idx]] = value
                continue
        mapped_scores[key] = value

    return pd.Series(mapped_scores, name="xgb_gain_importance")


def build_feature_importance(dataset: str = "heart") -> pd.DataFrame:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    xgboost_artifact = load_artifact("xgboost")
    random_forest_artifact = load_artifact("random_forest")
    processed = split_preprocess_smote(dataset=dataset, use_smote=True)
    X_test = pd.DataFrame(processed.X_test, columns=xgboost_artifact["feature_names"])

    shap_importance = get_shap_importance(xgboost_artifact, X_test)
    rf_importance = get_random_forest_importance(random_forest_artifact)
    xgb_gain_importance = get_xgboost_gain_importance(xgboost_artifact)

    importance = pd.concat(
        [shap_importance, rf_importance, xgb_gain_importance],
        axis=1,
    ).fillna(0)
    importance["shap_rank"] = importance["shap_mean_abs"].rank(ascending=False, method="min").astype(int)
    importance["rf_rank"] = importance["rf_importance"].rank(ascending=False, method="min").astype(int)
    importance["xgb_gain_rank"] = importance["xgb_gain_importance"].rank(
        ascending=False,
        method="min",
    ).astype(int)
    importance["shap_importance_norm"] = normalize(importance["shap_mean_abs"])
    importance["rf_importance_norm"] = normalize(importance["rf_importance"])
    importance["xgb_gain_importance_norm"] = normalize(importance["xgb_gain_importance"])

    importance = importance.reset_index(names="feature").sort_values(
        ["shap_rank", "rf_rank", "xgb_gain_rank"],
    )
    output_path = RESULTS_DIR / "feature_importance.csv"
    importance.to_csv(output_path, index=False)
    return importance


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare SHAP, RF, and XGBoost feature importance.")
    parser.add_argument("--dataset", default="heart", choices=["heart", "cardio", "cardio_processed"])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    importance = build_feature_importance(dataset=args.dataset)
    print("Saved results/feature_importance.csv")
    print(importance.head(15).to_string(index=False))


if __name__ == "__main__":
    main()
