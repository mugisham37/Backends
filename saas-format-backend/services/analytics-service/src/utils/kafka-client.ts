import { Kafka, logLevel } from "kafkajs"
import { logger } from "./logger"

// Create Kafka client
const kafka = new Kafka({
  clientId: "analytics-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  logLevel: logLevel.WARN,
})

// Create producer
const producer = kafka.producer()

// Initialize producer
const initProducer = async () => {
  try {
    await producer.connect()
    logger.info("Kafka producer connected")
  } catch (error) {
    logger.error("Failed to connect Kafka producer:", error)
    throw error
  }
}

// Send message to Kafka topic
const sendMessage = async (topic: string, message: any): Promise<void> => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    })
  } catch (error) {
    logger.error(`Failed to send message to topic ${topic}:`, error)
    throw error
  }
}

// Create consumer
const createConsumer = (groupId: string) => {
  return kafka.consumer({ groupId })
}

export { initProducer, sendMessage, createConsumer }
