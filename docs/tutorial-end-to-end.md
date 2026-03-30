# End-to-End Tutorial: Complete ML Artifact Lifecycle

> **Scenario:** Train a fraud detection model → Package with KitOps → Register in Kubeflow Model Registry → Automate via Argo Workflows → Enforce governance with Kyverno.
>
> **Estimated time:** 90–120 minutes  
> **Difficulty:** Intermediate  
> **Prerequisites:** Completed Guides 1, 2, and 3

---

## Table of Contents

1. [What You Will Build](#what-you-will-build)
2. [Environment Verification](#environment-verification)
3. [Phase 1: Model Training & KitOps Packaging](#phase-1-model-training--kitops-packaging)
4. [Phase 2: Register in Kubeflow Model Registry](#phase-2-register-in-kubeflow-model-registry)
5. [Phase 3: Automate via Argo Workflows](#phase-3-automate-via-argo-workflows)
6. [Phase 4: Apply Kyverno Governance](#phase-4-apply-kyverno-governance)
7. [Phase 5: Model Retrieval for Inference](#phase-5-model-retrieval-for-inference)
8. [What You Achieved](#what-you-achieved)
9. [Next Steps](#next-steps)

---

## What You Will Build

By the end of this tutorial, you will have a **running, end-to-end ML artifact lifecycle** on your local Kubernetes cluster:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Complete ML Artifact Lifecycle                        │
│                                                                          │
│  Phase 1: Train    Phase 2: Register   Phase 3: Automate               │
│                                                                          │
│  train.py ──►      Kubeflow            Argo Workflow                    │
│  kit build ──►     Model Registry ◄──  (auto-package                   │
│  kit push          tracks URI,         + auto-register)                 │
│        │           version, metrics                                     │
│        │                                                                 │
│        ▼                ▲                                               │
│   OCI Registry ─────────┘                                               │
│   (ghcr.io/myorg)           Phase 4: Govern    Phase 5: Serve          │
│                                                                          │
│                             Kyverno            kit pull ──►             │
│                             enforces:          serve.py                 │
│                             - registry                                  │
│                             - labels                                    │
│                             - no :latest                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Verification

Before starting, verify the full environment is operational:

```bash
chmod +x scripts/check_prerequisites.sh
./scripts/check_prerequisites.sh
```

Expected output:
```
🔍 Checking KitOps Integration Suite Prerequisites...
[OK] kit CLI
[OK] kubectl
[OK] helm
[OK] docker
[OK] python3
[OK] Kubernetes cluster
[OK] kubeflow namespace
[OK] argo namespace
[OK] kyverno namespace
✅ All prerequisites satisfied. Ready to begin!
```

If anything is missing, run:
```bash
./scripts/setup_environment.sh
```

---

## Phase 1: Model Training & KitOps Packaging

### Step 1.1 — Train the Fraud Detection Model

```bash
python scripts/train_fraud_model.py
```

This script:
- Generates a synthetic credit card transaction dataset (10,000 rows, 2% fraud rate)
- Trains an XGBoost classifier
- Saves the model to `model/fraud_xgb.json`
- Prints accuracy and F1 score

Expected output:
```
📊 Generating fraud detection dataset...
   Rows: 10000, Fraud cases: 198 (1.98%)

🤖 Training XGBoost classifier...
   n_estimators=100, max_depth=6, learning_rate=0.1

📈 Model Performance:
   Accuracy: 0.9835
   F1 Score (fraud class): 0.7143
   Precision: 0.6957
   Recall:  0.7273

💾 Model saved to: model/fraud_xgb.json
✅ Training complete!
```

### Step 1.2 — Review the Kitfile

```bash
cat kitfiles/fraud-detection.kitfile.yaml
```

### Step 1.3 — Start a Local OCI Registry (for testing)

```bash
docker run -d -p 5000:5000 --name local-registry registry:2
echo "Local registry running at localhost:5000"
```

### Step 1.4 — Build the ModelKit

```bash
kit build . \
  -t localhost:5000/fraud-detection:v1.0.0 \
  -f kitfiles/fraud-detection.kitfile.yaml
```

### Step 1.5 — Push the ModelKit

```bash
kit push localhost:5000/fraud-detection:v1.0.0 --plain-http
```

### Step 1.6 — Inspect to Verify

```bash
kit inspect localhost:5000/fraud-detection:v1.0.0 --plain-http
```

You should see the full manifest with model, dataset, and code layers listed. **Copy the `sha256:...` digest** — you'll use it in the next phase.

---

## Phase 2: Register in Kubeflow Model Registry

### Step 2.1 — Ensure Port-Forward is Running

```bash
kubectl port-forward svc/model-registry-service 8080:8080 -n kubeflow &
```

### Step 2.2 — Register the Model

```bash
python scripts/register_model.py \
  --model-name fraud-detection \
  --version 1.0.0 \
  --uri oci://localhost:5000/fraud-detection:v1.0.0 \
  --accuracy 0.9835 \
  --f1-score 0.7143
```

Expected output:
```
🔗 Connecting to Kubeflow Model Registry at http://localhost:8080...
📦 Registering model: fraud-detection v1.0.0
   URI: oci://localhost:5000/fraud-detection:v1.0.0
   Framework: xgboost
   Accuracy: 0.9835

✅ Registration successful!
   RegisteredModel ID: 1
   ModelVersion ID: 1
   ModelArtifact ID: 1
   State: LIVE
```

### Step 2.3 — Retrieve and Verify Registration

```bash
python scripts/retrieve_model.py --model-name fraud-detection
```

Expected output:
```
📋 Model: fraud-detection
   Versions:
   ── v1.0.0  [LIVE]
      URI: oci://localhost:5000/fraud-detection:v1.0.0
      Framework: xgboost | Accuracy: 0.9835
```

---

## Phase 3: Automate via Argo Workflows

Now we make everything above happen automatically inside a Kubernetes pipeline.

### Step 3.1 — Apply the Workflow

```bash
kubectl apply -f workflows/ml-training-pipeline.yaml -n argo
```

### Step 3.2 — Submit and Watch

```bash
argo submit workflows/ml-training-pipeline.yaml \
  --namespace argo \
  --watch
```

### Step 3.3 — View Live Logs

```bash
# In a separate terminal
argo logs -f @latest -n argo
```

When complete, the workflow will have:
1. Generated and preprocessed the dataset
2. Trained the XGBoost model
3. Built and pushed the ModelKit with a unique `workflow.uid` tag
4. Registered the ModelKit in Kubeflow Model Registry

### Step 3.4 — Verify in Kubeflow Registry

```bash
python scripts/retrieve_model.py --model-name fraud-detection
```

You should now see a second version registered by the Argo pipeline!

---

## Phase 4: Apply Kyverno Governance

### Step 4.1 — Apply All Policies

```bash
kubectl apply -f policies/
```

```
clusterPolicy.kyverno.io/restrict-model-registry created
clusterPolicy.kyverno.io/require-model-labels created
clusterPolicy.kyverno.io/disallow-latest-model-tag created
clusterPolicy.kyverno.io/inject-model-metadata created
```

### Step 4.2 — Verify Policy Enforcement

**Test 1: Approved registry (should succeed)**
```bash
kubectl run approved-model \
  --image=ghcr.io/myorg/fraud-detection:v1.0.0 \
  --labels "model-name=fraud-detection,model-version=1.0.0,team=ml-eng" \
  --namespace ml-production \
  --dry-run=server
```
Expected: `pod/approved-model created (server dry run)`

**Test 2: Unauthorized registry (should be blocked)**
```bash
kubectl run bad-model \
  --image=docker.io/random/model:latest \
  --namespace ml-production \
  --dry-run=server
```
Expected:
```
Error from server: admission webhook "validate.kyverno.svc" denied the request:
  policy restrict-model-registry/check-model-registry failed:
  Model images must come from approved registries: ghcr.io/myorg.
```

**Test 3: Latest tag (should be blocked)**
```bash
kubectl run latest-model \
  --image=ghcr.io/myorg/fraud-detection:latest \
  --namespace ml-production \
  --dry-run=server
```
Expected: Admission denied — no `:latest` in production.

### Step 4.3 — Check Policy Reports

```bash
kubectl get policyreport -n ml-production
kubectl describe policyreport -n ml-production
```

---

## Phase 5: Model Retrieval for Inference

### Step 5.1 — Pull the Model from Registry

```bash
python scripts/retrieve_model.py \
  --model-name fraud-detection \
  --pull \
  --output-dir ./inference/model/
```

Or using the `kit` CLI directly with the URI from the registry:

```bash
# Get the URI from registry first
LATEST_URI=$(python -c "
from model_registry import ModelRegistry
r = ModelRegistry('http://localhost', port=8080, author='demo', is_secure=False)
v = r.get_model_version('fraud-detection', 'latest')
print(v.model_artifact.uri)
")

echo "Pulling: $LATEST_URI"
kit pull ${LATEST_URI/oci:\/\//} --model-only -d ./inference/model/ --plain-http
```

### Step 5.2 — Run Inference

```bash
python -c "
import xgboost as xgb
import numpy as np
import json

# Load model
model = xgb.XGBClassifier()
model.load_model('./inference/model/fraud_xgb.json')

# Simulate 5 transactions
test_data = np.array([
    [250.0, 14, 3],   # amount, hour, merchant_category
    [12500.0, 3, 7],  # suspicious: large amount at 3am
    [45.0, 12, 2],
    [8900.0, 2, 9],   # suspicious
    [120.0, 18, 4],
])

predictions = model.predict(test_data)
probabilities = model.predict_proba(test_data)[:, 1]

for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
    label = '🚨 FRAUD' if pred == 1 else '✅ LEGIT'
    print(f'Transaction {i+1}: {label} (confidence: {prob:.1%})')
"
```

Expected output:
```
Transaction 1: ✅ LEGIT  (confidence: 2.3%)
Transaction 2: 🚨 FRAUD (confidence: 94.7%)
Transaction 3: ✅ LEGIT  (confidence: 1.1%)
Transaction 4: 🚨 FRAUD (confidence: 87.2%)
Transaction 5: ✅ LEGIT  (confidence: 3.8%)
```

---

## What You Achieved

Congratulations! In this tutorial you built a **production-grade ML artifact lifecycle** from scratch:

| Phase | Tool | What Happened |
|-------|------|---------------|
| 1. Package | **KitOps** | Trained model packaged into a versioned OCI artifact |
| 2. Register | **Kubeflow Model Registry** | Model tracked with metadata, version history, OCI URI |
| 3. Automate | **Argo Workflows** | Full pipeline runs automatically, packaging included |
| 4. Govern | **Kyverno** | Only approved, labeled, versioned models reach production |
| 5. Serve | **KitOps + Python** | Selective model pull for inference, no dataset overhead |

This is the workflow that leading ML engineering teams build **manually over months**. You just built it in 90 minutes.

---

## Next Steps

- 📖 Read the [Reference Appendix](reference-appendix.md) for full CLI and API documentation
- 🔧 Try the [parameterized workflow template](../workflows/parameterized-workflow.yaml) for multi-model reuse
- 🔒 Add [image signing verification](https://kyverno.io/docs/writing-policies/verify-images/) to your Kyverno policies
- 📊 Explore Kubeflow Pipelines for replacing the Argo Workflow with a full KFP DAG
- 🌐 Connect your OCI registry to Harbor for a full on-premise production setup

---

*Previous: [Guide 3 — KitOps + Kyverno](guide-03-kyverno.md)*  
*Next: [Reference Appendix](reference-appendix.md)*
