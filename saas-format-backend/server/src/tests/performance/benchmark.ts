import Benchmark from "benchmark"
import fs from "fs"
import path from "path"
import { logger } from "../../utils/logger"

// Benchmark options
interface BenchmarkOptions {
  name: string
  tests: {
    name: string
    fn: () => void | Promise<void>
  }[]
  async?: boolean
  setup?: () => void | Promise<void>
  teardown?: () => void | Promise<void>
}

// Benchmark result
interface BenchmarkResult {
  name: string
  date: string
  platform: string
  results: {
    name: string
    hz: number
    stats: {
      rme: number
      mean: number
      deviation: number
      sample: number[]
    }
    ops: number
  }[]
}

// Run a benchmark
export const runBenchmark = async (options: BenchmarkOptions): Promise<BenchmarkResult> => {
  logger.info(`Starting benchmark: ${options.name}`)

  // Create a new benchmark suite
  const suite = new Benchmark.Suite(options.name)

  // Add setup function if provided
  if (options.setup) {
    try {
      await Promise.resolve(options.setup())
    } catch (error) {
      logger.error(`Benchmark setup failed: ${error.message}`, error)
      throw error
    }
  }

  // Add tests to the suite
  for (const test of options.tests) {
    if (options.async) {
      suite.add(test.name, {
        defer: true,
        fn: async (deferred: { resolve: () => void }) => {
          try {
            await Promise.resolve(test.fn())
            deferred.resolve()
          } catch (error) {
            logger.error(`Benchmark test failed: ${error.message}`, error)
            deferred.resolve() // Resolve anyway to continue the benchmark
          }
        },
      })
    } else {
      suite.add(test.name, test.fn)
    }
  }

  // Run the benchmark and collect results
  return new Promise((resolve, reject) => {
    const results: BenchmarkResult = {
      name: options.name,
      date: new Date().toISOString(),
      platform: `${process.platform} ${process.arch} Node.js ${process.version}`,
      results: [],
    }

    suite
      .on("cycle", (event: any) => {
        const benchmark = event.target
        logger.info(String(benchmark))

        results.results.push({
          name: benchmark.name,
          hz: benchmark.hz,
          stats: {
            rme: benchmark.stats.rme,
            mean: benchmark.stats.mean,
            deviation: benchmark.stats.deviation,
            sample: benchmark.stats.sample,
          },
          ops: benchmark.hz,
        })
      })
      .on("complete", async () => {
        logger.info(`Benchmark completed: ${options.name}`)
        logger.info(`Fastest: ${suite.filter("fastest").map("name")}`)

        // Run teardown function if provided
        if (options.teardown) {
          try {
            await Promise.resolve(options.teardown())
          } catch (error) {
            logger.error(`Benchmark teardown failed: ${error.message}`, error)
          }
        }

        // Save results to file
        const resultsDir = path.join(process.cwd(), "benchmark-results")
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir, { recursive: true })
        }

        const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-")
        const fileName = `benchmark-${options.name.replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}.json`
        const filePath = path.join(resultsDir, fileName)

        fs.writeFileSync(filePath, JSON.stringify(results, null, 2))
        logger.info(`Benchmark results saved to ${filePath}`)

        resolve(results)
      })
      .on("error", (error: Error) => {
        logger.error(`Benchmark error: ${error.message}`, error)
        reject(error)
      })
      .run({ async: options.async })
  })
}

// Generate a benchmark report
export const generateBenchmarkReport = (results: BenchmarkResult): string => {
  let report = "# Benchmark Report\n\n"
  report += `## ${results.name}\n\n`
  report += `Generated: ${results.date}\n`
  report += `Platform: ${results.platform}\n\n`

  report += "## Results\n\n"
  report += "| Test | Operations/sec | Relative Margin of Error | Mean (sec) |\n"
  report += "|------|---------------|--------------------------|------------|\n"

  for (const result of results.results) {
    report += `| ${result.name} | ${result.ops.toFixed(2)} | ±${result.stats.rme.toFixed(2)}% | ${result.stats.mean.toFixed(
      6,
    )} |\n`
  }

  report += "\n## Comparison\n\n"

  // Find the fastest test
  const fastest = results.results.reduce((prev, current) => (prev.ops > current.ops ? prev : current))

  report += "| Test | Relative Speed |\n"
  report += "|------|---------------|\n"

  for (const result of results.results) {
    const relativeSpeed = (result.ops / fastest.ops) * 100
    report += `| ${result.name} | ${relativeSpeed.toFixed(2)}% |\n`
  }

  return report
}

// Example usage
if (require.main === module) {
  // This will run if the script is executed directly
  const options: BenchmarkOptions = {
    name: "Example Benchmark",
    tests: [
      {
        name: "Array.push",
        fn: () => {
          const arr: number[] = []
          for (let i = 0; i < 1000; i++) {
            arr.push(i)
          }
        },
      },
      {
        name: "Array with length",
        fn: () => {
          const arr: number[] = []
          arr.length = 1000
          for (let i = 0; i < 1000; i++) {
            arr[i] = i
          }
        },
      },
    ],
  }

  runBenchmark(options)
    .then((results) => {
      const report = generateBenchmarkReport(results)
      const reportPath = path.join(process.cwd(), "benchmark-results", `report-${Date.now()}.md`)
      fs.writeFileSync(reportPath, report)
      logger.info(`Benchmark report saved to ${reportPath}`)
    })
    .catch((error) => {
      logger.error("Benchmark failed:", error)
    })
}

export default {
  runBenchmark,
  generateBenchmarkReport,
}
