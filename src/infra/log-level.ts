const LOG_LEVELS = ["critical", "error", "warn", "info", "debug"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

function normalize(value: string | undefined): LogLevel {
	if (!value) {
		return "error";
	}

	const target = value.trim().toLowerCase();
	if (LOG_LEVELS.includes(target as LogLevel)) {
		return target as LogLevel;
	}

	if (target === "1" || target === "true" || target === "yes") {
		return "debug";
	}

	return "error";
}

export { LOG_LEVELS, normalize };
export type { LogLevel };
