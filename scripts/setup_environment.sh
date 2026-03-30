#!/bin/bash
# ============================================================
# KitOps MLOps Integration Suite — Environment Setup
# GSoC 2026 Prototype
# ============================================================
# This script sets up the full environment for all guides:
#   - minikube (if not already running)
#   - Local Docker registry
#   - Kubeflow Model Registry (via Helm)
#   - Argo Workflows (via Helm)
#   - Kyverno (via Helm)
#   - Kubernetes namespaces
#   - Python dependencies
# ============================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BLUE}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   KitOps MLOps Suite — Environment Setup               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# ── Python dependencies ──────────────────────────────────────
step "Installing Python dependencies"
pip3 install --quiet \
    xgboost \
    scikit-learn \
    pandas \
    numpy \
    model-registry \
    requests
ok "Python packages installed"

# ── Local OCI Registry ───────────────────────────────────────
step "Starting local Docker registry"
if docker ps --format '{{.Names}}' | grep -q "^local-registry$"; then
    ok "Local registry already running at localhost:5000"
else
    docker run -d -p 5000:5000 --name local-registry registry:2
    ok "Local registry started at localhost:5000"
fi

# ── Kubernetes cluster ───────────────────────────────────────
step "Checking Kubernetes cluster"
if ! kubectl cluster-info &>/dev/null 2>&1; then
    warn "No cluster detected. Starting minikube..."

    if command -v minikube &>/dev/null; then
        minikube start \
            --cpus=4 \
            --memory=8192 \
            --disk-size=40g \
            --driver=docker
        ok "minikube started"
    else
        err "minikube not found. Please install minikube or start another cluster."
        echo "   brew install minikube"
        exit 1
    fi
else
    ok "Kubernetes cluster is running"
fi

# ── Namespaces ───────────────────────────────────────────────
step "Creating namespaces"
for ns in kubeflow argo kyverno ml-production ml-staging ml-dev; do
    if kubectl get namespace "$ns" &>/dev/null 2>&1; then
        ok "Namespace '$ns' already exists"
    else
        kubectl create namespace "$ns"
        ok "Created namespace '$ns'"
    fi
done

# ── Kubeflow Model Registry ──────────────────────────────────
step "Installing Kubeflow Model Registry (via Helm)"
helm repo add kubeflow https://kubeflow.github.io/model-registry/ --force-update &>/dev/null
helm repo update &>/dev/null

if helm status model-registry -n kubeflow &>/dev/null 2>&1; then
    ok "Kubeflow Model Registry already installed"
else
    helm install model-registry kubeflow/model-registry-operator \
        --namespace kubeflow \
        --set modelRegistry.dbType=sqlite \
        --wait \
        --timeout 5m
    ok "Kubeflow Model Registry installed"
fi

# ── Argo Workflows ───────────────────────────────────────────
step "Installing Argo Workflows (via Helm)"
helm repo add argo https://argoproj.github.io/argo-helm --force-update &>/dev/null
helm repo update &>/dev/null

if helm status argo-workflows -n argo &>/dev/null 2>&1; then
    ok "Argo Workflows already installed"
else
    helm install argo-workflows argo/argo-workflows \
        --namespace argo \
        --set controller.containerRuntimeExecutor=k8sapi \
        --set server.authMode=server \
        --wait \
        --timeout 5m
    ok "Argo Workflows installed"
fi

# ── Kyverno ──────────────────────────────────────────────────
step "Installing Kyverno (via Helm)"
helm repo add kyverno https://kyverno.github.io/kyverno/ --force-update &>/dev/null
helm repo update &>/dev/null

if helm status kyverno -n kyverno &>/dev/null 2>&1; then
    ok "Kyverno already installed"
else
    helm install kyverno kyverno/kyverno \
        --namespace kyverno \
        --set replicaCount=1 \
        --wait \
        --timeout 5m
    ok "Kyverno installed"
fi

# ── Port-forwards ────────────────────────────────────────────
step "Setting up port-forwards"
# Kill any existing port-forwards on these ports
pkill -f "kubectl port-forward.*8080" 2>/dev/null || true
pkill -f "kubectl port-forward.*2746" 2>/dev/null || true

sleep 1

kubectl port-forward svc/model-registry-service 8080:8080 -n kubeflow &>/dev/null &
ok "Kubeflow Model Registry → http://localhost:8080"

kubectl port-forward svc/argo-workflows-server 2746:2746 -n argo &>/dev/null &
ok "Argo Workflows UI → http://localhost:2746"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Environment setup complete!${NC}"
echo ""
echo -e "  Services:"
echo -e "  • Kubeflow Model Registry  → ${BLUE}http://localhost:8080${NC}"
echo -e "  • Argo Workflows UI        → ${BLUE}http://localhost:2746${NC}"
echo -e "  • Local OCI Registry       → ${BLUE}localhost:5000${NC}"
echo ""
echo -e "  Next steps:"
echo -e "  ${BLUE}1.${NC} python scripts/train_fraud_model.py"
echo -e "  ${BLUE}2.${NC} kit build . -t localhost:5000/fraud-detection:v1.0.0 -f kitfiles/fraud-detection.kitfile.yaml"
echo -e "  ${BLUE}3.${NC} kit push localhost:5000/fraud-detection:v1.0.0 --plain-http"
echo -e "  ${BLUE}4.${NC} python scripts/register_model.py --model-name fraud-detection --version 1.0.0 --uri oci://localhost:5000/fraud-detection:v1.0.0"
echo ""
