from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from preprocess import DATASETS, load_dataset, split_preprocess_smote  # noqa: E402


MODELS_DIR = PROJECT_ROOT / "models" / "saved"
RESULTS_DIR = PROJECT_ROOT / "results"


def import_xgboost():
    try:
        from xgboost import XGBClassifier
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "xgboost is required for Task 2.2. Run `pip install -r requirements.txt` first."
        ) from exc

    return XGBClassifier


def build_models(random_state: int = 42) -> dict[str, object]:
    XGBClassifier = import_xgboost()
    return {
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=random_state,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            random_state=random_state,
            class_weight="balanced",
            n_jobs=-1,
        ),
        "xgboost": XGBClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=-1,
        ),
        "svm_rbf": SVC(
            kernel="rbf",
            C=1.0,
            gamma="scale",
            probability=True,
            class_weight="balanced",
            random_state=random_state,
        ),
    }


def predict_scores(model, X_test: np.ndarray) -> np.ndarray:
    if hasattr(model, "predict_proba"):
        return model.predict_proba(X_test)[:, 1]
    return model.decision_function(X_test)


def evaluate_model(model, X_test: np.ndarray, y_test: pd.Series) -> dict[str, object]:
    y_pred = model.predict(X_test)
    y_score = predict_scores(model, X_test)
    return {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "auc_roc": roc_auc_score(y_test, y_score),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }


def cross_validate_model(model, X: np.ndarray, y: pd.Series) -> dict[str, float]:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = {
        "accuracy": "accuracy",
        "precision": "precision",
        "recall": "recall",
        "f1": "f1",
        "auc_roc": "roc_auc",
    }
    cv_scores = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
    return {
        metric.replace("test_", "cv_"): float(np.mean(values))
        for metric, values in cv_scores.items()
        if metric.startswith("test_")
    }


def train_models(dataset: str = "heart", random_state: int = 42) -> pd.DataFrame:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    processed = split_preprocess_smote(dataset=dataset, random_state=random_state)
    models = build_models(random_state=random_state)

    rows = []
    for model_name, estimator in models.items():
        print(f"Training {model_name}...")
        cv_metrics = cross_validate_model(estimator, processed.X_train, processed.y_train)
        estimator.fit(processed.X_train, processed.y_train)
        test_metrics = evaluate_model(estimator, processed.X_test, processed.y_test)

        artifact = {
            "model": estimator,
            "preprocessor": processed.preprocessor,
            "feature_names": processed.feature_names,
            "dataset": dataset,
            "target": DATASETS[dataset]["target"],
        }
        joblib.dump(artifact, MODELS_DIR / f"{model_name}.pkl")

        row = {
            "model": model_name,
            **cv_metrics,
            **{key: value for key, value in test_metrics.items() if key != "confusion_matrix"},
            "confusion_matrix": json.dumps(test_metrics["confusion_matrix"]),
        }
        rows.append(row)

    results = pd.DataFrame(rows).sort_values(["auc_roc", "f1"], ascending=False)
    results.to_csv(RESULTS_DIR / "classical_model_metrics.csv", index=False)
    print("\nModel leaderboard:")
    print(results.to_string(index=False))
    return results


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train classical CVD risk models.")
    parser.add_argument(
        "--dataset",
        default="heart",
        choices=sorted(DATASETS),
        help="Staged dataset to train on.",
    )
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_dataset(args.dataset)
    train_models(dataset=args.dataset, random_state=args.random_state)


if __name__ == "__main__":
    main()
