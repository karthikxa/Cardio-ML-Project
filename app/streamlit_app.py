from __future__ import annotations

import sys
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import streamlit as st


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


MODEL_PATH = PROJECT_ROOT / "models" / "saved" / "xgboost.pkl"
EXPLAINER_PATH = PROJECT_ROOT / "models" / "saved" / "xgboost_shap_explainer.pkl"
DNN_MODEL_PATH = PROJECT_ROOT / "models" / "saved" / "dnn.keras"
DNN_PREPROCESSOR_PATH = PROJECT_ROOT / "models" / "saved" / "dnn_preprocessor.pkl"


FEATURE_LABELS = {
    "Age": "Age",
    "RestingBP": "Resting blood pressure",
    "Cholesterol": "Cholesterol",
    "FastingBS": "Fasting blood sugar > 120",
    "MaxHR": "Maximum heart rate",
    "Oldpeak": "ST depression",
    "Sex_M": "Male sex",
    "ChestPainType_ATA": "Atypical angina",
    "ChestPainType_NAP": "Non-anginal chest pain",
    "ChestPainType_TA": "Typical angina",
    "RestingECG_Normal": "Normal resting ECG",
    "RestingECG_ST": "ST-T ECG abnormality",
    "ExerciseAngina_Y": "Exercise-induced angina",
    "ST_Slope_Flat": "Flat ST slope",
    "ST_Slope_Up": "Upsloping ST segment",
}


RISK_BANDS = {
    "Low Risk": {
        "range": "0-29%",
        "summary": "The model found fewer patterns associated with heart disease in this input profile.",
        "next_step": "Maintain routine preventive care and healthy lifestyle habits.",
    },
    "Moderate Risk": {
        "range": "30-60%",
        "summary": "The model found a mixed profile with several signals that may deserve follow-up.",
        "next_step": "Consider reviewing blood pressure, cholesterol, exercise symptoms, and ECG history with a clinician.",
    },
    "High Risk": {
        "range": "61-100%",
        "summary": "The model found multiple patterns associated with higher heart disease likelihood.",
        "next_step": "Prompt clinical review is recommended, especially if symptoms such as chest pain or shortness of breath are present.",
    },
}


@st.cache_resource
def load_model_artifact() -> dict:
    return joblib.load(MODEL_PATH)


@st.cache_resource
def load_dnn_artifacts():
    if not DNN_MODEL_PATH.exists() or not DNN_PREPROCESSOR_PATH.exists():
        return None

    try:
        import tensorflow as tf
    except ModuleNotFoundError:
        return None

    return {
        "model": tf.keras.models.load_model(DNN_MODEL_PATH),
        **joblib.load(DNN_PREPROCESSOR_PATH),
    }


@st.cache_resource
def load_explainer(_model):
    if EXPLAINER_PATH.exists():
        return joblib.load(EXPLAINER_PATH)
    return shap.TreeExplainer(_model)


def patient_inputs() -> dict[str, object]:
    st.sidebar.header("Patient Vitals")
    age = st.sidebar.slider("Age", 20, 80, 52)
    sex = st.sidebar.radio("Sex", ["Male", "Female"], horizontal=True)
    chest_pain = st.sidebar.selectbox(
        "Chest Pain Type",
        ["Typical angina", "Atypical angina", "Non-anginal", "Asymptomatic"],
        index=3,
    )
    resting_bp = st.sidebar.slider("Resting BP (mmHg)", 90, 200, 130)
    cholesterol = st.sidebar.slider("Cholesterol (mg/dl)", 100, 600, 240)
    fasting_bs = st.sidebar.checkbox("Fasting Blood Sugar > 120")
    resting_ecg = st.sidebar.selectbox(
        "Resting ECG",
        ["Normal", "ST-T abnormality", "LV hypertrophy"],
    )
    max_hr = st.sidebar.slider("Max Heart Rate", 60, 220, 150)
    exercise_angina = st.sidebar.checkbox("Exercise Induced Angina")
    oldpeak = st.sidebar.slider("ST Depression", 0.0, 6.2, 1.0, 0.1)
    slope = st.sidebar.selectbox("Slope of ST Segment", ["Upsloping", "Flat", "Downsloping"])
    vessels = st.sidebar.slider("Number of Major Vessels", 0, 3, 0)
    thal = st.sidebar.selectbox("Thal", ["Normal", "Fixed defect", "Reversible defect"])

    return {
        "Age": age,
        "Sex": sex,
        "ChestPainType": chest_pain,
        "RestingBP": resting_bp,
        "Cholesterol": cholesterol,
        "FastingBS": int(fasting_bs),
        "RestingECG": resting_ecg,
        "MaxHR": max_hr,
        "ExerciseAngina": exercise_angina,
        "Oldpeak": oldpeak,
        "ST_Slope": slope,
        "NumberOfMajorVessels": vessels,
        "Thal": thal,
    }


def build_patient_frame(inputs: dict[str, object]) -> pd.DataFrame:
    """Build one raw patient row in the same schema used for model training."""
    return pd.DataFrame([{
        "Age": inputs["Age"],
        "RestingBP": inputs["RestingBP"],
        "Cholesterol": inputs["Cholesterol"],
        "FastingBS": inputs["FastingBS"],
        "MaxHR": inputs["MaxHR"],
        "Oldpeak": inputs["Oldpeak"],
        "Sex": inputs["Sex"],
        "Sex_M": inputs["Sex"] == "Male",
        "ChestPainType": inputs["ChestPainType"],
        "ChestPainType_ATA": inputs["ChestPainType"] == "Atypical angina",
        "ChestPainType_NAP": inputs["ChestPainType"] == "Non-anginal",
        "ChestPainType_TA": inputs["ChestPainType"] == "Typical angina",
        "RestingECG": inputs["RestingECG"],
        "RestingECG_Normal": inputs["RestingECG"] == "Normal",
        "RestingECG_ST": inputs["RestingECG"] == "ST-T abnormality",
        "ExerciseAngina": "Y" if inputs["ExerciseAngina"] else "N",
        "ExerciseAngina_Y": inputs["ExerciseAngina"],
        "ST_Slope": inputs["ST_Slope"],
        "ST_Slope_Flat": inputs["ST_Slope"] == "Flat",
        "ST_Slope_Up": inputs["ST_Slope"] == "Upsloping",
    }])


def transform_patient(
    inputs: dict[str, object],
    preprocessor,
    feature_names: list[str],
) -> pd.DataFrame:
    raw = build_patient_frame(inputs)
    expected_raw_features = list(getattr(preprocessor, "feature_names_in_", raw.columns))
    raw = raw.reindex(columns=expected_raw_features)
    transformed = preprocessor.transform(raw)
    return pd.DataFrame(transformed, columns=feature_names)


def risk_category(risk: float) -> tuple[str, str]:
    if risk < 0.30:
        return "Low Risk", "#2ca25f"
    if risk <= 0.60:
        return "Moderate Risk", "#d9a400"
    return "High Risk", "#d7301f"


def format_percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def summarize_model_agreement(primary_risk: float, dnn_risk: float | None) -> str:
    if dnn_risk is None:
        return "DNN comparison unavailable in this runtime."

    delta = abs(primary_risk - dnn_risk)
    if delta < 0.10:
        return "High agreement between XGBoost and DNN estimates."
    if delta < 0.25:
        return "Moderate agreement between XGBoost and DNN estimates."
    return "Low agreement; prediction should be interpreted cautiously."


def build_report_text(
    inputs: dict[str, object],
    primary_risk: float,
    category: str,
    dnn_risk: float | None,
    risk_drivers: pd.DataFrame,
    protective_factors: pd.DataFrame,
) -> str:
    band = RISK_BANDS[category]
    dnn_line = "Not available"
    if dnn_risk is not None:
        dnn_category, _ = risk_category(dnn_risk)
        dnn_line = f"{format_percent(dnn_risk)} ({dnn_category})"

    driver_lines = [
        f"- {row.factor}: {row.contribution:+.3f}"
        for row in risk_drivers.itertuples(index=False)
    ]
    protective_lines = [
        f"- {row.factor}: {row.contribution:+.3f}"
        for row in protective_factors.itertuples(index=False)
    ]

    return "\n".join(
        [
            "AI Cardiovascular Screening Report",
            "",
            "Patient Snapshot",
            f"- Age: {inputs['Age']}",
            f"- Sex: {inputs['Sex']}",
            f"- Chest pain type: {inputs['ChestPainType']}",
            f"- Resting blood pressure: {inputs['RestingBP']} mmHg",
            f"- Cholesterol: {inputs['Cholesterol']} mg/dl",
            f"- Maximum heart rate: {inputs['MaxHR']}",
            f"- Exercise-induced angina: {'Yes' if inputs['ExerciseAngina'] else 'No'}",
            f"- ST depression: {inputs['Oldpeak']}",
            f"- ST slope: {inputs['ST_Slope']}",
            "",
            "Model Assessment",
            f"- Primary model: XGBoost with SHAP explanation",
            f"- Predicted risk: {format_percent(primary_risk)}",
            f"- Risk category: {category} ({band['range']})",
            f"- DNN comparison: {dnn_line}",
            f"- Agreement note: {summarize_model_agreement(primary_risk, dnn_risk)}",
            "",
            "Clinical-Style Interpretation",
            f"- {band['summary']}",
            f"- Suggested next step: {band['next_step']}",
            "",
            "Top Risk-Increasing Factors",
            *(driver_lines or ["- None identified"]),
            "",
            "Top Risk-Lowering Factors",
            *(protective_lines or ["- None identified"]),
            "",
            "Safety Notice",
            "This is an educational AI screening report for a hackathon project. It is not a diagnosis, medical device, or substitute for professional care.",
        ]
    )


def plot_gauge(risk: float, color: str):
    fig, ax = plt.subplots(figsize=(6, 3), subplot_kw={"projection": "polar"})
    ax.set_theta_offset(np.pi)
    ax.set_theta_direction(-1)
    ax.set_ylim(0, 1)
    ax.set_axis_off()

    theta = np.linspace(0, np.pi, 200)
    ax.plot(theta, np.ones_like(theta) * 0.8, color="#e6e6e6", linewidth=20, solid_capstyle="round")
    ax.plot(theta[: max(2, int(risk * len(theta)))], np.ones(max(2, int(risk * len(theta)))) * 0.8, color=color, linewidth=20, solid_capstyle="round")
    ax.text(np.pi / 2, 0.35, f"{risk * 100:.1f}%", ha="center", va="center", fontsize=30, fontweight="bold")
    ax.text(np.pi / 2, 0.1, "Predicted risk", ha="center", va="center", fontsize=11)
    return fig


def get_base_value(explainer) -> float:
    base_value = explainer.expected_value
    if isinstance(base_value, (list, np.ndarray)):
        return float(base_value[1])
    return float(base_value)


def get_shap_values(explainer, X: pd.DataFrame) -> np.ndarray:
    shap_values = explainer.shap_values(X)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    return np.asarray(shap_values)


def render_prediction(inputs: dict[str, object]) -> None:
    artifact = load_model_artifact()
    dnn_artifact = load_dnn_artifacts()
    model = artifact["model"]
    preprocessor = artifact["preprocessor"]
    feature_names = artifact["feature_names"]
    explainer = load_explainer(model)

    X_patient = transform_patient(inputs, preprocessor, feature_names)
    risk = float(model.predict_proba(X_patient)[0, 1])
    category, color = risk_category(risk)
    dnn_risk = None
    if dnn_artifact is not None:
        X_dnn = transform_patient(inputs, dnn_artifact["preprocessor"], dnn_artifact["feature_names"])
        dnn_risk = float(dnn_artifact["model"].predict(X_dnn, verbose=0).ravel()[0])

    shap_values = get_shap_values(explainer, X_patient)
    base_value = get_base_value(explainer)
    contributions = pd.DataFrame(
        {
            "factor": [FEATURE_LABELS.get(feature, feature) for feature in feature_names],
            "value": X_patient.iloc[0].values,
            "contribution": shap_values[0],
        }
    )
    top_risk = contributions.sort_values("contribution", ascending=False).head(5)
    top_protective = contributions.sort_values("contribution", ascending=True).head(5)
    report_text = build_report_text(inputs, risk, category, dnn_risk, top_risk, top_protective)

    st.caption("Hack4Health Byte2Beat submission demo: early CVD risk screening with explainable AI.")
    st.info("Educational screening only. This output is not a diagnosis and should not be used for emergency decisions.")

    left, middle, right = st.columns([1.1, 1, 1])
    with left:
        st.pyplot(plot_gauge(risk, color), clear_figure=True)
    with middle:
        st.markdown(f"<h2 style='color:{color}; margin-bottom:0'>{category}</h2>", unsafe_allow_html=True)
        st.metric("Risk Score", f"{risk * 100:.1f}%")
        st.caption(f"Risk band: {RISK_BANDS[category]['range']}")
    with right:
        if dnn_risk is None:
            st.metric("DNN Check", "Unavailable")
        else:
            dnn_category, _ = risk_category(dnn_risk)
            st.metric("DNN Check", format_percent(dnn_risk), dnn_category)
        st.caption(summarize_model_agreement(risk, dnn_risk))

    st.subheader("AI Cardiovascular Screening Report")
    st.markdown(f"**Clinical-style summary:** {RISK_BANDS[category]['summary']}")
    st.markdown(f"**Suggested follow-up:** {RISK_BANDS[category]['next_step']}")

    vitals = pd.DataFrame(
        [
            ("Age", inputs["Age"]),
            ("Sex", inputs["Sex"]),
            ("Chest pain type", inputs["ChestPainType"]),
            ("Resting blood pressure", f"{inputs['RestingBP']} mmHg"),
            ("Cholesterol", f"{inputs['Cholesterol']} mg/dl"),
            ("Fasting blood sugar > 120", "Yes" if inputs["FastingBS"] else "No"),
            ("Resting ECG", inputs["RestingECG"]),
            ("Maximum heart rate", inputs["MaxHR"]),
            ("Exercise-induced angina", "Yes" if inputs["ExerciseAngina"] else "No"),
            ("ST depression", inputs["Oldpeak"]),
            ("ST slope", inputs["ST_Slope"]),
        ],
        columns=["Input", "Value"],
    )
    st.dataframe(vitals, hide_index=True, use_container_width=True)

    st.subheader("SHAP Patient Explanation")
    explanation = shap.Explanation(
        values=shap_values[0],
        base_values=base_value,
        data=X_patient.iloc[0].values,
        feature_names=[FEATURE_LABELS.get(feature, feature) for feature in feature_names],
    )
    shap.plots.waterfall(explanation, max_display=10, show=False)
    st.pyplot(plt.gcf(), clear_figure=True)

    risk_col, protective_col = st.columns(2)
    with risk_col:
        st.subheader("Top Risk-Increasing Factors")
        st.dataframe(
            top_risk[["factor", "contribution"]].rename(
                columns={"factor": "Factor", "contribution": "SHAP impact"}
            ),
            hide_index=True,
            use_container_width=True,
        )
    with protective_col:
        st.subheader("Top Risk-Lowering Factors")
        st.dataframe(
            top_protective[["factor", "contribution"]].rename(
                columns={"factor": "Factor", "contribution": "SHAP impact"}
            ),
            hide_index=True,
            use_container_width=True,
        )

    st.download_button(
        "Download Screening Report",
        data=report_text,
        file_name="ai_cvd_screening_report.txt",
        mime="text/plain",
    )


def main() -> None:
    st.set_page_config(page_title="CVD Risk Predictor", page_icon="heart", layout="wide")
    st.title("Explainable Cardiovascular Screening Report")
    st.caption("Machine learning triage support for early CVD risk awareness and interpretable risk-factor review.")

    inputs = patient_inputs()
    if st.sidebar.button("Predict", type="primary"):
        render_prediction(inputs)
    else:
        st.info("Set patient vitals in the sidebar, then select Predict.")


if __name__ == "__main__":
    main()
