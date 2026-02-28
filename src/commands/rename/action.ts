import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
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

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

async function countRulesUsingProfile(profileName: string): Promise<number> {
	try {
		const ruleService = RuleService.create();
		const rules = await ruleService.listRules();
		return rules.filter((rule) => rule.profileName === profileName).length;
	} catch (error) {
		if (isMissingGlobalConfigError(error)) {
			return 0;
		}
		throw error;
	}
}

async function migrateRulesToRenamedProfile(
	oldName: string,
	newName: string,
): Promise<number> {
	try {
		const ruleService = RuleService.create();
		const rules = await ruleService.listRules();
		const impactedRules = rules.filter((rule) => rule.profileName === oldName);
		for (const rule of impactedRules) {
			await ruleService.addRule(rule.directory, newName);
		}
		return impactedRules.length;
	} catch (error) {
		if (isMissingGlobalConfigError(error)) {
			return 0;
		}
		throw error;
	}
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
				const rulesToUpdate = await countRulesUsingProfile(oldName);
				if (!options.force && targetProfile !== null) {
					throw new ProfileAlreadyExistsError(newName);
				}
				const overwrite = targetProfile !== null;
				if (options.json) {
					sendProfileRenameDryRunJson(
						oldName,
						newName,
						profile,
						overwrite,
						rulesToUpdate,
					);
					return;
				}
				sendProfileRenameDryRunMsg(
					oldName,
					newName,
					profile,
					overwrite,
					rulesToUpdate,
				);
				return;
			}

			const profile = await service.renameProfile(
				oldName,
				newName,
				options.force,
			);
			const rulesUpdated = await migrateRulesToRenamedProfile(oldName, newName);
			if (options.json) {
				sendProfileRenameSuccessJson(oldName, profile, rulesUpdated);
				return;
			}
			sendProfileRenameSuccessMsg(oldName, profile.name, rulesUpdated);
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
