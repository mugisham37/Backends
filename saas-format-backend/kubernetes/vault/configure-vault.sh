#!/bin/bash

# Configure HashiCorp Vault after installation

# Set environment variables
export VAULT_ADDR="https://vault.${DOMAIN_NAME}"
export VAULT_TOKEN=$(cat vault-root-token.txt)
export VAULT_SKIP_VERIFY=true

# Enable audit logging
vault audit enable file file_path=/vault/audit/audit.log

# Enable secrets engines
echo "Enabling secrets engines..."
vault secrets enable -path=secret kv-v2
vault secrets enable database
vault secrets enable pki
vault secrets enable transit

# Configure PKI secrets engine
echo "Configuring PKI secrets engine..."
vault secrets tune -max-lease-ttl=87600h pki
vault write pki/root/generate/internal \
  common_name="${DOMAIN_NAME} Root CA" \
  ttl=87600h

vault write pki/config/urls \
  issuing_certificates="${VAULT_ADDR}/v1/pki/ca" \
  crl_distribution_points="${VAULT_ADDR}/v1/pki/crl"

# Create PKI role
vault write pki/roles/saas-platform \
  allowed_domains="${DOMAIN_NAME}" \
  allow_subdomains=true \
  max_ttl=72h

# Configure database secrets engine for PostgreSQL
echo "Configuring database secrets engine for PostgreSQL..."
vault write database/config/postgres \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@${DB_HOST}:5432/postgres?sslmode=require" \
  allowed_roles="readonly,readwrite" \
  username="${DB_ADMIN_USER}" \
  password="${DB_ADMIN_PASSWORD}"

# Create database roles
vault write database/roles/readonly \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
                      GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

vault write database/roles/readwrite \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
                      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

# Configure transit secrets engine
echo "Configuring transit secrets engine..."
vault write -f transit/keys/saas-platform
vault write -f transit/keys/saas-platform-hmac

# Enable authentication methods
echo "Enabling authentication methods..."
vault auth enable kubernetes
vault auth enable approle

# Configure Kubernetes authentication
echo "Configuring Kubernetes authentication..."
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

# Create policies
echo "Creating policies..."

# API Gateway policy
vault policy write api-gateway - <<EOF
path "secret/data/api-gateway/*" {
  capabilities = ["read", "list"]
}
path "transit/encrypt/saas-platform" {
  capabilities = ["update"]
}
path "transit/decrypt/saas-platform" {
  capabilities = ["update"]
}
EOF

# Auth Service policy
vault policy write auth-service - <<EOF
path "secret/data/auth-service/*" {
  capabilities = ["read", "list"]
}
path "transit/encrypt/saas-platform" {
  capabilities = ["update"]
}
path "transit/decrypt/saas-platform" {
  capabilities = ["update"]
}
path "transit/hmac/saas-platform-hmac" {
  capabilities = ["update"]
}
path "transit/verify/saas-platform-hmac" {
  capabilities = ["update"]
}
EOF

# Tenant Service policy
vault policy write tenant-service - <<EOF
path "secret/data/tenant-service/*" {
  capabilities = ["read", "list"]
}
path "database/creds/readwrite" {
  capabilities = ["read"]
}
EOF

# User Service policy
vault policy write user-service - <<EOF
path "secret/data/user-service/*" {
  capabilities = ["read", "list"]
}
path "database/creds/readwrite" {
  capabilities = ["read"]
}
path "transit/encrypt/saas-platform" {
  capabilities = ["update"]
}
path "transit/decrypt/saas-platform" {
  capabilities = ["update"]
}
EOF

# Project Service policy
vault policy write project-service - <<EOF
path "secret/data/project-service/*" {
  capabilities = ["read", "list"]
}
path "database/creds/readwrite" {
  capabilities = ["read"]
}
EOF

# Billing Service policy
vault policy write billing-service - <<EOF
path "secret/data/billing-service/*" {
  capabilities = ["read", "list"]
}
path "database/creds/readwrite" {
  capabilities = ["read"]
}
path "transit/encrypt/saas-platform" {
  capabilities = ["update"]
}
path "transit/decrypt/saas-platform" {
  capabilities = ["update"]
}
EOF

# Feature Service policy
vault policy write feature-service - <<EOF
path "secret/data/feature-service/*" {
  capabilities = ["read", "list"]
}
path "database/creds/readwrite" {
  capabilities = ["read"]
}
EOF

# Create Kubernetes authentication roles
echo "Creating Kubernetes authentication roles..."

vault write auth/kubernetes/role/api-gateway \
  bound_service_account_names=api-gateway \
  bound_service_account_namespaces=default \
  policies=api-gateway \
  ttl=1h

vault write auth/kubernetes/role/auth-service \
  bound_service_account_names=auth-service \
  bound_service_account_namespaces=default \
  policies=auth-service \
  ttl=1h

vault write auth/kubernetes/role/tenant-service \
  bound_service_account_names=tenant-service \
  bound_service_account_namespaces=default \
  policies=tenant-service \
  ttl=1h

vault write auth/kubernetes/role/user-service \
  bound_service_account_names=user-service \
  bound_service_account_namespaces=default \
  policies=user-service \
  ttl=1h

vault write auth/kubernetes/role/project-service \
  bound_service_account_names=project-service \
  bound_service_account_namespaces=default \
  policies=project-service \
  ttl=1h

vault write auth/kubernetes/role/billing-service \
  bound_service_account_names=billing-service \
  bound_service_account_namespaces=default \
  policies=billing-service \
  ttl=1h

vault write auth/kubernetes/role/feature-service \
  bound_service_account_names=feature-service \
  bound_service_account_namespaces=default \
  policies=feature-service \
  ttl=1h

# Store secrets
echo "Storing secrets..."

# API Gateway secrets
vault kv put secret/api-gateway/config \
  jwt_secret="${JWT_SECRET}" \
  jwt_expiry="${JWT_EXPIRY}" \
  redis_url="${REDIS_URL}" \
  auth_service_url="${AUTH_SERVICE_URL}" \
  tenant_service_url="${TENANT_SERVICE_URL}" \
  user_service_url="${USER_SERVICE_URL}" \
  project_service_url="${PROJECT_SERVICE_URL}" \
  billing_service_url="${BILLING_SERVICE_URL}" \
  feature_service_url="${FEATURE_SERVICE_URL}"

# Auth Service secrets
vault kv put secret/auth-service/config \
  jwt_secret="${JWT_SECRET}" \
  jwt_expiry="${JWT_EXPIRY}" \
  refresh_token_expiry="${REFRESH_TOKEN_EXPIRY}" \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${AUTH_DB_URL}"

# Tenant Service secrets
vault kv put secret/tenant-service/config \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${TENANT_DB_URL}"

# User Service secrets
vault kv put secret/user-service/config \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${USER_DB_URL}"

# Project Service secrets
vault kv put secret/project-service/config \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${PROJECT_DB_URL}"

# Billing Service secrets
vault kv put secret/billing-service/config \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${BILLING_DB_URL}" \
  stripe_secret_key="${STRIPE_SECRET_KEY}" \
  stripe_webhook_secret="${STRIPE_WEBHOOK_SECRET}"

# Feature Service secrets
vault kv put secret/feature-service/config \
  redis_url="${REDIS_URL}" \
  kafka_brokers="${KAFKA_BROKERS}" \
  database_url="${FEATURE_DB_URL}"

echo "Vault configuration completed successfully!"
