import vault from "node-vault"
import { logger } from "./logger"
import { config } from "../config"

// Vault client instance
let vaultClient: vault.client

// Initialize Vault client
export const initVaultClient = async (): Promise<vault.client> => {
  if (vaultClient) {
    return vaultClient
  }

  try {
    // Create Vault client
    vaultClient = vault({
      apiVersion: "v1",
      endpoint: config.vault.url,
      token: process.env.VAULT_TOKEN, // Only used for initial setup
    })

    // If running in Kubernetes, authenticate using the service account token
    if (config.vault.kubernetesAuth) {
      const fs = await import("fs")
      const serviceAccountToken = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf8")

      const authResult = await vaultClient.kubernetesLogin({
        role: process.env.APP_NAME,
        jwt: serviceAccountToken,
      })

      // Set the client token to the one received from Kubernetes auth
      vaultClient.token = authResult.auth.client_token
      logger.info("Authenticated with Vault using Kubernetes auth")
    }

    logger.info("Vault client initialized")
    return vaultClient
  } catch (error) {
    logger.error("Error initializing Vault client:", error)
    throw error
  }
}

// Get Vault client
export const getVaultClient = (): vault.client => {
  if (!vaultClient) {
    throw new Error("Vault client not initialized")
  }
  return vaultClient
}

// Get secret from Vault\
export const getSecret = async <T>(path: string)
: Promise<T> =>
{
  try {
    const client = getVaultClient()
    const result = await client.read(path)
    return result.data as T;
  } catch (error) {
    logger.error(`Error getting secret from path ${path}:`, error)
    throw error
  }
}

// Get KV secret from Vault
export const getKVSecret = async <T>(path: string)
: Promise<T> =>
{
  try {
    const client = getVaultClient()
    const result = await client.read(`secret/data/${path}`)
    return result.data.data as T;
  } catch (error) {
    logger.error(`Error getting KV secret from path ${path}:`, error)
    throw error
  }
}

// Create or update KV secret in Vault
export const setKVSecret = async <T>(path: string, data: T)
: Promise<void> =>
{
  try {
    const client = getVaultClient()
    await client.write(`secret/data/${path}`, { data })
    logger.debug(`Secret set at path secret/data/${path}`)
  } catch (error) {
    logger.error(`Error setting KV secret at path ${path}:`, error)
    throw error
  }
}

// Get database credentials from Vault
export const getDatabaseCredentials = async (role: string): Promise<{ username: string; password: string }> => {
  try {
    const client = getVaultClient()
    const result = await client.read(`database/creds/${role}`)
    return {
      username: result.data.username,
      password: result.data.password,
    }
  } catch (error) {
    logger.error(`Error getting database credentials for role ${role}:`, error)
    throw error
  }
}

// Encrypt data using Transit engine
export const encryptData = async (keyName: string, plaintext: string): Promise<string> => {
  try {
    const client = getVaultClient()
    const result = await client.write(`transit/encrypt/${keyName}`, {
      plaintext: Buffer.from(plaintext).toString("base64"),
    })
    return result.data.ciphertext
  } catch (error) {
    logger.error(`Error encrypting data with key ${keyName}:`, error)
    throw error
  }
}

// Decrypt data using Transit engine
export const decryptData = async (keyName: string, ciphertext: string): Promise<string> => {
  try {
    const client = getVaultClient()
    const result = await client.write(`transit/decrypt/${keyName}`, {
      ciphertext,
    })
    return Buffer.from(result.data.plaintext, "base64").toString()
  } catch (error) {
    logger.error(`Error decrypting data with key ${keyName}:`, error)
    throw error
  }
}

// Generate HMAC using Transit engine
export const generateHMAC = async (keyName: string, data: string): Promise<string> => {
  try {
    const client = getVaultClient()
    const result = await client.write(`transit/hmac/${keyName}`, {
      input: Buffer.from(data).toString("base64"),
    })
    return result.data.hmac
  } catch (error) {
    logger.error(`Error generating HMAC with key ${keyName}:`, error)
    throw error
  }
}

// Verify HMAC using Transit engine
export const verifyHMAC = async (keyName: string, data: string, hmac: string): Promise<boolean> => {
  try {
    const client = getVaultClient()
    const result = await client.write(`transit/verify/${keyName}`, {
      input: Buffer.from(data).toString("base64"),
      hmac,
    })
    return result.data.valid
  } catch (error) {
    logger.error(`Error verifying HMAC with key ${keyName}:`, error)
    throw error
  }
}

// Generate a certificate using PKI engine
export const generateCertificate = async (
  role: string,
  commonName: string,
  ttl = "720h",
): Promise<{ certificate: string; privateKey: string; issuingCA: string }> => {
  try {
    const client = getVaultClient()
    const result = await client.write(`pki/issue/${role}`, {
      common_name: commonName,
      ttl,
    })
    return {
      certificate: result.data.certificate,
      privateKey: result.data.private_key,
      issuingCA: result.data.issuing_ca,
    }
  } catch (error) {
    logger.error(`Error generating certificate for ${commonName}:`, error)
    throw error
  }
}

export default {
  initVaultClient,
  getVaultClient,
  getSecret,
  getKVSecret,
  setKVSecret,
  getDatabaseCredentials,
  encryptData,
  decryptData,
  generateHMAC,
  verifyHMAC,
  generateCertificate,
}
