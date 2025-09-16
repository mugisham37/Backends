#!/bin/bash

# Install monitoring stack in Kubernetes

# Create namespace
kubectl create namespace monitoring

# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  -f prometheus-values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  -f grafana-values.yaml

# Install Loki
helm install loki grafana/loki-stack \
  --namespace monitoring \
  -f loki-values.yaml

# Install Tempo
helm install tempo grafana/tempo \
  --namespace monitoring \
  -f tempo-values.yaml

# Wait for deployments to be ready
echo "Waiting for Prometheus to be ready..."
kubectl rollout status deployment/prometheus-server -n monitoring

echo "Waiting for Grafana to be ready..."
kubectl rollout status deployment/grafana -n monitoring

echo "Waiting for Loki to be ready..."
kubectl rollout status statefulset/loki -n monitoring

echo "Waiting for Tempo to be ready..."
kubectl rollout status deployment/tempo -n monitoring

# Get Grafana admin password
GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
echo "Grafana admin password: $GRAFANA_PASSWORD"

# Get Grafana URL
GRAFANA_URL=$(kubectl get ingress -n monitoring grafana -o jsonpath="{.spec.rules[0].host}")
echo "Grafana URL: http://$GRAFANA_URL"

echo "Monitoring stack installed successfully!"
