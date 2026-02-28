import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	sendRuleAddFailedJson,
	sendRuleAddFailedMsg,
	sendRuleAddSuccessJson,
	sendRuleAddSuccessMsg,
} from "./ui";

interface AddRuleOptions {
	json?: boolean;
}

export const addRuleAction: (
	directory: string,
	profileName: string,
	options: AddRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:add",
	async (directory, profileName, options) => {
		const ruleService = RuleService.create();
		const normalizedDirectory = Rule.create(directory, profileName).directory;
		try {
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
