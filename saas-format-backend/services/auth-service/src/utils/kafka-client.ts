import { Kafka } from "kafkajs"
import { logger } from "./logger"

// Create Kafka client
const kafka = new Kafka({
  clientId: "auth-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
})

// Create producer
const producer = kafka.producer()

// Initialize producer
export const initProducer = async () => {
  try {
    await producer.connect()
    logger.info("Kafka producer connected")
  } catch (error) {
    logger.error(`Failed to connect Kafka producer: ${error instanceof Error ? error.message : String(error)}`)
    // Retry connection after delay
    setTimeout(initProducer, 5000)
  }
}

// Send message to Kafka topic
export const sendMessage = async (topic: string, message: any) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    })
    logger.debug(`Message sent to topic ${topic}`)
  } catch (error) {
    logger.error(`Failed to send message to Kafka: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// Create consumer
export const createConsumer = async (
  groupId: string,
  topics: string[],
  messageHandler: (message: any) => Promise<void>,
) => {
  const consumer = kafka.consumer({ groupId })

  try {
    await consumer.connect()
    logger.info(`Kafka consumer connected: ${groupId}`)

    // Subscribe to topics
    await Promise.all(topics.map((topic) => consumer.subscribe({ topic })))

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (message.value) {
            const parsedMessage = JSON.parse(message.value.toString())
            await messageHandler(parsedMessage)
          }
        } catch (error) {
          logger.error(`Error processing Kafka message: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    })

    return consumer
  } catch (error) {
    logger.error(`Failed to setup Kafka consumer: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// Graceful shutdown
export const shutdownKafka = async () => {
  try {
    await producer.disconnect()
    logger.info("Kafka producer disconnected")
  } catch (error) {
    logger.error(`Error disconnecting Kafka producer: ${error instanceof Error ? error.message : String(error)}`)
  }
}
