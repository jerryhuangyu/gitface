import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	sendRuleAddDryRunJson,
	sendRuleAddDryRunMsg,
	sendRuleAddFailedJson,
	sendRuleAddFailedMsg,
	sendRuleAddSuccessJson,
	sendRuleAddSuccessMsg,
} from "./ui";

interface AddRuleOptions {
	dryRun?: boolean;
	json?: boolean;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

export const addRuleAction: (
	directory: string,
	profileName: string,
	options: AddRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:add",
	async (directory, profileName, options) => {
		const ruleService = RuleService.create();
		const profileService = ProfileService.create();
		const normalizedDirectory = Rule.create(directory, profileName).directory;
		try {
			if (options.dryRun) {
				await profileService.getProfile(profileName);
				const existingRules = await ruleService.listRules().catch((error) => {
					if (isMissingGlobalConfigError(error)) {
						return [];
					}
					throw error;
				});
				const overwrite = existingRules.some(
					(rule) => rule.directory === normalizedDirectory,
				);
				if (options.json) {
					sendRuleAddDryRunJson(normalizedDirectory, profileName, overwrite);
					return;
				}
				sendRuleAddDryRunMsg(normalizedDirectory, profileName, overwrite);
				return;
			}

			await ruleService.addRule(directory, profileName);
			if (options.json) {
				sendRuleAddSuccessJson(normalizedDirectory, profileName);
				return;
			}
			sendRuleAddSuccessMsg(directory, profileName);
		} catch (error) {
			const reason =
				error instanceof ProfileNotFoundError
					? await buildProfileNotFoundReason(
							profileName,
							`Profile '${profileName}' not found.`,
						)
					: error instanceof Error
						? error.message
						: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendRuleAddFailedJson(normalizedDirectory, profileName, reason);
			} else {
				sendRuleAddFailedMsg(`Failed to add rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
