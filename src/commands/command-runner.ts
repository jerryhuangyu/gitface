import process from "node:process";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors";

export function withCommandHandling<Args extends unknown[]>(
	handler: (...args: Args) => Promise<void> | void,
): (...args: Args) => Promise<void> {
	return async (...args: Args) => {
		try {
			await handler(...args);
		} catch (error) {
			renderCommandError(error);
			if (!process.exitCode) {
				process.exitCode = 1;
			}
		}
	};
}

export function renderCommandError(error: unknown): void {
	if (error instanceof ProfileAlreadyExistsError) {
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof ProfileNotFoundError) {
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof InvalidProfileError) {
		console.error(`✖ ${error.message}`);
		return;
	}

	if (error instanceof Error) {
		console.error(`✖ ${error.message}`);
		if (process.env.GITFACE_DEBUG === "1" && error.stack) {
			console.error(error.stack);
		}
		return;
	}

	console.error("✖ An unknown error occurred.");
}
