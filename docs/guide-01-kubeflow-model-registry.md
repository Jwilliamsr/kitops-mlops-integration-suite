# Guide 1: KitOps + Kubeflow Model Registry

> **Objective:** Use KitOps as the model storage backend for Kubeflow Model Registry, linking OCI-native model packaging with structured lifecycle management.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Step 1 — Install Kubeflow Model Registry](#step-1--install-kubeflow-model-registry)
5. [Step 2 — Build and Push a ModelKit](#step-2--build-and-push-a-modelkit)
6. [Step 3 — Register via Python SDK](#step-3--register-via-python-sdk)
7. [Step 4 — Retrieve a Model](#step-4--retrieve-a-model)
8. [Step 5 — Lifecycle Management](#step-5--lifecycle-management)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

Kubeflow Model Registry provides a structured, versioned catalog of ML models. By pointing `ModelArtifact` URIs at KitOps ModelKits stored in an OCI registry, you get:

- ✅ **Versioned, reproducible model artifacts** via OCI standards
- ✅ **Rich metadata** attached to every model version
- ✅ **Lifecycle state management** (LIVE → ARCHIVED → DEPRECATED)
- ✅ **Selective unpacking** — pull only model weights, not the full dataset

**Key mapping:**

| KitOps Concept | Kubeflow Model Registry Concept |
|----------------|--------------------------------|
| ModelKit (OCI artifact) | ModelArtifact (URI reference) |
| Kitfile version tag | ModelVersion |
| Registry namespace | RegisteredModel |

---

## Prerequisites

- `kubectl` connected to a running cluster (minikube or kind recommended)
- `helm` v3.x installed
- `kit` CLI installed ([installation guide](https://kitops.ml/docs/cli/installation))
- Access to an OCI registry (Docker Hub, GHCR, or local Docker registry)
- Python 3.10+ with `model-registry` SDK

```bash
# Verify your environment
./scripts/check_prerequisites.sh
```

---

## Architecture

```
┌──────────────────┐     kit push      ┌────────────────────┐
│   Kitfile +      │ ──────────────►   │   OCI Registry     │
│   Model Files    │                   │ (GHCR / Docker Hub)│
└──────────────────┘                   └────────────────────┘
                                                │
                                                │ oci:// URI
                                                ▼
                                    ┌────────────────────────┐
                                    │  Kubeflow Model         │
                                    │  Registry               │
                                    │  ┌──────────────────┐  │
                                    │  │ RegisteredModel  │  │
                                    │  │  └ ModelVersion  │  │
                                    │  │    └ ModelArtifact│  │
                                    │  └──────────────────┘  │
                                    └────────────────────────┘
```

---

## Step 1 — Install Kubeflow Model Registry

### 1a. Add the Helm Repository

```bash
helm repo add kubeflow https://kubeflow.github.io/model-registry/
helm repo update
```

### 1b. Install into the `kubeflow` namespace

```bash
kubectl create namespace kubeflow

helm install model-registry kubeflow/model-registry-operator \
  --namespace kubeflow \
  --set modelRegistry.dbType=sqlite \
  --wait
```

### 1c. Verify Installation

```bash
kubectl get pods -n kubeflow
# Expected output:
# NAME                                          READY   STATUS    RESTARTS
# model-registry-deployment-xxxx-yyyy           1/1     Running   0
```

### 1d. Port-forward for local access

```bash
kubectl port-forward svc/model-registry-service 8080:8080 -n kubeflow &
echo "Model Registry available at http://localhost:8080"
```

---

## Step 2 — Build and Push a ModelKit

### 2a. Review the Kitfile

```yaml
# kitfiles/fraud-detection.kitfile.yaml
manifestVersion: 1.0.0
package:
  name: fraud-detection-model
  version: 0.1.0
  description: XGBoost fraud detection classifier trained on credit card transactions
  authors:
    - Satyam Kumar

model:
  name: fraud-xgboost
  path: ./model/
  framework: xgboost
  version: 1.7.6
  license: Apache-2.0

datasets:
  - name: fraud-train
    path: ./data/train.csv
    description: Credit card transaction dataset for training

code:
  - path: ./scripts/
    description: Training and inference scripts
```

### 2b. Train the Model

```bash
python scripts/train_fraud_model.py
# Output: model/fraud_xgb.json and data/train.csv
```

### 2c. Build the ModelKit

```bash
kit build . \
  -t localhost:5000/fraud-detection:v0.1.0 \
  -f kitfiles/fraud-detection.kitfile.yaml

# Expected output:
# [+] Building ModelKit...
# [+] Adding model layer: ./model/
# [+] Adding dataset layer: ./data/train.csv
# [+] Adding code layer: ./scripts/
# Successfully built localhost:5000/fraud-detection:v0.1.0
```

### 2d. Push to OCI Registry

```bash
# For a local registry (insecure, dev only)
kit push localhost:5000/fraud-detection:v0.1.0 --plain-http

# For GHCR (authenticate first)
kit login ghcr.io -u YOUR_USERNAME -p YOUR_TOKEN
kit push ghcr.io/YOUR_ORG/fraud-detection:v0.1.0
```

### 2e. Inspect the Pushed ModelKit

```bash
kit inspect localhost:5000/fraud-detection:v0.1.0 --plain-http
```

Expected output:
```json
{
  "package": {
    "name": "fraud-detection-model",
    "version": "0.1.0"
  },
  "model": {
    "name": "fraud-xgboost",
    "framework": "xgboost",
    "digest": "sha256:abc123..."
  }
}
```

---

## Step 3 — Register via Python SDK

```python
# scripts/register_model.py
from model_registry import ModelRegistry

registry = ModelRegistry(
    server_address="http://localhost",
    port=8080,
    author="Satyam Kumar",
    is_secure=False,
)

# Register the top-level model
registered_model = registry.register_model(
    name="fraud-detection-model",
    uri="oci://localhost:5000/fraud-detection:v0.1.0",
    version="0.1.0",
    description="XGBoost fraud detection classifier",
    metadata={
        "framework": "xgboost",
        "framework_version": "1.7.6",
        "accuracy": "0.947",
        "f1_score": "0.921",
        "training_dataset": "credit-card-transactions-v2",
        "kitops_digest": "sha256:abc123...",  # from kit inspect
        "kitops_registry": "localhost:5000",
    },
)

print(f"✅ Registered model ID: {registered_model.id}")
print(f"   Name: {registered_model.name}")
print(f"   Version: 0.1.0")
```

Run it:
```bash
python scripts/register_model.py
# ✅ Registered model ID: 1
#    Name: fraud-detection-model
#    Version: 0.1.0
```

---

## Step 4 — Retrieve a Model

```python
# scripts/retrieve_model.py
import subprocess
from model_registry import ModelRegistry

registry = ModelRegistry(
    server_address="http://localhost",
    port=8080,
    author="Satyam Kumar",
    is_secure=False,
)

# List all versions of a model
versions = registry.get_model_versions("fraud-detection-model")

print("📋 Available versions:")
for v in versions:
    artifact = v.model_artifact
    print(f"   Version: {v.name}  URI: {artifact.uri}  State: {v.state}")

# Pull the latest version via KitOps CLI
latest = registry.get_model_version("fraud-detection-model", "latest")
oci_uri = latest.model_artifact.uri

print(f"\n⬇️  Pulling ModelKit: {oci_uri}")
subprocess.run(
    ["kit", "pull", oci_uri, "--model-only", "-d", "./inference/model/", "--plain-http"],
    check=True,
)
print("✅ Model pulled to ./inference/model/")
```

---

## Step 5 — Lifecycle Management

Kubeflow Model Registry supports lifecycle states for model versions:

| State | Meaning | KitOps Action |
|-------|---------|---------------|
| `LIVE` | Active, used in production | Tag `:production` |
| `ARCHIVED` | Retired, no longer used | Keep in registry, not surfaced |
| `DEPRECATED` | Being phased out | Tag `:deprecated` |

### Promote a model from staging to production:

```python
import requests

# Update state via REST API
model_version_id = "2"
response = requests.patch(
    f"http://localhost:8080/api/model_registry/v1alpha3/model_versions/{model_version_id}",
    json={"state": "LIVE"},
)
print(f"Promoted to LIVE: {response.status_code}")
```

### Archive an old version:

```python
response = requests.patch(
    f"http://localhost:8080/api/model_registry/v1alpha3/model_versions/1",
    json={"state": "ARCHIVED"},
)
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `OCI URI not recognized` | URI doesn't start with `oci://` | Ensure URI format: `oci://registry/image:tag` |
| `kit push` authentication failure | No credentials stored | Run `kit login <registry>` first |
| Model version not appearing | Registry pod not ready | Check `kubectl logs -n kubeflow -l app=model-registry` |
| `Connection refused` on port 8080 | Port-forward not running | Re-run `kubectl port-forward svc/model-registry-service 8080:8080 -n kubeflow` |
| `ModuleNotFoundError: model_registry` | SDK not installed | Run `pip install model-registry` |

---

## Best Practices

1. **Use digest pinning in production** — Tags can be moved; digests (`sha256:...`) cannot. Always use digest-pinned URIs for production `ModelArtifact` records.

2. **Store kit inspect output as metadata** — Include the full manifest digest in the `ModelVersion` metadata for complete artifact provenance and audit trails.

3. **Use registry namespacing** — Separate dev, staging, and production:
   - `myregistry/dev/model:tag`
   - `myregistry/staging/model:tag`
   - `myregistry/prod/model:tag`

4. **Automate registration after training** — Make model registration the final step of every training run so the registry always reflects the current state of trained artifacts.

5. **Version your Kitfiles** — Store Kitfiles alongside training code in Git so every model version has a reproducible artifact definition.

---

*Next: [Guide 2 — KitOps + Argo Workflows](guide-02-argo-workflows.md)*
