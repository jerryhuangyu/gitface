import { randomUUID } from "node:crypto";
import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { withCommandHandling } from "../command-runner";
import {
	sendRuleRemoveDryRunJson,
	sendRuleRemoveDryRunMsg,
	sendRuleRemoveDryRunResultEnvelope,
	sendRuleRemoveFailedJson,
	sendRuleRemoveFailedMsg,
	sendRuleRemoveFailedResultEnvelope,
	sendRuleRemoveSuccessJson,
	sendRuleRemoveSuccessMsg,
	sendRuleRemoveSuccessResultEnvelope,
} from "./ui";

interface RemoveRuleOptions {
	dryRun?: boolean;
	json?: boolean;
	jsonEnvelope?: boolean;
}

type RemoveOutputMode = "text" | "json" | "json-envelope";

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

export const removeRuleAction: (
	directory: string,
	options: RemoveRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:remove",
	async (directory, options) => {
		const startedAtMs = Date.now();
		const traceId = randomUUID();
		const outputMode: RemoveOutputMode =
			options.jsonEnvelope === true
				? "json-envelope"
				: options.json === true
					? "json"
					: "text";
		const ruleService = RuleService.create();
		const normalizedDirectory = Rule.create(directory, "dummy").directory;
		try {
			if (options.dryRun) {
				const existingRules = await ruleService.listRules().catch((error) => {
					if (isMissingGlobalConfigError(error)) {
						return [];
					}
					throw error;
				});
				const exists = existingRules.some(
					(rule) => rule.directory === normalizedDirectory,
				);
				if (outputMode === "json-envelope") {
					sendRuleRemoveDryRunResultEnvelope(
						normalizedDirectory,
						exists,
						Date.now() - startedAtMs,
						traceId,
					);
					return;
				}
				if (outputMode === "json") {
					sendRuleRemoveDryRunJson(normalizedDirectory, exists);
					return;
				}
				sendRuleRemoveDryRunMsg(normalizedDirectory, exists);
				return;
			}

			// removeRule is idempotent and silently ignores missing keys.
			await ruleService.removeRule(directory);
			if (outputMode === "json-envelope") {
				sendRuleRemoveSuccessResultEnvelope(
					normalizedDirectory,
					Date.now() - startedAtMs,
					traceId,
				);
				return;
			}
			if (outputMode === "json") {
				sendRuleRemoveSuccessJson(normalizedDirectory);
				return;
			}
			sendRuleRemoveSuccessMsg(directory);
		} catch (error) {
			const reason =
				error instanceof Error
					? error.message
					: `Unexpected error ${JSON.stringify(error)}`;
			if (outputMode === "json-envelope") {
				sendRuleRemoveFailedResultEnvelope(
					normalizedDirectory,
					reason,
					Date.now() - startedAtMs,
					traceId,
				);
			} else if (outputMode === "json") {
				sendRuleRemoveFailedJson(normalizedDirectory, reason);
			} else {
				sendRuleRemoveFailedMsg(`Failed to remove rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
