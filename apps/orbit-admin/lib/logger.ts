import pino, { type Logger } from "pino";
import pretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const options = {
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
};

/**
 * Application-wide structured logger. Production emits newline-delimited JSON to
 * stdout for log shippers. Development pretty-prints via a *synchronous*
 * `pino-pretty` stream (not a worker `transport`) so Next's dev HMR can't leave
 * a dangling worker thread — the source of "the worker thread exited" noise.
 */
export const logger: Logger = isProduction
  ? pino(options)
  : pino(
      options,
      pretty({
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      }),
    );

/** Create a child logger bound to a component or request scope. */
export function createLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };
