import process from "node:process";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors";
import { logger } from "@/infra/logger";

export function withCommandHandling<Args extends unknown[]>(
	commandName: string,
	handler: (...args: Args) => Promise<void> | void,
): (...args: Args) => Promise<void> {
	return async (...args: Args) => {
		logger.debug(`${commandName}: start`, ...args);

		try {
			await handler(...args);
			logger.debug(`${commandName}: completed`);
		} catch (error) {
			logger.debug(`${commandName}: failed`, error);
			renderCommandError(commandName, error);
			if (!process.exitCode) {
				process.exitCode = 1;
			}
		}
	};
}

export function renderCommandError(commandName: string, error: unknown): void {
	if (error instanceof ProfileAlreadyExistsError) {
		logger.warn(`${commandName}: profile already exists`, {
			profile: error.profileName,
		});
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof ProfileNotFoundError) {
		logger.warn(`${commandName}: profile not found`, {
			profile: error.profileName,
		});
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof InvalidProfileError) {
		logger.warn(`${commandName}: invalid profile`, { message: error.message });
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof Error) {
		logger.error(`${commandName}: unexpected error`, error);
		console.error(`✖ ${error.message}`);
		if (error.stack) {
			logger.debug(`${commandName}: stack trace`, error.stack);
		}
		return;
	}

	logger.error(`${commandName}: unknown error`, error);
	console.error("✖ An unknown error occurred.");
}
