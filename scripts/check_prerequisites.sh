#!/bin/bash
# ============================================================
# KitOps MLOps Integration Suite — Prerequisites Check
# GSoC 2026 Prototype
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_command() {
    local cmd=$1
    local label=$2
    local hint=$3

    if command -v "$cmd" &>/dev/null; then
        echo -e "  ${GREEN}[OK]${NC}     $label ($(command -v $cmd))"
        ((PASS++)) || true
    else
        echo -e "  ${RED}[MISSING]${NC} $label"
        if [ -n "$hint" ]; then
            echo -e "           ${YELLOW}→ $hint${NC}"
        fi
        ((FAIL++)) || true
    fi
}

check_version() {
    local cmd=$1
    local label=$2
    local min_version=$3
    local version_flag=${4:-"--version"}

    if command -v "$cmd" &>/dev/null; then
        local version=$("$cmd" $version_flag 2>&1 | head -n1)
        echo -e "  ${GREEN}[OK]${NC}     $label ($version)"
        ((PASS++)) || true
    else
        echo -e "  ${RED}[MISSING]${NC} $label"
        ((FAIL++)) || true
    fi
}

check_python_pkg() {
    local pkg=$1
    local label=$2

    if python3 -c "import $pkg" &>/dev/null 2>&1; then
        local version=$(python3 -c "import $pkg; print(getattr($pkg, '__version__', 'installed'))" 2>/dev/null)
        echo -e "  ${GREEN}[OK]${NC}     $label (v$version)"
        ((PASS++)) || true
    else
        echo -e "  ${YELLOW}[WARN]${NC}   $label (not installed — run: pip install $pkg)"
        ((WARN++)) || true
    fi
}

check_k8s_namespace() {
    local ns=$1
    if kubectl get namespace "$ns" &>/dev/null 2>&1; then
        local pods=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | grep -c "Running" || echo 0)
        echo -e "  ${GREEN}[OK]${NC}     Namespace: $ns ($pods running pods)"
        ((PASS++)) || true
    else
        echo -e "  ${YELLOW}[WARN]${NC}   Namespace: $ns (not found — will be created during setup)"
        ((WARN++)) || true
    fi
}

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   KitOps MLOps Integration Suite — Prerequisites       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}▶ Core CLI Tools${NC}"
check_command "kit"     "KitOps CLI"     "Install: https://kitops.ml/docs/cli/installation"
check_command "kubectl" "kubectl"        "Install: https://kubernetes.io/docs/tasks/tools/"
check_command "helm"    "Helm v3"        "Install: https://helm.sh/docs/intro/install/"
check_command "docker"  "Docker"         "Install: https://docs.docker.com/get-docker/"
check_command "argo"    "Argo CLI"       "Install: brew install argo (or see argoproj.github.io)"
check_command "kyverno" "Kyverno CLI"    "Install: brew install kyverno"

echo ""
echo -e "${BLUE}▶ Language Runtime${NC}"
check_version "python3" "Python 3"       "3.10+"
check_command "pip3"    "pip3"           "Comes with Python 3"
check_command "go"      "Go"             "Install: https://go.dev/dl/"

echo ""
echo -e "${BLUE}▶ Python SDK Dependencies${NC}"
check_python_pkg "xgboost"         "xgboost"
check_python_pkg "sklearn"         "scikit-learn"
check_python_pkg "pandas"          "pandas"
check_python_pkg "numpy"           "numpy"
check_python_pkg "model_registry"  "model-registry (Kubeflow SDK)"

echo ""
echo -e "${BLUE}▶ Kubernetes Cluster${NC}"
if kubectl cluster-info &>/dev/null 2>&1; then
    CLUSTER_URL=$(kubectl cluster-info 2>/dev/null | head -1 | sed 's/.*at //')
    echo -e "  ${GREEN}[OK]${NC}     Kubernetes cluster ($CLUSTER_URL)"
    ((PASS++)) || true

    echo ""
    echo -e "${BLUE}▶ Required Namespaces${NC}"
    check_k8s_namespace "kubeflow"
    check_k8s_namespace "argo"
    check_k8s_namespace "kyverno"
    check_k8s_namespace "ml-production"
    check_k8s_namespace "ml-staging"
else
    echo -e "  ${RED}[MISSING]${NC} Kubernetes cluster (not reachable)"
    echo -e "           ${YELLOW}→ Start minikube: minikube start --cpus=4 --memory=8192${NC}"
    ((FAIL++)) || true
fi

echo ""
echo -e "${BLUE}▶ Local OCI Registry${NC}"
if curl -s http://localhost:5000/v2/ &>/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${NC}     Local Docker registry (localhost:5000)"
    ((PASS++)) || true
else
    echo -e "  ${YELLOW}[WARN]${NC}   Local Docker registry not running"
    echo -e "           ${YELLOW}→ Start: docker run -d -p 5000:5000 --name local-registry registry:2${NC}"
    ((WARN++)) || true
fi

echo ""
echo -e "────────────────────────────────────────────────────────"
echo -e "  Results: ${GREEN}$PASS passed${NC}  |  ${YELLOW}$WARN warnings${NC}  |  ${RED}$FAIL failed${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "  ${GREEN}✅ All required prerequisites satisfied!${NC}"
    echo -e "  ${BLUE}→ Run ./scripts/setup_environment.sh to deploy the stack${NC}"
else
    echo -e "  ${RED}❌ $FAIL required tool(s) missing. Please install them before proceeding.${NC}"
fi
echo ""
