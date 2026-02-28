import { ProfileService } from "@/core/profile-service";
import { ProfileAlreadyExistsError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendProfileCloneFailedJson,
	sendProfileCloneFailedMsg,
	sendProfileCloneSuccessJson,
	sendProfileCloneSuccessMsg,
} from "./ui";

interface Options {
	force?: boolean;
	json?: boolean;
}

const action: (
	source: string,
	target: string,
	options: Options,
) => Promise<void> = withCommandHandling(
	"command:clone",
	async (source: string, target: string, options: Options) => {
		const service = ProfileService.create();
		try {
			const profile = await service.cloneProfile(source, target, options.force);
			if (options.json) {
				sendProfileCloneSuccessJson(source, profile);
				return;
			}
			sendProfileCloneSuccessMsg(source, profile.name);
		} catch (error) {
			if (error instanceof ProfileNotFoundError) {
				const reason = `'${source}' does not exist.`;
				if (options.json) {
					sendProfileCloneFailedJson(source, target, reason);
				} else {
					sendProfileCloneFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}

			if (error instanceof ProfileAlreadyExistsError) {
				const reason = error.message;
				if (options.json) {
					sendProfileCloneFailedJson(source, target, reason);
				} else {
					sendProfileCloneFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}

			throw error;
		}
	},
);

export default action;
