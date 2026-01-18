// Logger utility for development-only logging
// These functions only log in development and are no-ops in production

// Helper function to safely serialize objects for logging
function safeSerialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack
    };
  }
  
  if (typeof obj === 'object') {
    try {
      // Try to JSON stringify and parse to remove non-serializable properties
      return JSON.parse(JSON.stringify(obj));
    } catch {
      // If JSON.stringify fails, convert to string representation
      return `[Object: ${obj.constructor?.name || 'Unknown'}]`;
    }
  }
  
  return obj;
}

function safeLog(logFn: (...args: unknown[]) => void, ...args: unknown[]): void {
  try {
    const safeArgs = args.map(safeSerialize);
    logFn(...safeArgs);
  } catch {
    // Fallback to basic string logging if all else fails
    logFn('[Logger Error]', ...args.map(arg => String(arg)));
  }
}

export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    safeLog(console.log, ...args);
  }
}

export function devError(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    safeLog(console.error, ...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    safeLog(console.warn, ...args);
  }
}

export function devInfo(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    safeLog(console.info, ...args);
  }
}

export function devDebug(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    safeLog(console.debug, ...args);
  }
} 