module.exports = {
  apps: [
    {
      name: "cms-api",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        LOG_LEVEL: "debug",
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: 3000,
        LOG_LEVEL: "info",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        LOG_LEVEL: "warn",
      },
      // Logging
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Performance monitoring
      monitoring: true,
      max_memory_restart: "1G",

      // Auto restart on file changes (development only)
      watch: process.env.NODE_ENV === "development",
      watch_delay: 1000,
      ignore_watch: ["node_modules", "logs", "dist"],

      // Graceful shutdown
      kill_timeout: 5000,
      shutdown_with_message: true,

      // Health check
      health_check_grace_period: 3000,

      // Cluster settings
      wait_ready: true,
      listen_timeout: 10000,

      // Environment specific configurations
      node_args:
        process.env.NODE_ENV === "production"
          ? ["--max-old-space-size=1024"]
          : ["--max-old-space-size=512", "--inspect=0.0.0.0:9229"],

      // Advanced settings
      vizion: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Deployment
      post_update: ["npm install", "npm run build"],

      // Merge logs
      merge_logs: true,

      // Source map support
      source_map_support: true,

      // Instance variables
      instance_var: "INSTANCE_ID",

      // Time zone
      time: true,
    },

    // Background worker (optional)
    {
      name: "cms-worker",
      script: "./dist/worker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        WORKER_TYPE: "background",
      },
      env_staging: {
        NODE_ENV: "staging",
        WORKER_TYPE: "background",
      },
      env_production: {
        NODE_ENV: "production",
        WORKER_TYPE: "background",
      },
      log_file: "./logs/worker.log",
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      max_memory_restart: "512M",
      autorestart: true,
      max_restarts: 5,
      min_uptime: "10s",
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: "deploy",
      host: ["production-server.com"],
      ref: "origin/main",
      repo: "git@github.com:your-org/cms-api.git",
      path: "/var/www/cms-api",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "git clone git@github.com:your-org/cms-api.git .",
      "post-setup": "npm install && npm run build",
      ssh_options: "StrictHostKeyChecking=no",
    },

    staging: {
      user: "deploy",
      host: ["staging-server.com"],
      ref: "origin/develop",
      repo: "git@github.com:your-org/cms-api.git",
      path: "/var/www/cms-api-staging",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env staging",
      "pre-setup": "git clone git@github.com:your-org/cms-api.git .",
      "post-setup": "npm install && npm run build",
      ssh_options: "StrictHostKeyChecking=no",
    },
  },
};
