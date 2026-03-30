# Guide 2: KitOps + Argo Workflows

> **Objective:** Integrate KitOps into Argo Workflows ML pipelines to automate model packaging and distribution as OCI ModelKits — making artifact creation a reliable, reproducible pipeline step, not a manual afterthought.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Step 1 — Install Argo Workflows](#step-1--install-argo-workflows)
5. [Step 2 — Build the KitOps Executor Image](#step-2--build-the-kitops-executor-image)
6. [Step 3 — Complete ML Pipeline Workflow](#step-3--complete-ml-pipeline-workflow)
7. [Step 4 — Parameterized Workflow Template](#step-4--parameterized-workflow-template)
8. [Step 5 — Run and Monitor the Workflow](#step-5--run-and-monitor-the-workflow)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Argo Workflows is the de-facto standard workflow engine for Kubernetes ML pipelines. Each step runs in its own container, making it perfect for inserting a KitOps packaging step after model training.

**What this integration achieves:**

- ✅ **Every training run produces a versioned ModelKit** automatically
- ✅ **Unique artifact per pipeline run** using `workflow.uid` as the tag
- ✅ **Zero manual packaging steps** — packaging is part of the pipeline
- ✅ **Traceable artifacts** — every ModelKit maps back to a specific pipeline run
- ✅ **Registry credentials secured** via Kubernetes Secrets

---

## Prerequisites

- Running Kubernetes cluster
- `kubectl` connected to the cluster
- `helm` v3.x
- Argo Workflows CLI ([installation](https://argoproj.github.io/workflows/installation/))
- An OCI registry with credentials stored as a Kubernetes Secret

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Argo Workflow                             │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐ │
│  │ Preprocess   │──►│    Train     │──►│ KitOps Package  │ │
│  │   Data       │   │    Model     │   │  (kit build +   │ │
│  └──────────────┘   └──────────────┘   │   kit push)     │ │
│                                        └────────┬────────┘ │
│                                                 │           │
│                          ┌──────────────────────┘           │
│                          ▼                                  │
│                  ┌───────────────┐                          │
│                  │   Register    │                          │
│                  │   in Kubeflow │                          │
│                  └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   OCI Registry   │
                    │  myorg/model:    │
                    │  workflow-uid-XYZ│
                    └──────────────────┘
```

---

## Step 1 — Install Argo Workflows

### 1a. Install via Helm

```bash
kubectl create namespace argo

helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

helm install argo-workflows argo/argo-workflows \
  --namespace argo \
  --set controller.containerRuntimeExecutor=k8sapi \
  --set server.authMode=server \
  --wait
```

### 1b. Install Argo CLI (macOS)

```bash
brew install argo
```

Or via direct download:
```bash
curl -sLO https://github.com/argoproj/argo-workflows/releases/latest/download/argo-darwin-amd64.gz
gunzip argo-darwin-amd64.gz && chmod +x argo-darwin-amd64
sudo mv argo-darwin-amd64 /usr/local/bin/argo
argo version
```

### 1c. Create Registry Credentials Secret

```bash
kubectl create secret generic registry-credentials \
  --namespace argo \
  --from-literal=username=YOUR_REGISTRY_USER \
  --from-literal=password=YOUR_REGISTRY_TOKEN
```

### 1d. Access the Argo UI

```bash
kubectl -n argo port-forward svc/argo-workflows-server 2746:2746 &
echo "Argo UI available at http://localhost:2746"
```

---

## Step 2 — Build the KitOps Executor Image

The KitOps executor is a custom container image that has both the `kit` CLI and the Python SDK for model registration.

```dockerfile
# docker/kitops-executor/Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install KitOps CLI
RUN curl -sL \
    https://github.com/kitops-ml/kitops/releases/latest/download/kitops-linux-amd64.tar.gz \
    | tar -xz -C /tmp \
    && mv /tmp/kit /usr/local/bin/kit \
    && chmod +x /usr/local/bin/kit

# Install Python dependencies
RUN pip install --no-cache-dir \
    model-registry \
    requests

# Verify installation
RUN kit version && python -c "import model_registry; print('SDK OK')"

ENTRYPOINT ["/bin/bash"]
```

Build and push this image:

```bash
docker build -t your-registry/kitops-executor:latest docker/kitops-executor/
docker push your-registry/kitops-executor:latest
```

---

## Step 3 — Complete ML Pipeline Workflow

```yaml
# workflows/ml-training-pipeline.yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: ml-training-pipeline
  namespace: argo
  labels:
    workflow-type: ml-training
spec:
  entrypoint: ml-pipeline
  serviceAccountName: argo-workflow

  # Shared storage for artifacts between steps
  volumes:
    - name: model-artifacts
      emptyDir: {}

  templates:
    # ─────────────── Main Pipeline DAG ───────────────
    - name: ml-pipeline
      steps:
        - - name: preprocess
            template: data-preprocessing
        - - name: train
            template: model-training
        - - name: package
            template: kitops-package
        - - name: register
            template: model-register

    # ─────────────── Step 1: Preprocessing ───────────────
    - name: data-preprocessing
      container:
        image: python:3.11-slim
        command: ["/bin/sh", "-c"]
        args:
          - |
            pip install pandas scikit-learn --quiet
            python -c "
            import pandas as pd
            import numpy as np

            # Generate synthetic fraud detection data for demo
            np.random.seed(42)
            n = 10000
            df = pd.DataFrame({
                'amount': np.random.exponential(100, n),
                'hour': np.random.randint(0, 24, n),
                'merchant_category': np.random.randint(0, 10, n),
                'Class': np.random.choice([0, 1], n, p=[0.98, 0.02])
            })
            df.to_csv('/artifacts/train.csv', index=False)
            print(f'Dataset ready: {len(df)} rows, {df.Class.sum()} fraud cases')
            "
        volumeMounts:
          - name: model-artifacts
            mountPath: /artifacts

    # ─────────────── Step 2: Training ───────────────
    - name: model-training
      container:
        image: python:3.11-slim
        command: ["/bin/sh", "-c"]
        args:
          - |
            pip install xgboost scikit-learn pandas --quiet

            python -c "
            import xgboost as xgb
            import pandas as pd
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import accuracy_score, f1_score
            import json

            df = pd.read_csv('/artifacts/train.csv')
            X = df.drop('Class', axis=1)
            y = df['Class']

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                use_label_encoder=False,
                eval_metric='logloss',
            )
            model.fit(X_train, y_train)

            preds = model.predict(X_test)
            metrics = {
                'accuracy': float(accuracy_score(y_test, preds)),
                'f1_score': float(f1_score(y_test, preds, zero_division=0)),
            }
            print(f'Metrics: {metrics}')

            model.save_model('/artifacts/model/fraud_xgb.json')

            with open('/artifacts/metrics.json', 'w') as f:
                json.dump(metrics, f)
            print('Training complete')
            "
        volumeMounts:
          - name: model-artifacts
            mountPath: /artifacts

    # ─────────────── Step 3: KitOps Packaging ───────────────
    - name: kitops-package
      container:
        image: your-registry/kitops-executor:latest
        command: ["/bin/bash", "-c"]
        args:
          - |
            set -e
            cd /artifacts

            # Write the Kitfile dynamically
            cat > Kitfile.yaml <<EOF
            manifestVersion: 1.0.0
            package:
              name: fraud-detection-model
              version: "1.0.0-${WORKFLOW_UID:0:8}"
              description: "XGBoost Fraud Detection - Pipeline Run ${WORKFLOW_UID}"
              authors: ["Satyam Kumar"]
            model:
              name: fraud-xgboost
              path: ./model/
              framework: xgboost
              version: "1.7.6"
              license: Apache-2.0
            datasets:
              - name: fraud-train
                path: ./train.csv
            EOF

            # Authenticate with OCI registry
            kit login ${REGISTRY_URL} \
              -u ${REGISTRY_USER} \
              -p ${REGISTRY_PASS}

            # Build ModelKit
            MODEL_TAG="${REGISTRY_URL}/models/fraud:${WORKFLOW_UID:0:8}"
            kit build . -t ${MODEL_TAG} -f Kitfile.yaml

            # Push ModelKit
            kit push ${MODEL_TAG}

            # Save URI for next step
            echo "${MODEL_TAG}" > /artifacts/model-uri.txt
            echo "✅ ModelKit pushed: ${MODEL_TAG}"

            # Inspect and save manifest
            kit inspect ${MODEL_TAG} --format json > /artifacts/kit-manifest.json
        env:
          - name: REGISTRY_URL
            value: "ghcr.io/myorg"
          - name: REGISTRY_USER
            valueFrom:
              secretKeyRef:
                name: registry-credentials
                key: username
          - name: REGISTRY_PASS
            valueFrom:
              secretKeyRef:
                name: registry-credentials
                key: password
          - name: WORKFLOW_UID
            value: "{{workflow.uid}}"
        volumeMounts:
          - name: model-artifacts
            mountPath: /artifacts

    # ─────────────── Step 4: Model Registration ───────────────
    - name: model-register
      container:
        image: your-registry/kitops-executor:latest
        command: ["/bin/bash", "-c"]
        args:
          - |
            MODEL_URI=$(cat /artifacts/model-uri.txt)
            METRICS=$(cat /artifacts/metrics.json)

            python3 - <<EOF
            from model_registry import ModelRegistry
            import json

            with open('/artifacts/metrics.json') as f:
                metrics = json.load(f)
            with open('/artifacts/model-uri.txt') as f:
                model_uri = f.read().strip()

            registry = ModelRegistry(
                server_address="http://model-registry-service.kubeflow.svc.cluster.local",
                port=8080,
                author="Argo Pipeline",
                is_secure=False,
            )

            rm = registry.register_model(
                name="fraud-detection-model",
                uri=f"oci://{model_uri}",
                version=model_uri.split(":")[-1],
                description="Automated training pipeline output",
                metadata={
                    "accuracy": str(metrics.get("accuracy", "")),
                    "f1_score": str(metrics.get("f1_score", "")),
                    "workflow_uid": "${WORKFLOW_UID}",
                    "pipeline": "ml-training-pipeline",
                },
            )
            print(f"✅ Registered: {rm.id} - {rm.name}")
            EOF
        env:
          - name: WORKFLOW_UID
            value: "{{workflow.uid}}"
        volumeMounts:
          - name: model-artifacts
            mountPath: /artifacts
```

---

## Step 4 — Parameterized Workflow Template

This reusable template accepts model name, version, and registry as inputs:

```yaml
# workflows/parameterized-workflow.yaml
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: kitops-packaging-template
  namespace: argo
spec:
  templates:
    - name: package-and-push
      inputs:
        parameters:
          - name: model-name
          - name: model-version
          - name: registry
          - name: artifact-path
        artifacts:
          - name: trained-model
            path: /artifacts/model
      container:
        image: your-registry/kitops-executor:latest
        command: ["/bin/bash", "-c"]
        args:
          - |
            MODEL_TAG="{{inputs.parameters.registry}}/{{inputs.parameters.model-name}}:{{inputs.parameters.model-version}}"
            kit build /artifacts -t ${MODEL_TAG}
            kit push ${MODEL_TAG}
            echo "${MODEL_TAG}" > /output/model-uri.txt
```

Use the template from another workflow:

```yaml
- name: package-model
  templateRef:
    name: kitops-packaging-template
    template: package-and-push
  arguments:
    parameters:
      - name: model-name
        value: "fraud-detection"
      - name: model-version
        value: "{{workflow.uid}}"
      - name: registry
        value: "ghcr.io/myorg"
```

---

## Step 5 — Run and Monitor the Workflow

```bash
# Submit the workflow
argo submit workflows/ml-training-pipeline.yaml \
  --namespace argo \
  --watch

# Check status
argo list -n argo

# View logs for a specific step
argo logs ml-training-pipeline -n argo --follow

# Get logs for the packaging step only
argo logs ml-training-pipeline -n argo -c kitops-package
```

Expected output:
```
STEP                      PODNAME                          DURATION  MESSAGE
✔ ml-training-pipeline    ml-training-pipeline-xxx
 ├───✔ preprocess         ml-training-pipeline-xxx-yyy    12s
 ├───✔ train              ml-training-pipeline-xxx-zzz    45s
 ├───✔ package            ml-training-pipeline-xxx-aaa    18s
 └───✔ register           ml-training-pipeline-xxx-bbb    5s
```

---

## Best Practices

1. **Use `workflow.uid` as the ModelKit tag** — guarantees uniqueness and provides traceback to the exact pipeline run that produced the model.

2. **Store registry credentials as Kubernetes Secrets** — never use literal values in workflow YAML; use `secretKeyRef` for all sensitive values.

3. **Add a post-push validation step** — run `kit inspect` after `kit push` and fail the pipeline if the manifest is malformed.

4. **Use Argo Workflow artifacts for inter-step communication** — prefer Argo's built-in artifact mechanisms over shared `emptyDir` volumes for production pipelines.

5. **Configure retry and timeout** — add `retryStrategy` and `activeDeadlineSeconds` to the `kitops-package` step to handle transient registry failures gracefully.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `kit: command not found` | Executor image not built correctly | Rebuild and push executor image, verify `kit version` in build |
| `Error pushing to registry` | Wrong credentials or registry URL | Check secret values: `kubectl get secret registry-credentials -o yaml` |
| Step stuck in `Pending` | PVC or emptyDir not mounted | Verify `volumeMounts` and `volumes` match in spec |
| `Connection refused` to model registry | Service DNS not resolving | Use full Kubernetes DNS: `model-registry-service.kubeflow.svc.cluster.local` |

---

*Previous: [Guide 1 — KitOps + Kubeflow Model Registry](guide-01-kubeflow-model-registry.md)*  
*Next: [Guide 3 — KitOps + Kyverno](guide-03-kyverno.md)*
