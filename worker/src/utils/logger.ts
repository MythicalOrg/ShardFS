// Simple logging utility for the worker
// In a real production system, you'd use a proper logging library like winston

function getTimestamp(): string {
  return new Date().toISOString();
}

export function log(...args: any[]) {
  console.log(`[${getTimestamp()}] [INFO]`, ...args);
}

export function error(...args: any[]) {
  console.error(`[${getTimestamp()}] [ERROR]`, ...args);
}

export function warn(...args: any[]) {
  console.warn(`[${getTimestamp()}] [WARN]`, ...args);
}

export function debug(...args: any[]) {
  // Only log debug messages if DEBUG env var is set
  if (process.env.DEBUG) {
    console.log(`[${getTimestamp()}] [DEBUG]`, ...args);
  }
}
