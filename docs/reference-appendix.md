# Reference Appendix

> Quick reference for KitOps CLI, Kubeflow Model Registry REST API, Kyverno patterns, and the shared glossary.

---

## KitOps CLI Reference

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `kit build [context] -t [tag]` | Build a ModelKit from a directory with a Kitfile | `-f` (Kitfile path), `--no-cache` |
| `kit push [ref]` | Push a ModelKit to an OCI registry | `--plain-http` (for local registries) |
| `kit pull [ref]` | Pull a ModelKit from an OCI registry | `--model-only`, `--datasets-only` |
| `kit inspect [ref]` | Show contents and metadata of a ModelKit | `--format json` |
| `kit login [registry]` | Authenticate with an OCI registry | `-u` (username), `-p` (password) |
| `kit logout [registry]` | Remove stored credentials for a registry | — |
| `kit list` | List locally cached ModelKits | — |
| `kit remove [ref]` | Remove a locally cached ModelKit | `--force` |
| `kit tag [source] [target]` | Tag a ModelKit with a new reference | — |
| `kit unpack [ref] -d [dir]` | Unpack ModelKit contents to a directory | `--model-only`, `--datasets-only` |

### Selective Unpack Examples

```bash
# Pull only the model weights (skip dataset layers)
kit pull ghcr.io/myorg/fraud-detection:v1.0.0 --model-only -d ./model/

# Pull only dataset layers
kit pull ghcr.io/myorg/fraud-detection:v1.0.0 --datasets-only -d ./data/

# Inspect without pulling
kit inspect ghcr.io/myorg/fraud-detection:v1.0.0 --format json | jq '.model'
```

---

## Kubeflow Model Registry REST API

Base URL: `http://localhost:8080/api/model_registry/v1alpha3`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/registered_models` | Create a new RegisteredModel |
| `GET` | `/registered_models` | List all models (supports `?pageSize=&orderBy=`) |
| `GET` | `/registered_models/{id}` | Get a specific model |
| `PATCH` | `/registered_models/{id}` | Update model name/description |
| `DELETE` | `/registered_models/{id}` | Delete model and all versions |
| `POST` | `/model_versions` | Create a new version |
| `GET` | `/model_versions/{id}` | Get version details |
| `PATCH` | `/model_versions/{id}` | Update state: `LIVE`, `ARCHIVED`, `DEPRECATED` |
| `POST` | `/model_artifacts` | Create a ModelArtifact with OCI URI |
| `GET` | `/model_artifacts/{id}` | Get artifact URI and details |

### Example: Register a model (REST)

```bash
curl -X POST http://localhost:8080/api/model_registry/v1alpha3/registered_models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "fraud-detection-model",
    "description": "XGBoost fraud detection classifier",
    "customProperties": {
      "team": {"string_value": "ml-engineering"},
      "project": {"string_value": "financial-risk"}
    }
  }'
```

### Example: Create a version

```bash
curl -X POST http://localhost:8080/api/model_registry/v1alpha3/model_versions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "v1.0.0",
    "registeredModelId": "1",
    "state": "LIVE",
    "customProperties": {
      "accuracy": {"string_value": "0.9835"},
      "framework": {"string_value": "xgboost"}
    }
  }'
```

### Example: Create an artifact

```bash
curl -X POST http://localhost:8080/api/model_registry/v1alpha3/model_artifacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "oci-artifact",
    "uri": "oci://localhost:5000/fraud-detection:v1.0.0",
    "artifactType": "model-artifact",
    "modelVersionId": "1"
  }'
```

---

## Kyverno Policy Pattern Library

### Pattern 1: Registry Allowlist

```yaml
validate:
  pattern:
    spec:
      containers:
        - image: "ghcr.io/myorg/*"
```

### Pattern 2: Required Labels

```yaml
validate:
  pattern:
    metadata:
      labels:
        model-name: "?*"
        model-version: "?*"
        team: "?*"
```

### Pattern 3: Deny Latest Tag

```yaml
validate:
  foreach:
    - list: "request.object.spec.containers"
      deny:
        conditions:
          any:
            - key: "{{ element.image }}"
              operator: Equals
              value: "*:latest"
```

### Pattern 4: Mutate — Add Annotations

```yaml
mutate:
  patchStrategicMerge:
    metadata:
      annotations:
        +(kitops.io/managed): "true"
        +(kitops.io/registry): "ghcr.io/myorg"
```

### Pattern 5: Audit-First Deployment

```yaml
spec:
  validationFailureAction: Audit  # Start here
  # Then switch to: Enforce
```

Monitor violations:
```bash
kubectl get policyreport -A -o wide
kubectl get clusterpolicyreport
```

---

## Kitfile Reference

```yaml
manifestVersion: 1.0.0  # Required

package:
  name: my-model           # Required: alphanumeric + hyphens
  version: 1.0.0           # Required: semver recommended
  description: "..."       # Optional
  authors: ["Name"]        # Optional

model:
  name: my-classifier      # Required
  path: ./model/           # Required: relative path
  framework: pytorch       # Optional: pytorch, tensorflow, xgboost, sklearn
  version: 2.0.0           # Optional: framework version
  license: Apache-2.0      # Optional: SPDX identifier

datasets:
  - name: training-data    # Required if present
    path: ./data/train/    # Required: relative path
    description: "..."     # Optional
    license: MIT           # Optional

code:
  - path: ./src/           # Required: relative path
    description: "..."     # Optional

docs:
  - path: ./README.md      # Optional
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **ModelKit** | An OCI artifact produced by KitOps containing ML model artifacts, datasets, code, and a Kitfile descriptor |
| **Kitfile** | A YAML manifest describing a ModelKit's contents, analogous to a Dockerfile for container images |
| **RegisteredModel** | Top-level entity in Kubeflow Model Registry representing a logical model across versions |
| **ModelVersion** | A specific trained version with metadata, metrics, and artifact references |
| **ModelArtifact** | A pointer to a stored artifact — in this integration, an `oci://` URI |
| **ClusterPolicy** | A Kyverno resource defining admission control rules applied cluster-wide |
| **Admission Webhook** | A Kubernetes extension intercepting API requests before persistence; used by Kyverno |
| **OCI** | Open Container Initiative — the standard governing container image and artifact formats |
| **Selective Unpack** | KitOps feature for partial ModelKit retrieval (e.g., model weights only) |
| **Digest Pinning** | Using `sha256:...` image references instead of mutable tags for immutability |
| **PolicyReport** | A Kyverno CRD containing audit results for all policy evaluations in a namespace |
| **WorkflowTemplate** | A reusable Argo Workflows resource defining parameterized workflow steps |

---

*Back to top: [README](../README.md)*
