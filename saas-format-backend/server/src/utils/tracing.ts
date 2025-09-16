import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node"
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { PrismaInstrumentation } from "@prisma/instrumentation"
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis"
import { KafkaJsInstrumentation } from "opentelemetry-instrumentation-kafkajs"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk"
import { config } from "../config"

// Configure the trace exporter
const traceExporter = new OTLPTraceExporter({
  url: config.tracing.endpoint || "http://tempo:4318/v1/traces",
})

// Create a span processor
const spanProcessor = new BatchSpanProcessor(traceExporter)

// Create and configure the OpenTelemetry SDK
export const otelSDK = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.APP_NAME || "saas-platform",
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || "1.0.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
  }),
  spanProcessor,
  instrumentations: [
    // Get all auto-instrumentations
    getNodeAutoInstrumentations({
      // Customize instrumentations
      "@opentelemetry/instrumentation-fs": {
        enabled: false, // Disable file system instrumentation to reduce noise
      },
    }),
    // Add specific instrumentations with custom configurations
    new ExpressInstrumentation({
      ignoreLayers: [
        "express.router.layer", // Ignore router layers to reduce noise
      ],
    }),
    new HttpInstrumentation({
      ignoreIncomingPaths: ["/health", "/metrics", "/favicon.ico"],
    }),
    new PrismaInstrumentation(),
    new RedisInstrumentation(),
    new KafkaJsInstrumentation(),
    new PgInstrumentation(),
    new AwsInstrumentation({
      suppressInternalInstrumentation: true,
    }),
  ],
})

// Function to initialize tracing
export const initTracing = () => {
  if (config.tracing.enabled) {
    // Start the SDK
    otelSDK
      .start()
      .then(() => console.log("Tracing initialized"))
      .catch((error) => console.error("Error initializing tracing", error))

    // Handle shutdown
    const shutdownTracing = async () => {
      try {
        await otelSDK.shutdown()
        console.log("Tracing terminated")
      } catch (error) {
        console.error("Error terminating tracing", error)
      } finally {
        process.exit(0)
      }
    }

    // Register shutdown handlers
    process.on("SIGTERM", shutdownTracing)
    process.on("SIGINT", shutdownTracing)
  } else {
    console.log("Tracing is disabled")
  }
}

export default {
  initTracing,
}
