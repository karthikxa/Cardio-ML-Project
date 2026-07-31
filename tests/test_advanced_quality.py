from __future__ import annotations

import ast
import json
import sys
import unittest
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "app"))

from preprocess import DATASETS, load_dataset, split_preprocess_smote  # noqa: E402
from streamlit_app import build_report_text, get_shap_values, load_explainer, risk_category, transform_patient  # noqa: E402


def _load_model_artifact(model_name: str) -> dict:
    return joblib.load(PROJECT_ROOT / "models" / "saved" / f"{model_name}.pkl")


def _sample_patient_inputs() -> dict[str, object]:
    return {
        "Age": 58,
        "Sex": "Male",
        "ChestPainType": "Asymptomatic",
        "RestingBP": 145,
        "Cholesterol": 265,
        "FastingBS": 1,
        "RestingECG": "ST-T abnormality",
        "MaxHR": 118,
        "ExerciseAngina": True,
        "Oldpeak": 2.2,
        "ST_Slope": "Flat",
        "NumberOfMajorVessels": 0,
        "Thal": "Normal",
    }


class AdvancedQualityTests(unittest.TestCase):
    def test_all_staged_datasets_load_with_binary_targets(self) -> None:
        for dataset_name, config in DATASETS.items():
            with self.subTest(dataset=dataset_name):
                df = load_dataset(dataset_name)

                self.assertFalse(df.empty, f"{dataset_name} should not be empty")
                self.assertIn(config["target"], df.columns)
                self.assertEqual(int(df[config["target"]].isna().sum()), 0)
                self.assertEqual(set((pd.to_numeric(df[config["target"]]) > 0).astype(int).unique()), {0, 1})

    def test_preprocessing_is_finite_balanced_and_feature_named(self) -> None:
        processed = split_preprocess_smote("heart", random_state=42, use_smote=True)

        self.assertEqual(processed.X_train.shape[1], processed.X_test.shape[1])
        self.assertEqual(processed.X_train.shape[1], len(processed.feature_names))
        self.assertTrue(np.isfinite(processed.X_train).all())
        self.assertTrue(np.isfinite(processed.X_test).all())
        self.assertEqual(processed.y_test.nunique(), 2)

        class_counts = processed.y_train.value_counts().to_dict()
        self.assertEqual(len(class_counts), 2)
        self.assertEqual(class_counts[0], class_counts[1], "SMOTE should balance only the training set")

    def test_no_smote_leaks_into_test_size_or_distribution(self) -> None:
        no_smote = split_preprocess_smote("heart", random_state=42, use_smote=False)
        with_smote = split_preprocess_smote("heart", random_state=42, use_smote=True)

        self.assertEqual(no_smote.X_test.shape, with_smote.X_test.shape)
        self.assertTrue(no_smote.y_test.equals(with_smote.y_test))
        self.assertGreaterEqual(with_smote.X_train.shape[0], no_smote.X_train.shape[0])

    def test_saved_classical_artifacts_predict_valid_probabilities(self) -> None:
        processed = split_preprocess_smote("heart", random_state=42, use_smote=False)

        for model_name in ["logistic_regression", "random_forest", "xgboost", "svm_rbf"]:
            with self.subTest(model=model_name):
                artifact = _load_model_artifact(model_name)
                model = artifact["model"]
                feature_names = artifact["feature_names"]

                self.assertEqual(artifact["dataset"], "heart")
                self.assertEqual(len(feature_names), processed.X_test.shape[1])
                self.assertEqual(list(feature_names), processed.feature_names)

                scores = model.predict_proba(processed.X_test[:10])[:, 1]
                preds = model.predict(processed.X_test[:10])
                self.assertEqual(scores.shape, (10,))
                self.assertTrue(set(np.unique(preds)).issubset({0, 1}))
                self.assertTrue(np.all((scores >= 0) & (scores <= 1)))

    def test_streamlit_patient_transform_matches_saved_preprocessor_contract(self) -> None:
        artifact = _load_model_artifact("xgboost")
        X_patient = transform_patient(
            _sample_patient_inputs(),
            artifact["preprocessor"],
            artifact["feature_names"],
        )

        self.assertEqual(list(X_patient.columns), artifact["feature_names"])
        self.assertEqual(X_patient.shape, (1, len(artifact["feature_names"])))
        self.assertTrue(np.isfinite(X_patient.to_numpy()).all())

        risk = float(artifact["model"].predict_proba(X_patient)[0, 1])
        self.assertGreaterEqual(risk, 0.0)
        self.assertLessEqual(risk, 1.0)

    def test_streamlit_shap_explainer_returns_one_value_per_feature(self) -> None:
        artifact = _load_model_artifact("xgboost")
        X_patient = transform_patient(
            _sample_patient_inputs(),
            artifact["preprocessor"],
            artifact["feature_names"],
        )

        explainer = load_explainer(artifact["model"])
        shap_values = get_shap_values(explainer, X_patient)

        self.assertEqual(shap_values.shape, (1, len(artifact["feature_names"])))
        self.assertTrue(np.isfinite(shap_values).all())

    def test_medical_report_output_contains_required_clinical_sections(self) -> None:
        risk_drivers = pd.DataFrame(
            {
                "factor": ["Exercise-induced angina", "Cholesterol"],
                "contribution": [0.42, 0.31],
            }
        )
        protective = pd.DataFrame(
            {
                "factor": ["Maximum heart rate", "Upsloping ST segment"],
                "contribution": [-0.20, -0.12],
            }
        )
        report = build_report_text(
            _sample_patient_inputs(),
            primary_risk=0.82,
            category=risk_category(0.82)[0],
            dnn_risk=0.76,
            risk_drivers=risk_drivers,
            protective_factors=protective,
        )

        for section in [
            "AI Cardiovascular Screening Report",
            "Patient Snapshot",
            "Model Assessment",
            "Clinical-Style Interpretation",
            "Top Risk-Increasing Factors",
            "Top Risk-Lowering Factors",
            "Safety Notice",
        ]:
            self.assertIn(section, report)

        self.assertIn("82.0%", report)
        self.assertIn("High Risk", report)
        self.assertIn("not a diagnosis", report)

    def test_results_meet_submission_quality_thresholds(self) -> None:
        classical = pd.read_csv(PROJECT_ROOT / "results" / "classical_model_metrics.csv")
        dnn = pd.read_csv(PROJECT_ROOT / "results" / "dnn_metrics.csv")

        required = {"model", "accuracy", "precision", "recall", "f1", "auc_roc", "confusion_matrix"}
        self.assertTrue(required.issubset(classical.columns))
        self.assertTrue(required.issubset(dnn.columns))

        best_classical = classical.sort_values(["auc_roc", "f1"], ascending=False).iloc[0]
        self.assertGreaterEqual(best_classical["auc_roc"], 0.90)
        self.assertGreaterEqual(best_classical["f1"], 0.88)
        self.assertGreaterEqual(float(dnn.iloc[0]["auc_roc"]), 0.90)
        self.assertGreaterEqual(float(dnn.iloc[0]["f1"]), 0.88)

        for matrix_text in pd.concat([classical["confusion_matrix"], dnn["confusion_matrix"]]):
            matrix = ast.literal_eval(matrix_text)
            self.assertEqual(np.asarray(matrix).shape, (2, 2))

    def test_feature_importance_is_ranked_normalized_and_interpretable(self) -> None:
        importance = pd.read_csv(PROJECT_ROOT / "results" / "feature_importance.csv")
        required = {
            "feature",
            "shap_mean_abs",
            "rf_importance",
            "xgb_gain_importance",
            "shap_rank",
            "shap_importance_norm",
            "rf_importance_norm",
            "xgb_gain_importance_norm",
        }
        self.assertTrue(required.issubset(importance.columns))
        self.assertEqual(int(importance["shap_rank"].min()), 1)
        self.assertTrue(importance["shap_mean_abs"].ge(0).all())
        self.assertTrue(importance["shap_importance_norm"].between(0, 1).all())
        self.assertTrue(np.isclose(importance["shap_importance_norm"].sum(), 1.0))

        top_five = importance.sort_values("shap_rank").head(5)["feature"].tolist()
        self.assertIn("ST_Slope_Up", top_five)
        self.assertIn("Cholesterol", top_five)

    def test_kaggle_notebook_and_report_are_submission_ready(self) -> None:
        notebook = json.loads((PROJECT_ROOT / "kaggle_submission.ipynb").read_text(encoding="utf-8"))
        report = (PROJECT_ROOT / "report" / "report.md").read_text(encoding="utf-8")
        readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

        self.assertGreaterEqual(len(notebook["cells"]), 12)
        self.assertTrue(any("SHAP" in "".join(cell.get("source", [])) for cell in notebook["cells"]))
        self.assertTrue(any("Conclusion" in "".join(cell.get("source", [])) for cell in notebook["cells"]))

        for section in ["Abstract", "Introduction", "Methods", "Results", "Discussion", "Conclusion", "References"]:
            self.assertIn(f"## {section}", report)

        self.assertNotIn("cvd_kaggle_submission.zip", readme)
        self.assertIn("report/report.md", readme)


if __name__ == "__main__":
    unittest.main(verbosity=2)
