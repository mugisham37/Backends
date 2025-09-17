/**
 * Simple Logger Utility
 * Provides structured logging for the ecommerce backend
 */

export interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  private level: number;

  constructor(level: string = "info") {
    this.level = this.getLevelNumber(level);
  }

  private getLevelNumber(level: string): number {
    switch (level.toLowerCase()) {
      case "error":
        return LOG_LEVELS.ERROR;
      case "warn":
        return LOG_LEVELS.WARN;
      case "info":
        return LOG_LEVELS.INFO;
      case "debug":
        return LOG_LEVELS.DEBUG;
      default:
        return LOG_LEVELS.INFO;
    }
  }

  private shouldLog(level: number): boolean {
    return level <= this.level;
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? JSON.stringify(args, null, 2) : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage("error", message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage("warn", message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(this.formatMessage("info", message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(this.formatMessage("debug", message, ...args));
    }
  }
}

// Create and export default logger instance
export const logger = new Logger(process.env.LOG_LEVEL || "info");
