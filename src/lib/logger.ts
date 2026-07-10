import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Application-wide structured logger.
 * Use this instead of console.log everywhere in server code.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      }
    : undefined,
  base: { service: "kai-ads" },
});

export function createLogger(scope: string) {
  return logger.child({ scope });
}
