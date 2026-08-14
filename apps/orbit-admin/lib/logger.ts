import pino, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Application-wide structured logger. In development it pretty-prints via
 * `pino-pretty`; in production it emits newline-delimited JSON for log
 * shippers. Sensitive fields are redacted defensively.
 */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "password_hash",
      "*.password",
      "*.passwordHash",
      "*.password_hash",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});

/** Create a child logger bound to a component or request scope. */
export function createLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };
