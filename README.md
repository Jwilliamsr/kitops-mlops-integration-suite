# 🚀 KitOps MLOps Integration Suite

> **GSoC 2026 Prototype** — Enriching KitOps Integration Guides with Kubeflow Model Registry, Argo Workflows & Kyverno

[![Packaged with KitOps](https://img.shields.io/badge/Packaged%20with-KitOps-FFAF52?labelColor=363636)](https://kitops.org)
[![Kubeflow](https://img.shields.io/badge/Kubeflow-Model%20Registry-orange?logo=kubernetes)](https://kubeflow.org)
[![Argo](https://img.shields.io/badge/Argo-Workflows-blueviolet?logo=argo)](https://argoproj.github.io)
[![Kyverno](https://img.shields.io/badge/Kyverno-Policy%20Engine-green?logo=kubernetes)](https://kyverno.io)
[![License](https://img.shields.io/badge/License-Apache%202.0-yellow)](LICENSE)

This repository is a **working prototype** for an end-to-end ML artifact lifecycle using:

| Tool | Role |
|------|------|
| 🧰 **KitOps** | OCI-based ML model packaging & distribution |
| 📋 **Kubeflow Model Registry** | Model versioning, metadata & lifecycle tracking |
| ⚙️ **Argo Workflows** | Automated ML pipeline orchestration |
| 🛡️ **Kyverno** | Kubernetes-native policy & governance enforcement |

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ML Artifact Lifecycle                       │
│                                                                  │
│  [Train] ──► [kit build] ──► [OCI Registry]                    │
│                                    │                            │
│               ┌────────────────────┼────────────────┐           │
│               ▼                    ▼                ▼           │
│      [Kubeflow Model       [Argo Workflows]    [Kyverno]        │
│        Registry]           (Automated          (Policy          │
│      Registers URI,         Pipeline)          Enforcement)     │
│      version, metadata                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
kitops-integration-suite/
├── README.md
├── docs/
│   ├── guide-01-kubeflow-model-registry.md
│   ├── guide-02-argo-workflows.md
│   ├── guide-03-kyverno.md
│   ├── tutorial-end-to-end.md
│   └── reference-appendix.md
├── kitfiles/
│   ├── fraud-detection.kitfile.yaml
│   └── sentiment-classifier.kitfile.yaml
├── scripts/
│   ├── train_fraud_model.py
│   ├── register_model.py
│   ├── retrieve_model.py
│   ├── check_prerequisites.sh
│   └── setup_environment.sh
├── workflows/
│   ├── ml-training-pipeline.yaml
│   ├── parameterized-workflow.yaml
│   └── model-packaging-only.yaml
├── policies/
│   ├── restrict-model-registry.yaml
│   ├── require-model-labels.yaml
│   ├── disallow-latest-tag.yaml
│   └── inject-model-metadata.yaml
├── docker/
│   └── kitops-executor/
│       └── Dockerfile
├── demo/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── tests/
    ├── policy-tests/
    │   └── kyverno-test.yaml
    └── validate_kitfile.py
```

---

## ⚡ Quick Start

### 1. Check Prerequisites

```bash
chmod +x scripts/check_prerequisites.sh
./scripts/check_prerequisites.sh
```

### 2. Set Up Your Environment

```bash
chmod +x scripts/setup_environment.sh
./scripts/setup_environment.sh
```

### 3. Train & Package the Model

```bash
# Train the fraud detection model
python scripts/train_fraud_model.py

# Build and push ModelKit
kit build . -t localhost:5000/fraud-detection:v1.0.0 -f kitfiles/fraud-detection.kitfile.yaml
kit push localhost:5000/fraud-detection:v1.0.0
```

### 4. Register in Kubeflow Model Registry

```bash
python scripts/register_model.py \
  --model-name fraud-detection \
  --version 1.0.0 \
  --uri oci://localhost:5000/fraud-detection:v1.0.0
```

### 5. Apply Kyverno Policies

```bash
kubectl apply -f policies/
```

### 6. Run Argo Workflow

```bash
kubectl apply -f workflows/ml-training-pipeline.yaml -n argo
argo submit --watch workflows/ml-training-pipeline.yaml -n argo
```

---

## 📚 Documentation Guides

| Guide | Description |
|-------|-------------|
| [Guide 1: Kubeflow Model Registry](docs/guide-01-kubeflow-model-registry.md) | Setup, model registration, retrieval & lifecycle |
| [Guide 2: Argo Workflows](docs/guide-02-argo-workflows.md) | Pipeline integration & automated packaging |
| [Guide 3: Kyverno](docs/guide-03-kyverno.md) | Policy definition & governance enforcement |
| [End-to-End Tutorial](docs/tutorial-end-to-end.md) | Complete 90-minute ML lifecycle walkthrough |
| [Reference Appendix](docs/reference-appendix.md) | CLI commands, API endpoints & policy patterns |

---

## 🎓 GSoC 2026 Context

This prototype was developed as part of the **Google Summer of Code 2026** proposal:

> **"Enrich KitOps Integration Guides with Kubeflow Model Registry, Argo Workflows & Kyverno"**
>
> Organization: KitOps | Upstream Issue: [kitops-ml/kitops#858](https://github.com/kitops-ml/kitops/issues/858)

**Author:** Satyam Kumar | B.Tech CS (AI) | Vedam School of Technology, ADYPU  
**Mentors:** Gorkem Ercan (Primary), Angel Misevski

---

## 🧑‍💻 Author

**Satyam Kumar**  
📧 krsatyamthakur@gmail.com  
🐙 [@krsatyamthakur-droid](https://github.com/krsatyamthakur-droid)  
💼 [LinkedIn](https://www.linkedin.com/in/satyamrkr)

---

## 📄 License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
