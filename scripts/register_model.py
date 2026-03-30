#!/usr/bin/env python3
"""
Model Registration Script
KitOps MLOps Integration Suite - GSoC 2026 Prototype

Registers a KitOps ModelKit in Kubeflow Model Registry via the Python SDK.
"""

import argparse
import json
import sys

try:
    from model_registry import ModelRegistry
    from model_registry.types import RegisteredModel
except ImportError:
    print("❌ model-registry SDK not installed. Run: pip install model-registry")
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Register a KitOps ModelKit in Kubeflow Model Registry"
    )
    parser.add_argument("--model-name", required=True, help="Name of the model")
    parser.add_argument("--version", required=True, help="Model version (e.g. 1.0.0)")
    parser.add_argument(
        "--uri",
        required=True,
        help="OCI URI of the ModelKit (e.g. oci://localhost:5000/fraud-detection:v1.0.0)",
    )
    parser.add_argument("--server", default="http://localhost", help="Registry server address")
    parser.add_argument("--port", type=int, default=8080, help="Registry server port")
    parser.add_argument("--author", default="Satyam Kumar", help="Model author")
    parser.add_argument("--description", default="", help="Model description")
    parser.add_argument("--accuracy", type=float, help="Model accuracy metric")
    parser.add_argument("--f1-score", type=float, dest="f1_score", help="Model F1 score")
    parser.add_argument("--framework", default="xgboost", help="ML framework")
    parser.add_argument("--metrics-file", help="Path to metrics JSON file")
    return parser.parse_args()


def load_metrics(args) -> dict:
    """Load metrics from file or CLI arguments."""
    metrics = {}

    if args.metrics_file:
        with open(args.metrics_file) as f:
            metrics = json.load(f)
        print(f"   Loaded metrics from {args.metrics_file}")

    # CLI args override file values
    if args.accuracy is not None:
        metrics["accuracy"] = args.accuracy
    if args.f1_score is not None:
        metrics["f1_score"] = args.f1_score

    return metrics


def register_model(args):
    """Register the model in Kubeflow Model Registry."""
    print(f"🔗 Connecting to Kubeflow Model Registry at {args.server}:{args.port}...")

    try:
        registry = ModelRegistry(
            server_address=args.server,
            port=args.port,
            author=args.author,
            is_secure=False,
        )
    except Exception as e:
        print(f"❌ Failed to connect to Model Registry: {e}")
        print("   Is port-forward running? kubectl port-forward svc/model-registry-service 8080:8080 -n kubeflow")
        sys.exit(1)

    metrics = load_metrics(args)

    metadata = {
        "framework": args.framework,
        "kitops_registry": args.uri.replace("oci://", "").split("/")[0],
    }
    if metrics.get("accuracy"):
        metadata["accuracy"] = str(round(metrics["accuracy"], 4))
    if metrics.get("f1_score"):
        metadata["f1_score"] = str(round(metrics["f1_score"], 4))

    description = args.description or f"{args.framework.upper()} model — KitOps ModelKit"

    print(f"📦 Registering model: {args.model_name} v{args.version}")
    print(f"   URI: {args.uri}")
    print(f"   Framework: {args.framework}")
    if metadata.get("accuracy"):
        print(f"   Accuracy: {metadata['accuracy']}")

    try:
        rm = registry.register_model(
            name=args.model_name,
            uri=args.uri,
            version=args.version,
            description=description,
            metadata=metadata,
        )

        print(f"\n✅ Registration successful!")
        print(f"   RegisteredModel ID : {rm.id}")
        print(f"   Name               : {rm.name}")
        print(f"   Version            : {args.version}")
        print(f"   State              : LIVE")

        return rm

    except Exception as e:
        print(f"\n❌ Registration failed: {e}")
        sys.exit(1)


def main():
    print("=" * 60)
    print("  KitOps MLOps Suite — Model Registration")
    print("=" * 60)

    args = parse_args()
    rm = register_model(args)

    print(f"\nNext steps:")
    print(f"  python scripts/retrieve_model.py --model-name {args.model_name}")


if __name__ == "__main__":
    main()
