# KitOps MLOps Executor
# Used as the container image for KitOps packaging steps in Argo Workflows.
# Includes: KitOps CLI, Kubeflow Model Registry Python SDK, requests

FROM python:3.11-slim

LABEL maintainer="Satyam Kumar <krsatyamthakur@gmail.com>"
LABEL description="KitOps executor image for Argo Workflows ML pipelines"
LABEL org.opencontainers.image.source="https://github.com/krsatyamthakur-droid/kitops-mlops-suite"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install KitOps CLI (latest release)
RUN KITOPS_VERSION=$(curl -s "https://api.github.com/repos/kitops-ml/kitops/releases/latest" \
        | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/') \
    && curl -sL \
        "https://github.com/kitops-ml/kitops/releases/download/${KITOPS_VERSION}/kitops-linux-amd64.tar.gz" \
        | tar -xz -C /tmp \
    && mv /tmp/kit /usr/local/bin/kit \
    && chmod +x /usr/local/bin/kit \
    && echo "Installed KitOps ${KITOPS_VERSION}"

# Install Python dependencies
RUN pip install --no-cache-dir \
    model-registry==0.2.6 \
    requests \
    xgboost \
    scikit-learn \
    pandas \
    numpy

# Verify installations
RUN kit version \
    && python -c "from model_registry import ModelRegistry; print('Model Registry SDK: OK')" \
    && python -c "import xgboost; print(f'XGBoost: {xgboost.__version__}')"

# Set working directory
WORKDIR /workspace

# Default entrypoint
ENTRYPOINT ["/bin/bash"]
