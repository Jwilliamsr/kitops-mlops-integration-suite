# Guide 3: KitOps + Kyverno Policy Engine

> **Objective:** Use Kyverno to enforce governance policies on ML artifacts managed by KitOps — ensuring only approved, validated, and correctly labeled ModelKits appear in production.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Step 1 — Install Kyverno](#step-1--install-kyverno)
5. [Policy 1 — Restrict Approved Registries](#policy-1--restrict-approved-registries)
6. [Policy 2 — Require ModelKit Labels](#policy-2--require-modelkit-labels)
7. [Policy 3 — Disallow Latest Tag in Production](#policy-3--disallow-latest-tag-in-production)
8. [Policy 4 — Auto-Inject ModelKit Metadata (Mutating)](#policy-4--auto-inject-modelkit-metadata-mutating)
9. [Step 6 — Test Policies with Kyverno CLI](#step-6--test-policies-with-kyverno-cli)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

As organizations scale ML operations, ensuring that only approved ModelKits reach production is a critical compliance requirement. Kyverno provides a **Kubernetes-native** way to enforce these constraints using plain YAML — no Rego, no separate policy language.

**Why Kyverno for ML governance:**

| Concern | Kyverno Solution |
|---------|-----------------|
| Unauthorized registries | Validate image source via regex patterns |
| Missing model labels | Validate required metadata labels |
| Mutable image tags | Enforce digest-pinned references |
| Missing audit trail | Mutate pods to add `kitops.io/*` annotations |
| New team members | Admit-then-warn, then enforce gradually |

---

## Prerequisites

- Running Kubernetes cluster with `kubectl` access
- `helm` v3.x
- Kyverno CLI installed
- Namespaces: `ml-production`, `ml-staging`, `ml-dev`

```bash
# Create namespaces
kubectl create namespace ml-production
kubectl create namespace ml-staging
kubectl create namespace ml-dev
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Kubernetes API Server                    │
│                                                              │
│   kubectl apply / Argo Workflow                              │
│         │                                                    │
│         ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Kyverno Admission Controller            │   │
│   │                                                      │   │
│   │   1. Mutate: Inject kitops.io/* annotations         │   │
│   │   2. Validate: Check registry source                │   │
│   │   3. Validate: Require model labels                 │   │
│   │   4. Validate: No :latest in production             │   │
│   │                                                      │   │
│   │   ALLOW ──► Resource created                        │   │
│   │   DENY  ──► Error returned to caller                │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Install Kyverno

### 1a. Install via Helm

```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

helm install kyverno kyverno/kyverno \
  --namespace kyverno \
  --create-namespace \
  --set replicaCount=1 \
  --wait
```

### 1b. Verify Installation

```bash
kubectl get pods -n kyverno
# NAME                                             READY   STATUS    RESTARTS
# kyverno-admission-controller-xxxx-yyyy           1/1     Running   0
# kyverno-background-controller-xxxx-yyyy          1/1     Running   0
# kyverno-cleanup-controller-xxxx-yyyy             1/1     Running   0
# kyverno-reports-controller-xxxx-yyyy             1/1     Running   0
```

### 1c. Install Kyverno CLI (macOS)

```bash
brew install kyverno
kyverno version
```

---

## Policy 1 — Restrict Approved Registries

This policy ensures model containers are only pulled from your organization's **approved OCI registries**.

```yaml
# policies/restrict-model-registry.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-model-registry
  annotations:
    policies.kyverno.io/title: Restrict Model Registry Sources
    policies.kyverno.io/category: ML Governance
    policies.kyverno.io/severity: high
    policies.kyverno.io/subject: Pod
    policies.kyverno.io/description: >
      Ensures model containers are pulled only from approved KitOps registries.
      Any pod running in ml-production must reference images from ghcr.io/myorg.
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: check-model-registry
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - ml-production
      validate:
        message: >
          Model images must come from approved registries: ghcr.io/myorg.
          Got: {{ request.object.spec.containers[0].image }}.
          Contact your ML Platform team if you need a new registry added.
        pattern:
          spec:
            containers:
              - image: "ghcr.io/myorg/*"
```

Apply and verify:
```bash
kubectl apply -f policies/restrict-model-registry.yaml

# Test: approved registry (should succeed)
kubectl run ok-pod \
  --image=ghcr.io/myorg/fraud-detection:v1.0.0 \
  --namespace=ml-production \
  --dry-run=server

# Test: unapproved registry (should be blocked)
kubectl run bad-pod \
  --image=docker.io/random/model:latest \
  --namespace=ml-production \
  --dry-run=server
# Expected: Error from server: admission webhook denied the request
```

---

## Policy 2 — Require ModelKit Labels

Ensures every model workload has the required metadata labels for traceability.

```yaml
# policies/require-model-labels.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-model-labels
  annotations:
    policies.kyverno.io/title: Require ModelKit Metadata Labels
    policies.kyverno.io/category: ML Governance
    policies.kyverno.io/severity: medium
    policies.kyverno.io/description: >
      All model pods in ml-production and ml-staging must have required
      labels for traceability: model-name, model-version, and team.
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-model-labels
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - ml-production
                - ml-staging
      validate:
        message: >
          ModelKit pods must have the following labels:
          'model-name', 'model-version', and 'team'.
          Add these labels to your pod spec metadata.
        pattern:
          metadata:
            labels:
              model-name: "?*"
              model-version: "?*"
              team: "?*"
```

Example compliant pod spec:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fraud-inference
  namespace: ml-production
  labels:
    model-name: fraud-detection
    model-version: "1.0.0"
    team: ml-engineering
spec:
  containers:
    - name: inference
      image: ghcr.io/myorg/fraud-detection:v1.0.0
```

---

## Policy 3 — Disallow Latest Tag in Production

Prevents use of mutable `:latest` tags in production — every model must be digest-pinned or use a semantic version.

```yaml
# policies/disallow-latest-tag.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-model-tag
  annotations:
    policies.kyverno.io/title: Disallow Latest Model Tag in Production
    policies.kyverno.io/category: ML Governance
    policies.kyverno.io/severity: high
    policies.kyverno.io/description: >
      Production model images must use digest pinning (sha256:...) or
      semantic version tags. The :latest tag is mutable and breaks
      reproducibility guarantees.
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-no-latest-tag
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - ml-production
      validate:
        message: >
          Production model images must NOT use the ':latest' tag.
          Use a semantic version (v1.0.0) or digest (sha256:...) instead.
          Current image: {{ request.object.spec.containers[0].image }}
        foreach:
          - list: "request.object.spec.containers"
            deny:
              conditions:
                any:
                  - key: "{{ element.image }}"
                    operator: Equals
                    value: "*:latest"
                  - key: "{{ element.image }}"
                    operator: Equals
                    value: "*/latest"
```

---

## Policy 4 — Auto-Inject ModelKit Metadata (Mutating)

Automatically adds `kitops.io/*` annotations to all model pods for audit visibility.

```yaml
# policies/inject-model-metadata.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: inject-model-metadata
  annotations:
    policies.kyverno.io/title: Inject KitOps Model Metadata
    policies.kyverno.io/category: ML Governance
    policies.kyverno.io/description: >
      Automatically injects kitops.io/* annotations on model pods for
      full audit trail visibility in production and staging.
spec:
  rules:
    - name: add-kitops-annotations
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - ml-production
                - ml-staging
      mutate:
        patchStrategicMerge:
          metadata:
            annotations:
              +(kitops.io/managed): "true"
              +(kitops.io/registry): "ghcr.io/myorg"
              +(kitops.io/packaged-by): "kitops-argo-pipeline"
              +(kitops.io/policy-version): "v1.0"
```

The `+()` prefix means: add annotation **only if it doesn't already exist** (non-overwriting mutation).

---

## Step 6 — Test Policies with Kyverno CLI

The Kyverno CLI allows you to test all policies offline, without applying them to a live cluster.

### Test setup

Create a test spec:

```yaml
# tests/policy-tests/kyverno-test.yaml
name: ml-policy-tests
policies:
  - ../../policies/restrict-model-registry.yaml
  - ../../policies/require-model-labels.yaml
  - ../../policies/disallow-latest-tag.yaml
resources:
  - test-resources.yaml
results:
  - policy: restrict-model-registry
    rule: check-model-registry
    resource: compliant-pod
    result: pass
  - policy: restrict-model-registry
    rule: check-model-registry
    resource: noncompliant-pod
    result: fail
  - policy: disallow-latest-model-tag
    rule: check-no-latest-tag
    resource: latest-tag-pod
    result: fail
```

Run all tests:
```bash
kyverno test tests/policy-tests/
```

Expected output:
```
Policy Report Summary:

┌─────────────────────────────────────────┬──────┬────────┬─────┐
│ Policy                                  │ Pass │ Fail   │ Skip│
├─────────────────────────────────────────┼──────┼────────┼─────┤
│ restrict-model-registry                 │  1   │  1     │  0  │
│ require-model-labels                    │  1   │  1     │  0  │
│ disallow-latest-model-tag               │  1   │  1     │  0  │
└─────────────────────────────────────────┴──────┴────────┴─────┘
Test Summary: 6 tests, 3 pass, 3 expected-fail
```

---

## Best Practices

1. **Audit before Enforce** — Always start with `validationFailureAction: Audit` to log violations without blocking. Monitor `PolicyReport` CRDs for a week before switching to `Enforce`.

   ```bash
   kubectl get policyreport -A
   kubectl describe policyreport -n ml-production
   ```

2. **Use namespace selectors for scoping** — Apply strict `Enforce` only in `ml-production`. Use `Audit` in `ml-staging` and skip entirely for `ml-dev`.

3. **Combine validate and mutate** — Mutate to add required labels if missing in dev; validate to strictly enforce them in production.

4. **Version policies in Git** — Store `ClusterPolicy` YAML in your Git repository alongside application code for full GitOps auditability.

5. **Use policy exceptions carefully** — Kyverno supports `PolicyException` CRDs for specific workloads that need to bypass a rule. Always document and time-bound exceptions.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Webhook timeout causing cluster issues | Kyverno pod not ready | Kyverno has fail-open (`webhookFailurePolicy: Ignore`) by default — check Kyverno pod logs |
| Policy not triggering | Wrong namespace selector | Check `namespaces:` field in `match.any` |
| Mutation not applying | Resource already has annotation | Kyverno respects `+()` syntax — check if annotation already set |
| `kyverno test` YAML parse error | Incorrect test spec format | Run `kyverno test --detailed-results` for verbose output |

---

*Previous: [Guide 2 — KitOps + Argo Workflows](guide-02-argo-workflows.md)*  
*Next: [End-to-End Tutorial](tutorial-end-to-end.md)*
