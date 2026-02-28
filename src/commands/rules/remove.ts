import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { withCommandHandling } from "../command-runner";
import {
	sendRuleRemoveFailedJson,
	sendRuleRemoveFailedMsg,
	sendRuleRemoveSuccessJson,
	sendRuleRemoveSuccessMsg,
} from "./ui";

interface RemoveRuleOptions {
	json?: boolean;
}

export const removeRuleAction: (
	directory: string,
	options: RemoveRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:remove",
	async (directory, options) => {
		const ruleService = RuleService.create();
		const normalizedDirectory = Rule.create(directory, "dummy").directory;
		try {
			// removeRule is idempotent and silently ignores missing keys.
			await ruleService.removeRule(directory);
			if (options.json) {
				sendRuleRemoveSuccessJson(normalizedDirectory);
				return;
			}
			sendRuleRemoveSuccessMsg(directory);
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendRuleRemoveFailedJson(normalizedDirectory, reason);
			} else {
				sendRuleRemoveFailedMsg(`Failed to remove rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
