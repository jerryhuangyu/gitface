import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { InvalidProfileError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendRuleResolveFailedJson,
	sendRuleResolveFailedMsg,
	sendRuleResolveMatchedJson,
	sendRuleResolveMatchedMsg,
	sendRuleResolveUnmatchedJson,
	sendRuleResolveUnmatchedMsg,
} from "./ui";

interface ResolveRuleOptions {
	json?: boolean;
	strict?: boolean;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

async function profileExists(profileName: string): Promise<boolean> {
	try {
		const service = ProfileService.create();
		return (await service.findProfile(profileName)) !== null;
	} catch (error) {
		if (error instanceof InvalidProfileError) {
			return false;
		}
		throw error;
	}
}

export const resolveRuleAction: (
	directory: string | undefined,
	options: ResolveRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:resolve",
	async (directory, options) => {
		const ruleService = RuleService.create();
		const targetDirectory = Rule.create(
			directory ?? process.cwd(),
			"dummy",
		).directory;
		const strictMode = options.strict ?? false;

		try {
			const matchedRule = await ruleService
				.resolveRuleForDirectory(targetDirectory)
				.catch((error) => {
					if (isMissingGlobalConfigError(error)) {
						return null;
					}
					throw error;
				});

			if (!matchedRule) {
				if (options.json) {
					sendRuleResolveUnmatchedJson(targetDirectory);
				} else {
					sendRuleResolveUnmatchedMsg(targetDirectory);
				}
				if (strictMode) {
					process.exitCode = 1;
				}
				return;
			}

			const hasProfile = await profileExists(matchedRule.profileName);
			if (options.json) {
				sendRuleResolveMatchedJson(targetDirectory, matchedRule, hasProfile);
			} else {
				sendRuleResolveMatchedMsg(targetDirectory, matchedRule, hasProfile);
			}
			if (strictMode && !hasProfile) {
				process.exitCode = 1;
			}
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (options.json) {
				sendRuleResolveFailedJson(targetDirectory, reason);
			} else {
				sendRuleResolveFailedMsg(`Failed to resolve rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
