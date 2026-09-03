import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  module: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data?: unknown;
}

type LogContext = Record<string, unknown>;

export interface OperationLogger {
  debug: (message: string, data?: LogContext) => void;
  info: (message: string, data?: LogContext) => void;
  warn: (message: string, data?: LogContext) => void;
  error: (message: string, data?: LogContext) => void;
  checkpoint: (stage: string, data?: LogContext) => void;
  complete: (data?: LogContext) => void;
}

class SingleFlowLogger {
  private static instance: SingleFlowLogger;
  private filePath: string;

  private constructor() {
    // Single flow log file for all modules
    this.filePath = path.resolve(process.cwd(), 'logs', 'rita-combined-flow.jsonl');

    if (this.isDisabled()) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public static getInstance(): SingleFlowLogger {
    if (!SingleFlowLogger.instance) {
      SingleFlowLogger.instance = new SingleFlowLogger();
    }
    return SingleFlowLogger.instance;
  }

  private isDisabled(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.RITA_DISABLE_JSONL_LOGS === '1';
  }

  private writeLog(module: string, level: LogEntry['level'], message: string, data?: unknown): void {
    if (this.isDisabled()) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      module,
      level,
      message,
      ...(data !== undefined && { data }),
    };

    const jsonLine = JSON.stringify(logEntry);
    fs.appendFileSync(this.filePath, jsonLine + '\n', 'utf8');
  }

  public log(module: string, message: string, data?: LogContext): void {
    this.writeLog(module, 'INFO', message, data);
  }

  public debug(module: string, message: string, data?: LogContext): void {
    this.writeLog(module, 'DEBUG', message, data);
  }

  public info(module: string, message: string, data?: LogContext): void {
    this.writeLog(module, 'INFO', message, data);
  }

  public warn(module: string, message: string, data?: LogContext): void {
    this.writeLog(module, 'WARN', message, data);
  }

  public error(module: string, message: string, data?: LogContext): void {
    this.writeLog(module, 'ERROR', message, data);
  }
}

// Export single instance
export const flowLogger = SingleFlowLogger.getInstance();

// Convenience function for quick logging
export const logFlow = (module: string, message: string, data?: LogContext) => {
  flowLogger.info(module, message, data);
};

export const serializeError = (error: unknown): LogContext => {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, errorStack: error.stack };
  }

  return { errorMessage: String(error) };
};

export const createOperationLogger = (module: string, operation: string, context: LogContext = {}): OperationLogger => {
  const startedAt = performance.now();
  const withContext = (data?: LogContext): LogContext => ({
    operation,
    elapsedMs: Math.round(performance.now() - startedAt),
    ...context,
    ...(data ?? {}),
  });

  return {
    debug: (message, data) => flowLogger.debug(module, message, withContext(data)),
    info: (message, data) => flowLogger.info(module, message, withContext(data)),
    warn: (message, data) => flowLogger.warn(module, message, withContext(data)),
    error: (message, data) => flowLogger.error(module, message, withContext(data)),
    checkpoint: (stage, data) => flowLogger.info(module, 'checkpoint', withContext({ stage, ...data })),
    complete: (data) => flowLogger.info(module, 'complete', withContext(data)),
  };
};
