import chalk from "chalk";
import { LOG_LEVELS, type LogLevel, normalize } from "@/infra/log-level";

const DEFAULT_LEVEL: LogLevel = "error";
const ENV_LOG_LEVEL = "GITFACE_LOG_LEVEL";
const ENV_DEBUG = "GITFACE_DEBUG";

function resolveEnvLevel(): LogLevel {
	const explicitLevel = normalize(process.env[ENV_LOG_LEVEL]);
	if (explicitLevel !== DEFAULT_LEVEL) {
		return explicitLevel;
	}

	if (process.env[ENV_DEBUG]) {
		return normalize(process.env[ENV_DEBUG]);
	}

	return DEFAULT_LEVEL;
}

const resolvedLevel: LogLevel = resolveEnvLevel();
const levelIndex = LOG_LEVELS.indexOf(resolvedLevel);

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS.indexOf(level) <= levelIndex;
}

function formatPrefix(level: LogLevel): string {
	const label = `[${level}]`;
	switch (level) {
		case "critical":
			return chalk.bgRed.white.bold(label);
		case "error":
			return chalk.red(label);
		case "warn":
			return chalk.yellow(label);
		case "info":
			return chalk.blue(label);
		case "debug":
			return chalk.dim(label);
		default:
			return label;
	}
}

function log(level: LogLevel, ...args: unknown[]): void {
	if (!shouldLog(level)) return;

	const prefix = formatPrefix(level);
	const payload = [prefix, ...args];

	switch (level) {
		case "critical":
		case "error":
			console.error(...payload);
			break;
		case "warn":
			console.warn(...payload);
			break;
		case "info":
			console.info(...payload);
			break;
		case "debug":
			console.debug(...payload);
			break;
		default:
			console.log(...payload);
	}
}

interface Logger {
	level: LogLevel;
	critical: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	debug: (...args: unknown[]) => void;
}

const logger: Logger = {
	level: resolvedLevel,
	critical: (...args: unknown[]) => log("critical", ...args),
	error: (...args: unknown[]) => log("error", ...args),
	warn: (...args: unknown[]) => log("warn", ...args),
	info: (...args: unknown[]) => log("info", ...args),
	debug: (...args: unknown[]) => log("debug", ...args),
};

export { logger };
export type { LogLevel };
