import fs from 'fs';
import path from 'path';

interface LogEntry {
	timestamp: string;
	module: string;
	level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	message: string;
	data?: any;
}

class SingleFlowLogger {
	private static instance: SingleFlowLogger;
	private filePath: string;

	private constructor() {
		// Single flow log file for all modules
		this.filePath = path.resolve(process.cwd(), 'logs', 'rita-combined-flow.jsonl');

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

	private writeLog(module: string, level: LogEntry['level'], message: string, data?: any): void {
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

	public log(module: string, message: string, data?: any): void {
		this.writeLog(module, 'INFO', message, data);
	}

	public debug(module: string, message: string, data?: any): void {
		this.writeLog(module, 'DEBUG', message, data);
	}

	public info(module: string, message: string, data?: any): void {
		this.writeLog(module, 'INFO', message, data);
	}

	public warn(module: string, message: string, data?: any): void {
		this.writeLog(module, 'WARN', message, data);
	}

	public error(module: string, message: string, data?: any): void {
		this.writeLog(module, 'ERROR', message, data);
	}
}

// Export single instance
export const flowLogger = SingleFlowLogger.getInstance();

// Convenience function for quick logging
export const logFlow = (module: string, message: string, data?: any) => {
	flowLogger.info(module, message, data);
};
