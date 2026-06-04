from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data" / "raw"


DATASETS = {
    "heart": {
        "path": DATA_DIR / "heart_processed.csv",
        "target": "HeartDisease",
        "sep": ",",
        "categorical": [
            "sex",
            "cp",
            "restecg",
            "slope",
            "thal",
            "Sex",
            "ChestPainType",
            "RestingECG",
            "ExerciseAngina",
            "ST_Slope",
        ],
        "drop": [],
    },
    "cardio": {
        "path": DATA_DIR / "cardio_base.csv",
        "target": "cardio",
        "sep": ";",
        "categorical": ["gender", "cholesterol", "gluc", "smoke", "alco", "active"],
        "drop": ["id"],
    },
    "cardio_processed": {
        "path": DATA_DIR / "cardiac_failure_processed.csv",
        "target": "cardio",
        "sep": ",",
        "categorical": ["gender", "cholesterol", "gluc", "smoke", "alco", "active"],
        "drop": ["id", "Unnamed: 0"],
    },
}


@dataclass
class PreprocessedData:
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: pd.Series
    y_test: pd.Series
    preprocessor: ColumnTransformer
    feature_names: list[str]
    raw_train: pd.DataFrame
    raw_test: pd.DataFrame


def load_dataset(name: str = "heart") -> pd.DataFrame:
    """Load one of the staged cardiovascular datasets."""
    if name not in DATASETS:
        valid = ", ".join(sorted(DATASETS))
        raise ValueError(f"Unknown dataset '{name}'. Choose one of: {valid}")

    config = DATASETS[name]
    df = pd.read_csv(config["path"], sep=config["sep"], na_values="?")
    unnamed = [col for col in df.columns if str(col).startswith("Unnamed")]
    if unnamed:
        df = df.drop(columns=unnamed)
    return df


def prepare_features(
    df: pd.DataFrame,
    target_col: str,
    drop_cols: Iterable[str] | None = None,
) -> tuple[pd.DataFrame, pd.Series]:
    """Return feature matrix and a binary target vector."""
    drop_cols = list(drop_cols or [])
    available_drops = [col for col in drop_cols if col in df.columns]

    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' is not present in the dataframe.")

    cleaned = df.replace("?", np.nan).drop(columns=available_drops)
    y = (pd.to_numeric(cleaned[target_col], errors="coerce") > 0).astype(int)
    X = cleaned.drop(columns=[target_col])

    for col in X.columns:
        if pd.api.types.is_bool_dtype(X[col]):
            X[col] = X[col].astype(int)

    return X, y


def infer_feature_types(
    X: pd.DataFrame,
    configured_categorical: Iterable[str] | None = None,
) -> tuple[list[str], list[str]]:
    """Infer numeric and categorical columns while honoring configured category names."""
    configured = set(configured_categorical or [])
    categorical = [
        col
        for col in X.columns
        if col in configured or X[col].dtype == "object" or str(X[col].dtype) == "category"
    ]
    numerical = [col for col in X.columns if col not in categorical]
    return numerical, categorical


def make_one_hot_encoder() -> OneHotEncoder:
    """Create a dense OneHotEncoder across scikit-learn versions."""
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def build_preprocessor(numerical: list[str], categorical: list[str]) -> ColumnTransformer:
    numeric_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", make_one_hot_encoder()),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipe, numerical),
            ("cat", categorical_pipe, categorical),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def split_preprocess_smote(
    dataset: str = "heart",
    test_size: float = 0.2,
    random_state: int = 42,
    use_smote: bool = True,
) -> PreprocessedData:
    """Create an 80/20 stratified split, transform features, and SMOTE the train set only."""
    config = DATASETS[dataset]
    df = load_dataset(dataset)
    X, y = prepare_features(df, target_col=config["target"], drop_cols=config["drop"])
    numerical, categorical = infer_feature_types(X, config["categorical"])

    raw_train, raw_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )

    preprocessor = build_preprocessor(numerical, categorical)
    X_train = preprocessor.fit_transform(raw_train)
    X_test = preprocessor.transform(raw_test)

    if use_smote:
        smote = SMOTE(random_state=random_state)
        X_train, y_train = smote.fit_resample(X_train, y_train)

    feature_names = preprocessor.get_feature_names_out().tolist()

    return PreprocessedData(
        X_train=X_train,
        X_test=X_test,
        y_train=pd.Series(y_train, name=config["target"]),
        y_test=y_test.reset_index(drop=True),
        preprocessor=preprocessor,
        feature_names=feature_names,
        raw_train=raw_train.reset_index(drop=True),
        raw_test=raw_test.reset_index(drop=True),
    )


if __name__ == "__main__":
    data = split_preprocess_smote("heart")
    print("Train shape:", data.X_train.shape)
    print("Test shape:", data.X_test.shape)
    print("Train target distribution:")
    print(data.y_train.value_counts().sort_index())
