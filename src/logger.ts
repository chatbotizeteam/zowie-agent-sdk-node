/**
 * Simple logging setup for the SDK
 */

import winston from "winston";

// Custom format that ensures we always get the full output
const customFormat = winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
  const componentName = component || "zowie_agent";
  const metaStr =
    Object.keys(meta).length > 0
      ? ` - ${Object.entries(meta)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      : "";
  return `${timestamp} - ${componentName} - ${level.toUpperCase()} - ${message}${metaStr}`;
});

// Create a root logger with explicit configuration
const rootLogger = winston.createLogger({
  // biome-ignore lint/complexity/useLiteralKeys: Required by TypeScript noPropertyAccessFromIndexSignature
  level: process.env["LOG_LEVEL"] || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      ),
    }),
  ],
});

/**
 * Get a logger for a specific component
 */
export function getLogger(component: string, _level?: string): winston.Logger {
  // Always use the root logger and just create a child - ignore the level parameter for now
  // The level can be controlled via LOG_LEVEL environment variable
  return rootLogger.child({ component });
}
