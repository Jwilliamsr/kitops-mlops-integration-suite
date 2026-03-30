#!/usr/bin/env python3
"""
Fraud Detection Model Training Script
KitOps MLOps Integration Suite - GSoC 2026 Prototype

Trains an XGBoost classifier on synthetic credit card transaction data.
Outputs: model/fraud_xgb.json, data/train.csv
"""

import json
import os
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split

try:
    import xgboost as xgb
except ImportError:
    print("❌ xgboost not installed. Run: pip install xgboost scikit-learn pandas numpy")
    sys.exit(1)


def generate_dataset(n_samples: int = 10000, fraud_rate: float = 0.02, seed: int = 42):
    """Generate a synthetic credit card transaction dataset."""
    print(f"📊 Generating fraud detection dataset...")
    np.random.seed(seed)

    n_fraud = int(n_samples * fraud_rate)
    n_legit = n_samples - n_fraud

    # Legitimate transactions
    legit = pd.DataFrame({
        "amount": np.random.exponential(scale=80, size=n_legit),
        "hour": np.random.randint(6, 23, size=n_legit),       # daytime
        "merchant_category": np.random.randint(0, 10, size=n_legit),
        "Class": 0,
    })

    # Fraudulent transactions (large amounts, unusual hours)
    fraud = pd.DataFrame({
        "amount": np.random.exponential(scale=3000, size=n_fraud),
        "hour": np.random.randint(0, 5, size=n_fraud),         # late night
        "merchant_category": np.random.randint(7, 10, size=n_fraud),
        "Class": 1,
    })

    df = pd.concat([legit, fraud], ignore_index=True).sample(frac=1, random_state=seed)
    print(f"   Rows: {len(df):,}  |  Fraud cases: {df.Class.sum()} ({df.Class.mean():.1%})")
    return df


def train_model(df: pd.DataFrame):
    """Train XGBoost classifier and return trained model + metrics."""
    print("\n🤖 Training XGBoost classifier...")

    X = df.drop("Class", axis=1)
    y = df["Class"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        scale_pos_weight=len(y_train[y_train == 0]) / len(y_train[y_train == 1]),
        use_label_encoder=False,
        eval_metric="logloss",
        verbosity=0,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    f1 = f1_score(y_test, preds, zero_division=0)

    metrics = {
        "accuracy": round(float(acc), 4),
        "f1_score": round(float(f1), 4),
        "n_estimators": 100,
        "max_depth": 6,
    }

    print(f"\n📈 Model Performance:")
    print(f"   Accuracy : {acc:.4f}")
    print(f"   F1 Score : {f1:.4f}")
    print(f"\n{classification_report(y_test, preds, target_names=['Legit', 'Fraud'])}")

    return model, metrics


def save_artifacts(df: pd.DataFrame, model, metrics: dict):
    """Save model, dataset, and metrics to disk."""
    # Create directories
    os.makedirs("model", exist_ok=True)
    os.makedirs("data", exist_ok=True)

    # Save model
    model_path = "model/fraud_xgb.json"
    model.save_model(model_path)
    print(f"💾 Model saved to: {model_path}")

    # Save dataset
    data_path = "data/train.csv"
    df.to_csv(data_path, index=False)
    print(f"💾 Dataset saved to: {data_path}")

    # Save metrics
    metrics_path = "model/metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"💾 Metrics saved to: {metrics_path}")

    return model_path, data_path


def main():
    print("=" * 60)
    print("  KitOps MLOps Suite — Fraud Detection Training")
    print("=" * 60)

    # Generate dataset
    df = generate_dataset(n_samples=10000)

    # Train model
    model, metrics = train_model(df)

    # Save artifacts
    save_artifacts(df, model, metrics)

    print("\n✅ Training complete!")
    print("\nNext steps:")
    print("  kit build . -t localhost:5000/fraud-detection:v1.0.0 -f kitfiles/fraud-detection.kitfile.yaml")
    print("  kit push localhost:5000/fraud-detection:v1.0.0 --plain-http")


if __name__ == "__main__":
    main()
