import { ProfileService } from "@/core/profile-service";
import {
	InvalidProfileError,
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
} from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	sendProfileRenameDryRunJson,
	sendProfileRenameDryRunMsg,
	sendProfileRenameFailedJson,
	sendProfileRenameFailedMsg,
	sendProfileRenameSuccessJson,
	sendProfileRenameSuccessMsg,
} from "./ui";

interface Options {
	force?: boolean;
	dryRun?: boolean;
	json?: boolean;
}

const action: (
	oldName: string,
	newName: string,
	options: Options,
) => Promise<void> = withCommandHandling(
	"command:rename",
	async (oldName: string, newName: string, options: Options) => {
		const service = ProfileService.create();
		try {
			if (options.dryRun) {
				const profile = await service.getProfile(oldName);
				const targetProfile = await service.findProfile(newName);
				if (!options.force && targetProfile !== null) {
					throw new ProfileAlreadyExistsError(newName);
				}
				const overwrite = targetProfile !== null;
				if (options.json) {
					sendProfileRenameDryRunJson(oldName, newName, profile, overwrite);
					return;
				}
				sendProfileRenameDryRunMsg(oldName, newName, profile, overwrite);
				return;
			}

			const profile = await service.renameProfile(
				oldName,
				newName,
				options.force,
			);
			if (options.json) {
				sendProfileRenameSuccessJson(oldName, profile);
				return;
			}
			sendProfileRenameSuccessMsg(oldName, profile.name);
		} catch (error) {
			if (error instanceof ProfileNotFoundError) {
				const reason = await buildProfileNotFoundReason(
					oldName,
					`'${oldName}' does not exist.`,
				);
				if (options.json) {
					sendProfileRenameFailedJson(oldName, newName, reason);
				} else {
					sendProfileRenameFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}

			if (error instanceof ProfileAlreadyExistsError) {
				const reason = error.message;
				if (options.json) {
					sendProfileRenameFailedJson(oldName, newName, reason);
				} else {
					sendProfileRenameFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}

			if (error instanceof InvalidProfileError) {
				const reason = error.message;
				if (options.json) {
					sendProfileRenameFailedJson(oldName, newName, reason);
				} else {
					sendProfileRenameFailedMsg(reason);
				}
				process.exitCode = 1;
				return;
			}

			throw error;
		}
	},
);

export default action;
