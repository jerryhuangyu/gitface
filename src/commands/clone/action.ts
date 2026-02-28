import { ProfileService } from "@/core/profile-service";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	sendProfileCloneDryRunJson,
	sendProfileCloneDryRunMsg,
	sendProfileCloneFailedJson,
	sendProfileCloneFailedMsg,
	sendProfileCloneSuccessJson,
	sendProfileCloneSuccessMsg,
} from "./ui";

interface Options {
	force?: boolean;
	dryRun?: boolean;
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
			if (options.dryRun) {
				const sourceProfile = await service.getProfile(source);
				const targetProfile = await service.findProfile(target);
				if (!options.force && targetProfile !== null) {
					throw new ProfileAlreadyExistsError(target);
				}
				const overwrite = targetProfile !== null;
				if (options.json) {
					sendProfileCloneDryRunJson(source, target, sourceProfile, overwrite);
					return;
				}
				sendProfileCloneDryRunMsg(source, target, sourceProfile, overwrite);
				return;
			}

			const profile = await service.cloneProfile(source, target, options.force);
			if (options.json) {
				sendProfileCloneSuccessJson(source, profile);
				return;
			}
			sendProfileCloneSuccessMsg(source, profile.name);
		} catch (error) {
			if (error instanceof ProfileNotFoundError) {
				const reason = await buildProfileNotFoundReason(
					source,
					`'${source}' does not exist.`,
				);
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

			if (error instanceof InvalidProfileError) {
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
