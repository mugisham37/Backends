#!/bin/bash

# Install HashiCorp Vault in Kubernetes

# Create namespace
kubectl create namespace vault

# Add Helm repository
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

# Install Vault
helm install vault hashicorp/vault \
  --namespace vault \
  -f vault-values.yaml

# Wait for Vault to be ready
echo "Waiting for Vault to be ready..."
kubectl rollout status statefulset/vault -n vault

# Initialize Vault (only if not already initialized)
INITIALIZED=$(kubectl exec -n vault vault-0 -- vault status -format=json | jq -r '.initialized')
if [ "$INITIALIZED" == "false" ]; then
  echo "Initializing Vault..."
  INIT_RESPONSE=$(kubectl exec -n vault vault-0 -- vault operator init -key-shares=5 -key-threshold=3 -format=json)
  
  # Save unseal keys and root token
  echo "$INIT_RESPONSE" | jq -r '.unseal_keys_b64[]' > vault-unseal-keys.txt
  echo "$INIT_RESPONSE" | jq -r '.root_token' > vault-root-token.txt
  
  echo "Vault initialized. Unseal keys saved to vault-unseal-keys.txt and root token saved to vault-root-token.txt"
  echo "IMPORTANT: Store these securely and delete these files after use!"
  
  # Unseal Vault
  echo "Unsealing Vault..."
  UNSEAL_KEYS=$(cat vault-unseal-keys.txt)
  for i in 0 1 2; do
    for key in $(echo "$UNSEAL_KEYS" | head -n 3); do
      kubectl exec -n vault vault-$i -- vault operator unseal $key
    done
  done
  
  echo "Vault unsealed successfully!"
fi

# Get Vault URL
VAULT_URL=$(kubectl get ingress -n vault vault -o jsonpath="{.spec.rules[0].host}")
echo "Vault URL: https://$VAULT_URL"

echo "Vault installed successfully!"
