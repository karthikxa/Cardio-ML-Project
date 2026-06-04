from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from preprocess import DATASETS, split_preprocess_smote  # noqa: E402


MODELS_DIR = PROJECT_ROOT / "models" / "saved"
RESULTS_DIR = PROJECT_ROOT / "results"


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def build_dnn(input_dim: int, learning_rate: float = 0.001) -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(128, activation="relu"),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )
    return model


def evaluate_dnn(model: tf.keras.Model, X_test: np.ndarray, y_test: pd.Series) -> dict[str, object]:
    y_score = model.predict(X_test, verbose=0).ravel()
    y_pred = (y_score >= 0.5).astype(int)
    return {
        "model": "dnn",
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "auc_roc": roc_auc_score(y_test, y_score),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }


def plot_history(history: tf.keras.callbacks.History, output_path: Path) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    axes[0].plot(history.history["loss"], label="Train loss")
    axes[0].plot(history.history["val_loss"], label="Validation loss")
    axes[0].set_title("DNN Loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Binary crossentropy")
    axes[0].legend()

    axes[1].plot(history.history["accuracy"], label="Train accuracy")
    axes[1].plot(history.history["val_accuracy"], label="Validation accuracy")
    axes[1].set_title("DNN Accuracy")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy")
    axes[1].legend()

    plt.tight_layout()
    fig.savefig(output_path, dpi=160, bbox_inches="tight")
    plt.close(fig)


def train_dnn(
    dataset: str = "heart",
    epochs: int = 100,
    batch_size: int = 32,
    random_state: int = 42,
) -> dict[str, object]:
    set_seed(random_state)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    processed = split_preprocess_smote(dataset=dataset, random_state=random_state)
    model = build_dnn(input_dim=processed.X_train.shape[1])
    early_stopping = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=10,
        restore_best_weights=True,
    )

    history = model.fit(
        processed.X_train,
        processed.y_train,
        validation_split=0.2,
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[early_stopping],
        verbose=1,
    )

    metrics = evaluate_dnn(model, processed.X_test, processed.y_test)
    metrics["epochs_trained"] = len(history.history["loss"])
    metrics["dataset"] = dataset

    model.save(MODELS_DIR / "dnn.keras")
    joblib.dump(
        {
            "preprocessor": processed.preprocessor,
            "feature_names": processed.feature_names,
            "dataset": dataset,
            "target": DATASETS[dataset]["target"],
        },
        MODELS_DIR / "dnn_preprocessor.pkl",
    )

    plot_history(history, RESULTS_DIR / "dnn_training_curves.png")
    metrics_for_csv = metrics.copy()
    metrics_for_csv["confusion_matrix"] = json.dumps(metrics["confusion_matrix"])
    pd.DataFrame([metrics_for_csv]).to_csv(RESULTS_DIR / "dnn_metrics.csv", index=False)

    print("\nDNN metrics:")
    print(pd.DataFrame([metrics_for_csv]).to_string(index=False))
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the feedforward DNN CVD risk model.")
    parser.add_argument("--dataset", default="heart", choices=sorted(DATASETS))
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    train_dnn(
        dataset=args.dataset,
        epochs=args.epochs,
        batch_size=args.batch_size,
        random_state=args.random_state,
    )


if __name__ == "__main__":
    main()
