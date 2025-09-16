import { defineConfig } from "cypress"

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },

  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
  },

  viewportWidth: 1280,
  viewportHeight: 720,

  // Enable video recording for failed tests only
  video: false,
  videoUploadOnPasses: false,

  // Configure retries
  retries: {
    runMode: 2,
    openMode: 0,
  },

  // Configure screenshots
  screenshotOnRunFailure: true,

  // Configure timeouts
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,

  // Configure environment variables
  env: {
    apiUrl: "http://localhost:3000/api",
  },
})
