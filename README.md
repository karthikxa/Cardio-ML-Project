# Explainable Cardiovascular Screening Report

An original Hack4Health Byte2Beat project that turns public cardiovascular data into an explainable AI screening report for early CVD risk awareness.

## Motivation

Cardiovascular disease remains one of the most complex and devastating health problems. This project makes the model output feel less like a raw classifier and more like an educational clinical-style report: it summarizes risk, compares model agreement, highlights risk-increasing and risk-lowering factors, and clearly separates AI screening from medical diagnosis.

This repository started from the public CVDPrediction codebase as a reference for model families, but the hackathon project uses public tabular and ECG datasets instead of the private EHR data from the paper.

## Datasets

The staged datasets are documented in `data/raw/DATA_SOURCES.md`.

| File | Target | Role |
| --- | --- | --- |
| `data/raw/heart_processed.csv` | `HeartDisease` | Primary Streamlit and model-comparison dataset |
| `data/raw/cardio_base.csv` | `cardio` | Larger cardio risk dataset for robustness experiments |
| `data/raw/cardiac_failure_processed.csv` | `cardio` | Processed cardio backup dataset |
| `data/raw/ecg_timeseries.csv` | Optional | Wide ECG timeseries data reserved for temporal modeling |

## Models

The current training pipeline uses `heart_processed.csv`, a stratified 80/20 split, median imputation, standard scaling, one-hot handling where needed, and SMOTE on the training set only.

| Model | Notes |
| --- | --- |
| Logistic Regression | Balanced baseline classifier |
| Random Forest | 200-tree ensemble |
| XGBoost | Gradient boosting model used for SHAP explanations |
| SVM RBF | Best held-out AUC in this run |
| Feedforward DNN | Keras model with dropout and early stopping |

## Key Results

Held-out test metrics from the current run:

| Rank | Model | Accuracy | Precision | Recall | F1 | AUC-ROC |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | SVM RBF | 0.902 | 0.889 | 0.941 | 0.914 | 0.945 |
| 2 | DNN | 0.902 | 0.912 | 0.912 | 0.912 | 0.936 |
| 3 | XGBoost | 0.880 | 0.900 | 0.882 | 0.891 | 0.935 |
| 4 | Random Forest | 0.886 | 0.893 | 0.902 | 0.898 | 0.932 |
| 5 | Logistic Regression | 0.891 | 0.880 | 0.931 | 0.905 | 0.926 |

Top SHAP-ranked risk factors from XGBoost are currently `ST_Slope_Up`, `Cholesterol`, `ChestPainType_NAP`, `ExerciseAngina_Y`, and `ST_Slope_Flat`. In the Streamlit demo, these are translated into a patient-facing AI screening report with vitals, risk band, DNN comparison, top risk drivers, protective factors, and a downloadable text summary.

## Run Locally

```bash
pip install -r requirements.txt
python models/train_classical.py --dataset heart
python models/train_dnn.py --dataset heart
python src/interpret.py --dataset heart
streamlit run app/streamlit_app.py
```

Then open `http://localhost:8501`.

## Quality Tests

Run the advanced submission tests with:

```bash
python -m unittest tests.test_advanced_quality -v
```

The suite checks staged data integrity, leakage-safe preprocessing, saved model artifact contracts, prediction probability bounds, Streamlit preprocessing parity, medical report output sections, metric thresholds, SHAP feature importance sanity, and notebook/report readiness.

## Notebook Order

1. `notebooks/eda.ipynb`
2. `models/train_classical.py`
3. `models/train_dnn.py`
4. `notebooks/model_comparison.ipynb`
5. `notebooks/shap_analysis.ipynb`
6. `src/interpret.py`
7. `app/streamlit_app.py`

The written project report is available at `report/report.md`.

## Project Structure

```text
CVD Kaggle/
|-- app/
|   `-- streamlit_app.py
|-- data/
|   `-- raw/
|       |-- DATA_SOURCES.md
|       |-- cardiac_failure_processed.csv
|       |-- cardio_base.csv
|       |-- ecg_timeseries.csv
|       `-- heart_processed.csv
|-- models/
|   |-- saved/
|   |-- train_classical.py
|   `-- train_dnn.py
|-- notebooks/
|   |-- eda.ipynb
|   |-- model_comparison.ipynb
|   `-- shap_analysis.ipynb
|-- report/
|   `-- report.md
|-- results/
|   |-- classical_model_metrics.csv
|   |-- dnn_metrics.csv
|   |-- dnn_training_curves.png
|   `-- feature_importance.csv
|-- src/
|   |-- interpret.py
|   `-- preprocess.py
|-- tests/
|   `-- test_advanced_quality.py
|-- kaggle_submission.ipynb
|-- requirements.txt
`-- README.md
```

## Streamlit Demo

The demo accepts patient vitals in the sidebar and returns a clinical-style educational screening report:

- A 0-100% risk score
- Low, moderate, or high risk category
- XGBoost primary prediction and DNN comparison when available
- Clinical-style summary and suggested follow-up
- Patient vitals table
- A SHAP waterfall plot for the individual prediction
- Top risk-increasing and risk-lowering factors
- Downloadable screening report
- Educational-use disclaimer

## Citation

Reference repository and model-family inspiration:

Zhao J, Feng Q, Wu P, Lupu R, Wilke RA, Wells QS, Denny JC, Wei W-Q. Learning from Longitudinal Electronic Health Record and Genetic Data to Improve Cardiovascular Event Prediction. Scientific Reports. 2019; 9(1):717. doi:10.1038/s41598-018-36745-x
