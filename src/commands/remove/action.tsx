import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendProfileRemoveFailedJson,
	sendProfileRemoveFailedMsg,
	sendProfileRemoveSkippedJson,
	sendProfileRemoveSuccessJson,
	sendProfileRemoveSuccessMsg,
	sendProfileRemoveWithForceMsg,
} from "./ui";

interface RemoveProfileOptions {
	force?: boolean;
	json?: boolean;
}

const action: (name: string, options: RemoveProfileOptions) => Promise<void> =
	withCommandHandling("command:remove", async (name, options) => {
		const service = ProfileService.create();

		try {
			const profile = await service.removeProfile(name);
			if (options.json) {
				sendProfileRemoveSuccessJson(profile);
				return;
			}
			sendProfileRemoveSuccessMsg(profile);
		} catch (error) {
			if (options.force && error instanceof ProfileNotFoundError) {
				if (options.json) {
					sendProfileRemoveSkippedJson(name);
					return;
				}
				sendProfileRemoveWithForceMsg(name);
				return;
			}
			if (error instanceof ProfileNotFoundError) {
				const reason = `'${name}' does not exist.`;
				if (options.json) {
					sendProfileRemoveFailedJson(name, reason);
				} else {
					sendProfileRemoveFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}
			if (error instanceof InvalidProfileError) {
				const reason = error.message;
				if (options.json) {
					sendProfileRemoveFailedJson(name, reason);
				} else {
					sendProfileRemoveFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendProfileRemoveFailedJson(name, reason);
			} else {
				sendProfileRemoveFailedMsg(reason);
			}
			process.exitCode = 1;
		}
	});

export default action;
