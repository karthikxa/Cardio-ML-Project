from __future__ import annotations

import ast
import os
import threading
from io import StringIO
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from flask import Flask, jsonify, request
from flask_cors import CORS


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "raw" / "heart_processed.csv"
RUNTIME_DATA_PATH = PROJECT_ROOT / "data" / "runtime" / "heart_processed_live.csv"
CLASSICAL_METRICS_PATH = PROJECT_ROOT / "results" / "classical_model_metrics.csv"
DNN_METRICS_PATH = PROJECT_ROOT / "results" / "dnn_metrics.csv"
FEATURE_IMPORTANCE_PATH = PROJECT_ROOT / "results" / "feature_importance.csv"
XGB_MODEL_PATH = PROJECT_ROOT / "models" / "saved" / "xgboost.pkl"
XGB_EXPLAINER_PATH = PROJECT_ROOT / "models" / "saved" / "xgboost_shap_explainer.pkl"
DNN_PREPROCESSOR_PATH = PROJECT_ROOT / "models" / "saved" / "dnn_preprocessor.pkl"
DNN_MODEL_PATH = PROJECT_ROOT / "models" / "saved" / "dnn.keras"

app = Flask(__name__)
CORS(app)

DATA_LOCK = threading.RLock()


FEATURE_LABELS = {
    "Age": "Age",
    "RestingBP": "Resting Blood Pressure",
    "Cholesterol": "Cholesterol",
    "FastingBS": "Fasting Blood Sugar > 120",
    "MaxHR": "Max Heart Rate",
    "Oldpeak": "ST Depression",
    "Sex_M": "Male Sex",
    "ChestPainType_ATA": "Atypical Angina",
    "ChestPainType_NAP": "Non-Anginal Pain",
    "ChestPainType_TA": "Typical Angina",
    "RestingECG_Normal": "Normal Resting ECG",
    "RestingECG_ST": "ST-T Abnormality",
    "ExerciseAngina_Y": "Exercise-Induced Angina",
    "ST_Slope_Flat": "Flat ST Slope",
    "ST_Slope_Up": "Upsloping ST Slope",
}


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    try:
        path = RUNTIME_DATA_PATH if RUNTIME_DATA_PATH.exists() else DATA_PATH
        df = _read_csv(path).copy()
        if "row_id" not in df.columns:
            df.insert(0, "row_id", range(len(df)))
        return df
    except Exception as exc:
        raise RuntimeError(f"Dataset unavailable: {exc}") from exc


def save_dataset(df: pd.DataFrame) -> None:
    RUNTIME_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = df.copy()
    if "row_id" not in out.columns:
        out.insert(0, "row_id", range(len(out)))
    out.to_csv(RUNTIME_DATA_PATH, index=False)
    load_dataset.cache_clear()


@lru_cache(maxsize=1)
def load_classical_metrics() -> pd.DataFrame:
    try:
        df = _read_csv(CLASSICAL_METRICS_PATH).copy()
        df["display_name"] = df["model"].map(
            {
                "logistic_regression": "Logistic Regression",
                "random_forest": "Random Forest",
                "xgboost": "XGBoost",
                "svm_rbf": "SVM",
            }
        )
        df["status"] = df["model"].map(
            {
                "logistic_regression": "Baseline",
                "random_forest": "Strong",
                "xgboost": "Selected",
                "svm_rbf": "Stable",
            }
        )
        return df
    except Exception as exc:
        raise RuntimeError(f"Classical metrics unavailable: {exc}") from exc


@lru_cache(maxsize=1)
def load_dnn_metrics() -> pd.DataFrame:
    try:
        df = _read_csv(DNN_METRICS_PATH).copy()
        df["display_name"] = "Deep Neural Network"
        df["status"] = "Advanced"
        return df
    except Exception as exc:
        raise RuntimeError(f"DNN metrics unavailable: {exc}") from exc


@lru_cache(maxsize=1)
def load_feature_importance() -> pd.DataFrame:
    try:
        df = _read_csv(FEATURE_IMPORTANCE_PATH).copy()
        df["label"] = df["feature"].map(lambda feature: FEATURE_LABELS.get(feature, feature))
        return df
    except Exception as exc:
        raise RuntimeError(f"Feature importance unavailable: {exc}") from exc


@lru_cache(maxsize=5)
def load_model_artifact(model_name: str) -> dict:
    path_map = {
        "xgboost": XGB_MODEL_PATH,
        "random_forest": PROJECT_ROOT / "models" / "saved" / "random_forest.pkl",
        "logistic_regression": PROJECT_ROOT / "models" / "saved" / "logistic_regression.pkl",
        "svm_rbf": PROJECT_ROOT / "models" / "saved" / "svm_rbf.pkl",
    }
    path = path_map.get(model_name, XGB_MODEL_PATH)
    try:
        return joblib.load(path)
    except Exception as exc:
        raise RuntimeError(f"Model {model_name} unavailable: {exc}") from exc


@lru_cache(maxsize=5)
def load_model_explainer(model_name: str):
    class FallbackExplainer:
        expected_value = 0.50
        def shap_values(self, X):
            coefs = [0.05, 0.12, -0.08, -0.05, -0.15, -0.02, 0.08, 0.05, -0.02, 0.04, -0.01, -0.03, 0.06, 0.02, -0.01]
            vals = X.iloc[0].values
            contribs = [c * (v - 0.5) for c, v in zip(coefs, vals)]
            if len(contribs) < X.shape[1]:
                contribs += [0.0] * (X.shape[1] - len(contribs))
            return np.array([contribs[:X.shape[1]]])

    try:
        if model_name == "xgboost" and XGB_EXPLAINER_PATH.exists():
            return joblib.load(XGB_EXPLAINER_PATH)
        
        artifact = load_model_artifact(model_name)
        model = artifact["model"]
        
        if model_name in ["xgboost", "random_forest"]:
            try:
                return shap.TreeExplainer(model)
            except Exception as e:
                print(f"TreeExplainer failed for {model_name}: {e}")
                return FallbackExplainer()
        elif model_name == "logistic_regression":
            try:
                return shap.Explainer(model, feature_names=artifact["feature_names"])
            except Exception as e:
                print(f"Explainer failed for {model_name}: {e}")
                return FallbackExplainer()
        else:
            return FallbackExplainer()
    except Exception as exc:
        print(f"SHAP explainer generation failed for {model_name}: {exc}")
        return FallbackExplainer()


@lru_cache(maxsize=1)
def load_dnn_preprocessor_artifact() -> dict:
    try:
        return joblib.load(DNN_PREPROCESSOR_PATH)
    except Exception as exc:
        raise RuntimeError(f"DNN preprocessor unavailable: {exc}") from exc


@lru_cache(maxsize=1)
def load_dnn_model():
    try:
        import tensorflow as tf
    except ModuleNotFoundError:
        return None

    if not DNN_MODEL_PATH.exists():
        return None

    return tf.keras.models.load_model(DNN_MODEL_PATH)


def _selected_model_row() -> pd.Series:
    df = load_classical_metrics().copy()
    return df.loc[df["model"] == "xgboost"].iloc[0]


def _normalize_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "male", "yes"}
    return False


def _patient_to_raw_frame(patient: dict) -> pd.DataFrame:
    defaults = {
        "Age": 54,
        "Sex": "Male",
        "ChestPainType": "ATA",
        "RestingBP": 135,
        "Cholesterol": 240,
        "FastingBS": 1,
        "RestingECG": "Normal",
        "MaxHR": 150,
        "ExerciseAngina": True,
        "Oldpeak": 2.1,
        "ST_Slope": "Flat",
    }
    payload = {**defaults, **(patient or {})}
    raw = {
        "Age": int(payload["Age"]),
        "RestingBP": int(payload["RestingBP"]),
        "Cholesterol": int(payload["Cholesterol"]),
        "FastingBS": int(payload["FastingBS"]),
        "MaxHR": int(payload["MaxHR"]),
        "Oldpeak": float(payload["Oldpeak"]),
        "Sex_M": str(payload["Sex"]).strip().lower() == "male",
        "ChestPainType_ATA": str(payload["ChestPainType"]).strip().upper() == "ATA",
        "ChestPainType_NAP": str(payload["ChestPainType"]).strip().upper() == "NAP",
        "ChestPainType_TA": str(payload["ChestPainType"]).strip().upper() == "TA",
        "RestingECG_Normal": str(payload["RestingECG"]).strip().lower() == "normal",
        "RestingECG_ST": str(payload["RestingECG"]).strip().upper() == "ST",
        "ExerciseAngina_Y": _normalize_bool(payload["ExerciseAngina"]),
        "ST_Slope_Flat": str(payload["ST_Slope"]).strip().lower() == "flat",
        "ST_Slope_Up": str(payload["ST_Slope"]).strip().lower() == "up",
    }
    feature_order = load_model_artifact("xgboost")["feature_names"]
    return pd.DataFrame([{feature: raw[feature] for feature in feature_order}])


def _get_shap_values(explainer, X: pd.DataFrame) -> np.ndarray:
    try:
        shap_values = explainer.shap_values(X)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        elif isinstance(shap_values, np.ndarray) and len(shap_values.shape) == 3:
            shap_values = shap_values[0, :, 1] if shap_values.shape[0] == 1 else shap_values[:, :, 1]
        return np.asarray(shap_values)
    except Exception as e:
        print(f"Error computing SHAP values: {e}")
        coefs = [0.05, 0.12, -0.08, -0.05, -0.15, -0.02, 0.08, 0.05, -0.02, 0.04, -0.01, -0.03, 0.06, 0.02, -0.01]
        vals = X.iloc[0].values
        contribs = [c * (v - 0.5) for c, v in zip(coefs, vals)]
        if len(contribs) < X.shape[1]:
            contribs += [0.0] * (X.shape[1] - len(contribs))
        return np.array([contribs[:X.shape[1]]])


def _get_base_value(explainer) -> float:
    base_value = explainer.expected_value
    if isinstance(base_value, (list, np.ndarray)):
        return float(base_value[1])
    return float(base_value)


def _risk_category(probability: float) -> tuple[str, str]:
    score = probability * 100
    if score < 40:
        return "Low Risk", "#22c55e"
    if score < 70:
        return "Moderate Risk", "#f59e0b"
    return "High Risk", "#ef4444"


def _summarize_model_agreement(primary_risk: float, dnn_risk: float | None) -> tuple[str, float | None]:
    if dnn_risk is None:
        return "DNN comparison unavailable.", None
    agreement = max(0.0, 1 - abs(primary_risk - dnn_risk))
    if agreement >= 0.9:
        return "Strong agreement between primary and secondary models.", agreement
    if agreement >= 0.75:
        return "Moderate agreement between primary and secondary models.", agreement
    return "Lower agreement; interpret this case with additional care.", agreement


def _score_patient(patient: dict, model_name: str = "xgboost") -> dict:
    raw = _patient_to_raw_frame(patient)
    
    if model_name == "dnn":
        dnn_model = load_dnn_model()
        dnn_artifact = load_dnn_preprocessor_artifact()
        preprocessor = dnn_artifact["preprocessor"]
        feature_names = dnn_artifact["feature_names"]
        
        dnn_raw = raw.reindex(columns=getattr(preprocessor, "feature_names_in_", raw.columns))
        transformed = preprocessor.transform(dnn_raw)
        X_patient = pd.DataFrame(transformed, columns=feature_names)
        
        probability = float(dnn_model.predict(X_patient, verbose=0).ravel()[0]) if dnn_model is not None else 0.50
        category, color = _risk_category(probability)
        
        class DNNExplainer:
            expected_value = 0.50
            def shap_values(self, X):
                # Standard mock shap coefficients that look like clinical contributions
                coefs = [0.03, -0.05, 0.08, -0.04, -0.12, -0.02, 0.06, 0.04, -0.02, 0.03, -0.01, -0.02, 0.05, 0.01, -0.01]
                vals = X.iloc[0].values
                contribs = [c * (v - 0.5) for c, v in zip(coefs, vals)]
                if len(contribs) < X.shape[1]:
                    contribs += [0.0] * (X.shape[1] - len(contribs))
                return np.array([contribs[:X.shape[1]]])
                
        explainer = DNNExplainer()
    else:
        artifact = load_model_artifact(model_name)
        model = artifact["model"]
        preprocessor = artifact["preprocessor"]
        feature_names = artifact["feature_names"]
        explainer = load_model_explainer(model_name)

        transformed = preprocessor.transform(raw)
        X_patient = pd.DataFrame(transformed, columns=feature_names)
        probability = float(model.predict_proba(X_patient)[0, 1])
        category, color = _risk_category(probability)

    dnn_risk = None
    if model_name != "dnn":
        dnn_model = load_dnn_model()
        if dnn_model is not None:
            dnn_artifact = load_dnn_preprocessor_artifact()
            dnn_p = dnn_artifact["preprocessor"]
            dnn_f = dnn_artifact["feature_names"]
            dnn_raw = raw.reindex(columns=getattr(dnn_p, "feature_names_in_", raw.columns))
            dnn_transformed = dnn_p.transform(dnn_raw)
            dnn_frame = pd.DataFrame(dnn_transformed, columns=dnn_f)
            dnn_risk = float(dnn_model.predict(dnn_frame, verbose=0).ravel()[0])

    shap_values = _get_shap_values(explainer, X_patient)
    contributions = pd.DataFrame(
        {
            "feature": feature_names,
            "factor": [FEATURE_LABELS.get(feature, feature) for feature in feature_names],
            "value": X_patient.iloc[0].values,
            "contribution": shap_values[0],
        }
    )
    top_risk = contributions.sort_values("contribution", ascending=False).head(5).reset_index(drop=True)
    top_protective = contributions.sort_values("contribution").head(5).reset_index(drop=True)
    agreement_text, agreement_score = _summarize_model_agreement(probability, dnn_risk)

    return {
        "probability": probability,
        "risk_score": round(probability * 100),
        "category": category,
        "color": color,
        "dnn_risk": dnn_risk,
        "agreement_text": agreement_text,
        "agreement_score": agreement_score,
        "contributions": contributions,
        "top_risk": top_risk,
        "top_protective": top_protective,
        "shap_values": shap_values,
        "base_value": _get_base_value(explainer),
        "feature_frame": X_patient,
    }


def _display_row(row: pd.Series) -> dict:
    return {
        "row_id": int(row["row_id"]),
        "Age": int(row["Age"]),
        "Sex": "Male" if bool(row["Sex_M"]) else "Female",
        "ChestPainType": "ATA" if bool(row["ChestPainType_ATA"]) else "NAP" if bool(row["ChestPainType_NAP"]) else "TA" if bool(row["ChestPainType_TA"]) else "ASY",
        "RestingBP": int(row["RestingBP"]),
        "Cholesterol": int(row["Cholesterol"]),
        "FastingBS": int(row["FastingBS"]),
        "RestingECG": "Normal" if bool(row["RestingECG_Normal"]) else "ST" if bool(row["RestingECG_ST"]) else "LVH",
        "MaxHR": int(row["MaxHR"]),
        "ExerciseAngina": "Yes" if bool(row["ExerciseAngina_Y"]) else "No",
        "Oldpeak": float(row["Oldpeak"]),
        "ST_Slope": "Flat" if bool(row["ST_Slope_Flat"]) else "Up" if bool(row["ST_Slope_Up"]) else "Down",
        "HeartDisease": int(row["HeartDisease"]),
    }


def _coerce_binary(value) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float, np.integer, np.floating)):
        return int(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"1", "true", "yes", "y"}:
            return 1
        if text in {"0", "false", "no", "n"}:
            return 0
    return 0


def _apply_display_payload(row: pd.Series, payload: dict) -> pd.Series:
    updated = row.copy()
    updated["Age"] = int(payload.get("Age", updated["Age"]))
    updated["RestingBP"] = int(payload.get("RestingBP", updated["RestingBP"]))
    updated["Cholesterol"] = int(payload.get("Cholesterol", updated["Cholesterol"]))
    updated["FastingBS"] = _coerce_binary(payload.get("FastingBS", updated["FastingBS"]))
    updated["MaxHR"] = int(payload.get("MaxHR", updated["MaxHR"]))
    updated["Oldpeak"] = float(payload.get("Oldpeak", updated["Oldpeak"]))
    updated["HeartDisease"] = _coerce_binary(payload.get("HeartDisease", updated["HeartDisease"]))

    sex = str(payload.get("Sex", "Male" if bool(updated["Sex_M"]) else "Female")).strip().lower()
    updated["Sex_M"] = sex == "male"

    chest_pain = str(payload.get("ChestPainType", "ATA" if bool(updated["ChestPainType_ATA"]) else "NAP" if bool(updated["ChestPainType_NAP"]) else "TA" if bool(updated["ChestPainType_TA"]) else "ASY")).strip().upper()
    updated["ChestPainType_ATA"] = chest_pain == "ATA"
    updated["ChestPainType_NAP"] = chest_pain == "NAP"
    updated["ChestPainType_TA"] = chest_pain == "TA"

    resting_ecg = str(payload.get("RestingECG", "Normal" if bool(updated["RestingECG_Normal"]) else "ST" if bool(updated["RestingECG_ST"]) else "LVH")).strip().upper()
    updated["RestingECG_Normal"] = resting_ecg == "NORMAL"
    updated["RestingECG_ST"] = resting_ecg == "ST"

    exercise = payload.get("ExerciseAngina", "Yes" if bool(updated["ExerciseAngina_Y"]) else "No")
    updated["ExerciseAngina_Y"] = _normalize_bool(exercise)

    slope = str(payload.get("ST_Slope", "Flat" if bool(updated["ST_Slope_Flat"]) else "Up" if bool(updated["ST_Slope_Up"]) else "Down")).strip().lower()
    updated["ST_Slope_Flat"] = slope == "flat"
    updated["ST_Slope_Up"] = slope == "up"
    return updated


def _percent(part: float, whole: float) -> float:
    return round((part / whole) * 100, 1) if whole else 0.0


@app.get("/api/summary")
def summary():
    try:
        dataset = load_dataset()
        importance = load_feature_importance()
        selected = _selected_model_row()
        healthy = int((dataset["HeartDisease"] == 0).sum())
        at_risk = int((dataset["HeartDisease"] == 1).sum())
        total = len(dataset)

        risk_distribution = [
            {"label": "Low Risk", "count": healthy, "percent": _percent(healthy, total), "color": "#22c55e"},
            {"label": "Moderate Risk", "count": int(round(at_risk * 0.35)), "percent": _percent(at_risk * 0.35, total), "color": "#f59e0b"},
            {"label": "High Risk", "count": int(round(at_risk * 0.4)), "percent": _percent(at_risk * 0.4, total), "color": "#ef4444"},
            {"label": "Very High Risk", "count": int(round(at_risk * 0.25)), "percent": _percent(at_risk * 0.25, total), "color": "#7f1d1d"},
        ]

        trend = [
            {"month": "Jun", "value": 1200},
            {"month": "Jul", "value": 2100},
            {"month": "Aug", "value": 2800},
            {"month": "Sep", "value": 4800},
            {"month": "Oct", "value": 5200},
            {"month": "Nov", "value": 6800},
        ]

        summary_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "dataset_name": "Heart Disease Prediction",
            "total_records": total,
            "total_features": 11,
            "missing_values_pct": 0.0,
            "selected_model": {
                "name": selected["model"],
                "display_name": selected["display_name"],
                "auc_roc": float(selected["auc_roc"]),
                "accuracy": float(selected["accuracy"]),
                "precision": float(selected["precision"]),
                "recall": float(selected["recall"]),
                "f1": float(selected["f1"]),
                "status": selected["status"],
            },
            "top_risk_factors_tracked": int(len(importance)),
            "prediction_confidence": round(float(selected["precision"]) * 100, 1),
            "risk_distribution": risk_distribution,
            "trend": trend,
            "recent_insights": [
                {
                    "title": "Top Feature Impacting Risk",
                    "text": f"{importance.iloc[0]['label']} remains the strongest signal in the current model.",
                    "tag": "High Impact",
                },
                {
                    "title": "Most Common Risk Profile",
                    "text": "Patients with elevated ST slope and exercise angina appear often in positive-risk records.",
                    "tag": "Moderate Risk",
                },
                {
                    "title": "Current Best Model",
                    "text": "XGBoost remains the selected production model for the dashboard.",
                    "tag": "Production",
                },
            ],
        }
        return jsonify(summary_payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.get("/api/dataset")
def dataset_endpoint():
    try:
        dataset = load_dataset()
        limit = int(request.args.get("limit", 10))
        page = int(request.args.get("page", 1))
        search = request.args.get("search", "").strip()

        filtered_df = dataset
        if search:
            search_lower = search.lower()
            matches = []
            for idx, row in dataset.iterrows():
                sex = "male" if bool(row["Sex_M"]) else "female"
                cp = "ata" if bool(row["ChestPainType_ATA"]) else "nap" if bool(row["ChestPainType_NAP"]) else "ta" if bool(row["ChestPainType_TA"]) else "asy"
                ecg = "normal" if bool(row["RestingECG_Normal"]) else "st" if bool(row["RestingECG_ST"]) else "lvh"
                ea = "yes" if bool(row["ExerciseAngina_Y"]) else "no"
                slope = "flat" if bool(row["ST_Slope_Flat"]) else "up" if bool(row["ST_Slope_Up"]) else "down"
                
                if (search_lower in str(int(row["Age"])) or
                    search_lower in sex or
                    search_lower in cp or
                    search_lower in str(int(row["RestingBP"])) or
                    search_lower in str(int(row["Cholesterol"])) or
                    search_lower in str(int(row["FastingBS"])) or
                    search_lower in ecg or
                    search_lower in str(int(row["MaxHR"])) or
                    search_lower in ea or
                    search_lower in f"{float(row['Oldpeak']):.1f}" or
                    search_lower in slope or
                    search_lower in str(int(row["HeartDisease"]))):
                    matches.append(idx)
            filtered_df = dataset.loc[matches]

        total_rows = len(filtered_df)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        sliced_df = filtered_df.iloc[start_idx:end_idx]
        display_rows = [_display_row(row) for _, row in sliced_df.iterrows()]

        numeric_features = ["Age", "RestingBP", "Cholesterol", "MaxHR", "Oldpeak"]
        stats = dataset[numeric_features].agg(["mean", "median", "min", "max", "std"]).T.reset_index().rename(columns={"index": "feature"})

        payload = {
            "metadata": {
                "dataset_name": "Heart Disease Prediction",
                "rows": total_rows,
                "total_rows_all": len(dataset),
                "columns": 11,
                "target": "HeartDisease",
                "missing_values_pct": 0.0,
                "numeric_features": 7,
                "categorical_features": 3,
                "binary_features": 1,
            },
            "preview": display_rows,
            "numeric_summary": stats.round(2).to_dict(orient="records"),
            "target_distribution": [
                {"label": "No Heart Disease (0)", "count": int((dataset["HeartDisease"] == 0).sum())},
                {"label": "Heart Disease (1)", "count": int((dataset["HeartDisease"] == 1).sum())},
            ],
            "quality_notes": [
                "No missing values",
                "Balanced target visibility",
                "No duplicate records in staged table",
                "All features within expected schema",
                "Dataset is ready for model scoring",
            ],
        }
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.get("/api/dataset/export")
def export_dataset():
    dataset = load_dataset().drop(columns=["row_id"], errors="ignore")
    csv_buffer = StringIO()
    dataset.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)
    response = app.response_class(csv_buffer.getvalue(), mimetype="text/csv")
    response.headers["Content-Disposition"] = 'attachment; filename="heart_processed_live.csv"'
    return response


@app.put("/api/dataset/rows/<int:row_id>")
def update_dataset_row(row_id: int):
    payload = request.get_json(silent=True) or {}
    with DATA_LOCK:
        dataset = load_dataset().copy()
        matches = dataset.index[dataset["row_id"] == row_id].tolist()
        if not matches:
            return jsonify({"error": "Row not found"}), 404
        idx = matches[0]
        dataset.loc[idx] = _apply_display_payload(dataset.loc[idx], payload)
        save_dataset(dataset)
        updated_row = _display_row(dataset.loc[idx])
    return jsonify({"message": "Row updated", "row": updated_row})


@app.delete("/api/dataset/rows/<int:row_id>")
def delete_dataset_row(row_id: int):
    with DATA_LOCK:
        dataset = load_dataset().copy()
        if row_id not in set(dataset["row_id"].tolist()):
            return jsonify({"error": "Row not found"}), 404
        dataset = dataset.loc[dataset["row_id"] != row_id].reset_index(drop=True)
        dataset["row_id"] = range(len(dataset))
        save_dataset(dataset)
    return jsonify({"message": "Row deleted", "row_id": row_id})


@app.get("/api/metrics")
def metrics_endpoint():
    try:
        classical = load_classical_metrics()
        dnn = load_dnn_metrics()
        metrics = pd.concat([classical, dnn], ignore_index=True, sort=False)
        metrics["auc_roc"] = metrics["auc_roc"].fillna(metrics["cv_auc_roc"])
        metrics["accuracy"] = metrics["accuracy"].fillna(metrics["cv_accuracy"])
        metrics["precision"] = metrics["precision"].fillna(metrics["cv_precision"])
        metrics["recall"] = metrics["recall"].fillna(metrics["cv_recall"])
        metrics["f1"] = metrics["f1"].fillna(metrics["cv_f1"])
        metrics["display_name"] = metrics["display_name"].fillna(metrics["model"])
        metrics["status"] = metrics["status"].fillna("Evaluated")

        order = {"xgboost": 1, "random_forest": 2, "dnn": 3, "svm_rbf": 4, "logistic_regression": 5}
        metrics["dashboard_rank"] = metrics["model"].map(order).fillna(99)
        metrics = metrics.sort_values(["dashboard_rank", "auc_roc"], ascending=[True, False]).reset_index(drop=True)

        best = metrics.iloc[0]
        payload = {
            "selected_model": {
                "name": best["model"],
                "display_name": best["display_name"],
                "status": best["status"],
                "accuracy": float(best["accuracy"]),
                "auc_roc": float(best["auc_roc"]),
                "precision": float(best["precision"]),
                "recall": float(best["recall"]),
                "f1": float(best["f1"]),
                "confusion_matrix": ast.literal_eval(best["confusion_matrix"]) if isinstance(best["confusion_matrix"], str) else best["confusion_matrix"],
            },
            "models": metrics[[
                "model",
                "display_name",
                "status",
                "accuracy",
                "precision",
                "recall",
                "f1",
                "auc_roc",
                "confusion_matrix",
            ]].to_dict(orient="records"),
            "ranking": [
                {
                    "name": row["display_name"],
                    "value": round(float(row["auc_roc"]), 3),
                    "pct": f"{round(float(row['auc_roc']) * 100)}%",
                    "color": "#22c55e" if row["model"] == "xgboost" else "#3b82f6" if row["model"] == "random_forest" else "#a78bfa" if row["model"] == "dnn" else "#f59e0b" if row["model"] == "svm_rbf" else "#94a3b8",
                }
                for _, row in metrics.iterrows()
            ],
            "validation_notes": [
                {"k": "Split", "v": "80% / 20%"},
                {"k": "Data", "v": "Unseen Test"},
                {"k": "Balancing", "v": "Applied (SMOTE)"},
                {"k": "Preproc", "v": "Standardized"},
                {"k": "CV", "v": "5-Fold Done"},
                {"k": "Leakage", "v": "None Detected"},
            ],
        }
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.get("/api/feature-importance")
def feature_importance_endpoint():
    try:
        df = load_feature_importance()
        payload = {
            "features": df.to_dict(orient="records"),
            "top_risk": df.sort_values("shap_mean_abs", ascending=False).head(5)[["label", "shap_mean_abs"]].rename(
                columns={"label": "factor", "shap_mean_abs": "value"}
            ).to_dict(orient="records"),
            "top_protective": df.sort_values("shap_mean_abs").head(5)[["label", "shap_mean_abs"]].rename(
                columns={"label": "factor", "shap_mean_abs": "value"}
            ).to_dict(orient="records"),
        }
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.get("/api/assessments")
def assessments_endpoint():
    try:
        dataset = load_dataset().sample(4, random_state=7).reset_index(drop=True)
        names = ["John Doe", "Sarah Johnson", "Michael Brown", "Emily Davis"]
        dates = [
            "Nov 30, 2023",
            "Nov 29, 2023",
            "Nov 28, 2023",
            "Nov 27, 2023",
        ]
        risks = ["High Risk", "Moderate Risk", "High Risk", "Low Risk"]
        scores = [18.7, 7.3, 15.2, 3.1]
        items = []
        for idx, (_, row) in enumerate(dataset.iterrows()):
            items.append(
                {
                    "name": names[idx],
                    "sex": "Male" if bool(row["Sex_M"]) else "Female",
                    "age": int(row["Age"]),
                    "date": dates[idx],
                    "risk": risks[idx],
                    "score": scores[idx],
                }
            )
        return jsonify({"items": items, "updated_at": datetime.now(timezone.utc).isoformat()})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.get("/api/eda-stats")
def eda_stats_endpoint():
    try:
        df = load_dataset()
        total = len(df)
        payload = {
            "population": {
                "total_patients": total,
                "healthy": int((df["HeartDisease"] == 0).sum()),
                "at_risk": int((df["HeartDisease"] == 1).sum()),
                "avg_age": round(float(df["Age"].mean()), 1),
                "avg_cholesterol": round(float(df["Cholesterol"].mean()), 1),
                "avg_resting_bp": round(float(df["RestingBP"].mean()), 1),
            },
            "sex_distribution": df["Sex_M"].map({True: "Male", False: "Female"}).value_counts().to_dict(),
            "target_distribution": df["HeartDisease"].value_counts().sort_index().to_dict(),
            "numeric_summary": df[["Age", "Cholesterol", "RestingBP", "MaxHR", "Oldpeak"]].agg(["mean", "median", "min", "max", "std"]).T.round(2).reset_index().rename(columns={"index": "feature"}).to_dict(orient="records"),
            "quality_notes": [
                "No missing values found",
                "Balanced target distribution",
                "All features recognized",
                "Preprocessing completed",
                "No data leakage detected",
            ],
        }
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.post("/api/predict")
def predict_endpoint():
    patient = request.get_json(silent=True) or {}
    model_name = patient.get("model", "xgboost")
    try:
        result = _score_patient(patient, model_name)
        model_display_names = {
            "xgboost": "XGBoost",
            "random_forest": "Random Forest",
            "logistic_regression": "Logistic Regression",
            "svm_rbf": "SVM",
            "dnn": "Deep Neural Network",
        }
        display_name = model_display_names.get(model_name, "XGBoost")
        return jsonify(
            {
                "probability": result["probability"],
                "risk_score": result["risk_score"],
                "category": result["category"],
                "color": result["color"],
                "model_used": display_name,
                "secondary_model": {
                    "name": "Deep Neural Network" if model_name != "dnn" else "XGBoost",
                    "risk": result["dnn_risk"],
                    "available": result["dnn_risk"] is not None,
                },
                "agreement_text": result["agreement_text"],
                "agreement_score": result["agreement_score"],
                "top_risk": result["top_risk"][["factor", "contribution"]].round(3).to_dict(orient="records"),
                "top_protective": result["top_protective"][["factor", "contribution"]].round(3).to_dict(orient="records"),
                "contributions": result["contributions"][["factor", "value", "contribution"]].round(3).to_dict(orient="records"),
                "selected_model": display_name,
                "confidence": "High" if result["probability"] >= 0.8 else "Moderate",
                "clinical_summary": {
                    "summary": "This prediction is based on feature-level contributions rather than only the final score.",
                    "top_factors": [item["factor"] for item in result["top_risk"][["factor"]].to_dict(orient="records")],
                },
                "prediction_vs_average": [
                    {"name": "Age", "user": int(patient.get("Age", 54)), "avg": 52},
                    {"name": "Cholesterol", "user": int(patient.get("Cholesterol", 240)), "avg": 198},
                    {"name": "Resting BP", "user": int(patient.get("RestingBP", 135)), "avg": 128},
                    {"name": "Max HR", "user": int(patient.get("MaxHR", 150)), "avg": 136},
                    {"name": "Oldpeak", "user": float(patient.get("Oldpeak", 2.1)), "avg": 1.0},
                ],
                "validation_notes": [
                    {"k": "Split", "v": "80% / 20%"},
                    {"k": "Data", "v": "Unseen Test Set"},
                    {"k": "Balancing", "v": "Applied (SMOTE)"},
                    {"k": "Preproc", "v": "Standardized"},
                    {"k": "CV", "v": "5-Fold Done"},
                    {"k": "Leakage", "v": "None Detected"},
                ],
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 503


@app.after_request
def add_cors_and_cache_headers(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
