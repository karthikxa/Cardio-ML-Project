# Dataset Sources

This project uses the user-provided public cardiovascular datasets below instead of the private EHR data from the original reference repository.

| Local file | Source file | Intended use |
| --- | --- | --- |
| `data/raw/cardio_base.csv` | `C:\Users\Sruti Sivashankar\Downloads\Cardiac Failure-20260527T033006Z-3-001\Cardiac Failure\cardio_base.csv` | Primary cardio risk dataset with `cardio` target. |
| `data/raw/cardiac_failure_processed.csv` | `C:\Users\Sruti Sivashankar\Downloads\Cardiac Failure-20260527T033006Z-3-001\Cardiac Failure\cardiac_failure_processed.csv` | Processed cardio dataset backup/validation variant. |
| `data/raw/heart_processed.csv` | `C:\Users\Sruti Sivashankar\Downloads\Heart Attack-20260527T033017Z-3-001\Heart Attack\heart_processed.csv` | Heart disease tabular dataset with `HeartDisease` target. |
| `data/raw/ecg_timeseries.csv` | `C:\Users\Sruti Sivashankar\Downloads\ECG Timeseries-20260527T033015Z-3-001\ECG Timeseries\ecg_timeseries.csv` | Wide ECG timeseries dataset for optional temporal/deep learning experiments. |

For Phase 1 EDA, start with `heart_processed.csv` for the Streamlit-style patient vitals workflow and `cardio_base.csv` for larger-sample risk modeling.
