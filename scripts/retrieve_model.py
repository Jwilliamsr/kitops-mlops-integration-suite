#!/usr/bin/env python3
"""
Model Retrieval Script
KitOps MLOps Integration Suite - GSoC 2026 Prototype

Lists model versions from Kubeflow Model Registry and optionally pulls
the ModelKit via the KitOps CLI.
"""

import argparse
import subprocess
import sys

try:
    from model_registry import ModelRegistry
except ImportError:
    print("❌ model-registry SDK not installed. Run: pip install model-registry")
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Retrieve model versions from Kubeflow Model Registry"
    )
    parser.add_argument("--model-name", required=True, help="Name of the model")
    parser.add_argument("--version", default=None, help="Specific version to retrieve (default: list all)")
    parser.add_argument("--server", default="http://localhost", help="Registry server address")
    parser.add_argument("--port", type=int, default=8080, help="Registry server port")
    parser.add_argument("--pull", action="store_true", help="Pull ModelKit after retrieval")
    parser.add_argument("--output-dir", default="./inference/model/", help="Output directory for pulled model")
    parser.add_argument("--model-only", action="store_true", default=True,
                        help="Pull only model layer (skip datasets)")
    parser.add_argument("--plain-http", action="store_true", default=False,
                        help="Use plain HTTP for local registries")
    return parser.parse_args()


def list_versions(registry, model_name: str):
    """List all versions of a model."""
    try:
        versions = registry.get_model_versions(model_name)
        return versions
    except Exception as e:
        print(f"❌ Failed to list versions: {e}")
        return []


def pull_modelkit(uri: str, output_dir: str, model_only: bool = True, plain_http: bool = False):
    """Pull a ModelKit using the kit CLI."""
    # Strip oci:// prefix for kit CLI
    registry_ref = uri.replace("oci://", "")

    cmd = ["kit", "pull", registry_ref, "-d", output_dir]
    if model_only:
        cmd.append("--model-only")
    if plain_http:
        cmd.append("--plain-http")

    print(f"\n⬇️  Pulling ModelKit: {registry_ref}")
    print(f"   Destination: {output_dir}")
    print(f"   Command: {' '.join(cmd)}\n")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(result.stdout)
        print(f"✅ Model pulled to {output_dir}")
    except subprocess.CalledProcessError as e:
        print(f"❌ kit pull failed:\n{e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ 'kit' CLI not found. Install KitOps: https://kitops.ml/docs/cli/installation")
        sys.exit(1)


def main():
    print("=" * 60)
    print("  KitOps MLOps Suite — Model Retrieval")
    print("=" * 60)

    args = parse_args()

    print(f"🔗 Connecting to Kubeflow Model Registry at {args.server}:{args.port}...")

    try:
        registry = ModelRegistry(
            server_address=args.server,
            port=args.port,
            author="retrieval-script",
            is_secure=False,
        )
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    if args.version:
        # Retrieve a specific version
        try:
            version = registry.get_model_version(args.model_name, args.version)
            artifact = version.model_artifact
            print(f"\n📦 Model: {args.model_name}")
            print(f"   Version : {version.name}")
            print(f"   State   : {version.state}")
            print(f"   URI     : {artifact.uri}")

            if version.custom_properties:
                print(f"   Metadata:")
                for k, v in version.custom_properties.items():
                    print(f"     {k}: {v}")

            if args.pull:
                pull_modelkit(
                    artifact.uri,
                    args.output_dir,
                    args.model_only,
                    args.plain_http,
                )
        except Exception as e:
            print(f"❌ Version not found: {e}")
            sys.exit(1)

    else:
        # List all versions
        versions = list_versions(registry, args.model_name)

        if not versions:
            print(f"⚠️  No versions found for model: {args.model_name}")
            sys.exit(0)

        print(f"\n📋 Model: {args.model_name}")
        print(f"   Versions ({len(versions)} found):")

        for v in versions:
            artifact = v.model_artifact
            state_icon = {
                "LIVE": "🟢",
                "ARCHIVED": "🔴",
                "DEPRECATED": "🟡",
            }.get(str(v.state), "⚪")

            print(f"\n   ── {v.name}  {state_icon} {v.state}")
            print(f"      URI     : {artifact.uri if artifact else 'N/A'}")
            if v.custom_properties:
                for k, val in v.custom_properties.items():
                    print(f"      {k:10s}: {val}")

        if args.pull and versions:
            # Pull the first (most recent) version
            latest = versions[0]
            if latest.model_artifact:
                pull_modelkit(
                    latest.model_artifact.uri,
                    args.output_dir,
                    args.model_only,
                    args.plain_http,
                )


if __name__ == "__main__":
    main()
