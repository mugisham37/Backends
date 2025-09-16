import autocannon from "autocannon"
import fs from "fs"
import path from "path"
import { logger } from "../../utils/logger"

// Load test configuration
interface LoadTestConfig {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: any
  duration: number
  connections: number
  pipelining: number
  workers?: number
  scenarios?: {
    name: string
    weight: number
    requests: Array<{
      url: string
      method: "GET" | "POST" | "PUT" | "DELETE"
      headers?: Record<string, string>
      body?: any
    }>
  }[]
}

// Load test result
interface LoadTestResult {
  url: string
  method: string
  duration: number
  connections: number
  pipelining: number
  workers?: number
  requests: {
    total: number
    average: number
    min: number
    max: number
  }
  latency: {
    average: number
    min: number
    max: number
    p50: number
    p75: number
    p90: number
    p99: number
  }
  throughput: {
    total: number
    average: number
    min: number
    max: number
  }
  errors: number
  timeouts: number
  non2xx: number
  scenarioResults?: Record<
    string,
    {
      requests: {
        total: number
        average: number
      }
      latency: {
        average: number
        p99: number
      }
      errors: number
    }
  >
  timestamp: string
}

// Run a load test
export const runLoadTest = async (config: LoadTestConfig): Promise<LoadTestResult> => {
  logger.info(`Starting load test for ${config.method} ${config.url}`)
  logger.info(`Duration: ${config.duration}s, Connections: ${config.connections}, Pipelining: ${config.pipelining}`)

  // Prepare autocannon options
  const options: autocannon.Options = {
    url: config.url,
    method: config.method,
    headers: config.headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
    duration: config.duration,
    connections: config.connections,
    pipelining: config.pipelining,
    workers: config.workers,
    timeout: 10,
  }

  // Add scenarios if provided
  if (config.scenarios) {
    options.setupClient = (client) => {
      for (const scenario of config.scenarios!) {
        client.on(`response:${scenario.name}`, (client, statusCode, resBytes, responseTime) => {
          // Handle scenario response
        })
      }
    }
  }

  try {
    // Run the load test
    const result = await autocannon(options)

    // Process and format the results
    const formattedResult: LoadTestResult = {
      url: config.url,
      method: config.method,
      duration: config.duration,
      connections: config.connections,
      pipelining: config.pipelining,
      workers: config.workers,
      requests: {
        total: result.requests.total,
        average: result.requests.average,
        min: result.requests.min,
        max: result.requests.max,
      },
      latency: {
        average: result.latency.average,
        min: result.latency.min,
        max: result.latency.max,
        p50: result.latency.p50,
        p75: result.latency.p75,
        p90: result.latency.p90,
        p99: result.latency.p99,
      },
      throughput: {
        total: result.throughput.total,
        average: result.throughput.average,
        min: result.throughput.min,
        max: result.throughput.max,
      },
      errors: result.errors,
      timeouts: result.timeouts,
      non2xx: result.non2xx,
      timestamp: new Date().toISOString(),
    }

    // Add scenario results if available
    if (config.scenarios) {
      formattedResult.scenarioResults = {}
      for (const scenario of config.scenarios) {
        const scenarioResult = result.scenarioStats?.[scenario.name]
        if (scenarioResult) {
          formattedResult.scenarioResults[scenario.name] = {
            requests: {
              total: scenarioResult.requests.total,
              average: scenarioResult.requests.average,
            },
            latency: {
              average: scenarioResult.latency.average,
              p99: scenarioResult.latency.p99,
            },
            errors: scenarioResult.errors,
          }
        }
      }
    }

    // Log the results
    logger.info(`Load test completed for ${config.method} ${config.url}`)
    logger.info(`Requests: ${formattedResult.requests.total} (${formattedResult.requests.average}/sec)`)
    logger.info(
      `Latency: Avg ${formattedResult.latency.average}ms, Min ${formattedResult.latency.min}ms, Max ${formattedResult.latency.max}ms`,
    )
    logger.info(`Latency Percentiles: p50 ${formattedResult.latency.p50}ms, p99 ${formattedResult.latency.p99}ms`)
    logger.info(
      `Errors: ${formattedResult.errors}, Timeouts: ${formattedResult.timeouts}, Non-2xx: ${formattedResult.non2xx}`,
    )

    // Save results to file
    const resultsDir = path.join(process.cwd(), "load-test-results")
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-")
    const fileName = `load-test-${config.method}-${config.url.replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}.json`
    const filePath = path.join(resultsDir, fileName)

    fs.writeFileSync(filePath, JSON.stringify(formattedResult, null, 2))
    logger.info(`Load test results saved to ${filePath}`)

    return formattedResult
  } catch (error) {
    logger.error(`Load test failed: ${error.message}`, error)
    throw error
  }
}

// Run a series of load tests with increasing load
export const runLoadTestSeries = async (
  baseConfig: LoadTestConfig,
  connectionLevels: number[],
): Promise<LoadTestResult[]> => {
  const results: LoadTestResult[] = []

  for (const connections of connectionLevels) {
    const config = { ...baseConfig, connections }
    const result = await runLoadTest(config)
    results.push(result)

    // Wait a bit between tests to let the system recover
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  return results
}

// Generate a load test report
export const generateLoadTestReport = (results: LoadTestResult[]): string => {
  let report = "# Load Test Report\n\n"
  report += `Generated: ${new Date().toISOString()}\n\n`

  report += "## Summary\n\n"
  report += "| Connections | Requests/sec | Avg Latency | p99 Latency | Errors |\n"
  report += "|-------------|-------------|------------|------------|--------|\n"

  for (const result of results) {
    report += `| ${result.connections} | ${result.requests.average.toFixed(2)} | ${result.latency.average.toFixed(
      2,
    )}ms | ${result.latency.p99.toFixed(2)}ms | ${result.errors} |\n`
  }

  report += "\n## Detailed Results\n\n"

  for (const result of results) {
    report += `### Test with ${result.connections} connections\n\n`
    report += `- URL: ${result.url}\n`
    report += `- Method: ${result.method}\n`
    report += `- Duration: ${result.duration}s\n`
    report += `- Pipelining: ${result.pipelining}\n`
    report += `- Workers: ${result.workers || 1}\n\n`

    report += "#### Requests\n\n"
    report += `- Total: ${result.requests.total}\n`
    report += `- Average: ${result.requests.average.toFixed(2)}/sec\n`
    report += `- Min: ${result.requests.min}/sec\n`
    report += `- Max: ${result.requests.max}/sec\n\n`

    report += "#### Latency\n\n"
    report += `- Average: ${result.latency.average.toFixed(2)}ms\n`
    report += `- Min: ${result.latency.min}ms\n`
    report += `- Max: ${result.latency.max}ms\n`
    report += `- p50: ${result.latency.p50.toFixed(2)}ms\n`
    report += `- p75: ${result.latency.p75.toFixed(2)}ms\n`
    report += `- p90: ${result.latency.p90.toFixed(2)}ms\n`
    report += `- p99: ${result.latency.p99.toFixed(2)}ms\n\n`

    report += "#### Throughput\n\n"
    report += `- Total: ${(result.throughput.total / (1024 * 1024)).toFixed(2)} MB\n`
    report += `- Average: ${(result.throughput.average / 1024).toFixed(2)} KB/sec\n`
    report += `- Min: ${(result.throughput.min / 1024).toFixed(2)} KB/sec\n`
    report += `- Max: ${(result.throughput.max / 1024).toFixed(2)} KB/sec\n\n`

    report += "#### Errors\n\n"
    report += `- Errors: ${result.errors}\n`
    report += `- Timeouts: ${result.timeouts}\n`
    report += `- Non-2xx Responses: ${result.non2xx}\n\n`

    if (result.scenarioResults) {
      report += "#### Scenario Results\n\n"
      for (const [scenarioName, scenarioResult] of Object.entries(result.scenarioResults)) {
        report += `##### ${scenarioName}\n\n`
        report += `- Requests: ${scenarioResult.requests.total} (${scenarioResult.requests.average.toFixed(2)}/sec)\n`
        report += `- Average Latency: ${scenarioResult.latency.average.toFixed(2)}ms\n`
        report += `- p99 Latency: ${scenarioResult.latency.p99.toFixed(2)}ms\n`
        report += `- Errors: ${scenarioResult.errors}\n\n`
      }
    }

    report += "---\n\n"
  }

  return report
}

// Example usage
if (require.main === module) {
  // This will run if the script is executed directly
  const baseConfig: LoadTestConfig = {
    url: "http://localhost:3000/api/health",
    method: "GET",
    duration: 30,
    connections: 10,
    pipelining: 1,
  }

  const connectionLevels = [10, 50, 100, 200, 500]

  runLoadTestSeries(baseConfig, connectionLevels)
    .then((results) => {
      const report = generateLoadTestReport(results)
      const reportPath = path.join(process.cwd(), "load-test-results", `report-${Date.now()}.md`)
      fs.writeFileSync(reportPath, report)
      logger.info(`Load test report saved to ${reportPath}`)
    })
    .catch((error) => {
      logger.error("Load test series failed:", error)
    })
}

export default {
  runLoadTest,
  runLoadTestSeries,
  generateLoadTestReport,
}
