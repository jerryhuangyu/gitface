import process from "node:process";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import { buildUseChangePlan, getEffectiveChanges } from "../use/output";
import {
	sendRuleApplyAppliedJson,
	sendRuleApplyAppliedMsg,
	sendRuleApplyDryRunJson,
	sendRuleApplyDryRunMsg,
	sendRuleApplyFailedJson,
	sendRuleApplyFailedMsg,
	sendRuleApplyUnchangedJson,
	sendRuleApplyUnchangedMsg,
	sendRuleApplyUnmatchedJson,
	sendRuleApplyUnmatchedMsg,
} from "./ui";

interface ApplyRuleOptions {
	scope?: string;
	dryRun?: boolean;
	json?: boolean;
	strict?: boolean;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
	return (
		error instanceof Error &&
		error.message.toLowerCase().includes("unable to read config file")
	);
};

const isValidScope = (value: string): value is ConfigScope => {
	const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
	return VALID_SCOPES.has(value as ConfigScope);
};

export const applyRuleAction: (
	directory: string | undefined,
	options: ApplyRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:apply",
	async (directory, options) => {
		const normalizedScope = (options.scope ?? "local").toLowerCase();
		if (!isValidScope(normalizedScope)) {
			const reason = "Scope must be one of: local, global, system.";
			if (options.json) {
				sendRuleApplyFailedJson(
					Rule.create(directory ?? process.cwd(), "dummy").directory,
					reason,
				);
			} else {
				sendRuleApplyFailedMsg(reason);
			}
			process.exitCode = 1;
			return;
		}
		const scope = normalizedScope as ConfigScope;

		const ruleService = RuleService.create();
		const profileService = ProfileService.create();
		const targetDirectory = Rule.create(
			directory ?? process.cwd(),
			"dummy",
		).directory;

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
					sendRuleApplyUnmatchedJson(targetDirectory, scope);
				} else {
					sendRuleApplyUnmatchedMsg(targetDirectory, scope);
				}
				if (options.strict) {
					process.exitCode = 1;
				}
				return;
			}

			const profile = await profileService.getProfile(matchedRule.profileName);
			const runApply = async (): Promise<void> => {
				const scopedProfileService = ProfileService.create();
				const scopedIdentity =
					await scopedProfileService.getScopedIdentity(scope);
				const currentIdentity = {
					gitName: scopedIdentity.gitName ?? null,
					email: scopedIdentity.email ?? null,
					signingKey: scopedIdentity.signingKey ?? null,
				};
				const effectiveChanges = getEffectiveChanges(
					buildUseChangePlan(profile, currentIdentity),
				);

				if (options.dryRun) {
					if (options.json) {
						sendRuleApplyDryRunJson(
							targetDirectory,
							matchedRule,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					} else {
						sendRuleApplyDryRunMsg(
							targetDirectory,
							matchedRule,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					}
					return;
				}

				if (effectiveChanges.length === 0) {
					if (options.json) {
						sendRuleApplyUnchangedJson(
							targetDirectory,
							matchedRule,
							scope,
							profile,
						);
					} else {
						sendRuleApplyUnchangedMsg(
							targetDirectory,
							matchedRule,
							scope,
							profile,
						);
					}
					return;
				}

				await scopedProfileService.applyProfile(profile.name, scope);
				if (options.json) {
					sendRuleApplyAppliedJson(
						targetDirectory,
						matchedRule,
						scope,
						profile,
					);
				} else {
					sendRuleApplyAppliedMsg(targetDirectory, matchedRule, scope, profile);
				}
			};

			if (scope !== "local") {
				await runApply();
				return;
			}

			const originalCwd = process.cwd();
			process.chdir(targetDirectory);
			try {
				await runApply();
			} finally {
				process.chdir(originalCwd);
			}
		} catch (error) {
			let reason: string;
			if (error instanceof ProfileNotFoundError) {
				reason = await buildProfileNotFoundReason(
					error.profileName,
					error.message,
				);
			} else {
				reason =
					error instanceof Error
						? error.message
						: `Unexpected error ${JSON.stringify(error)}`;
			}
			if (options.json) {
				sendRuleApplyFailedJson(targetDirectory, reason);
			} else {
				sendRuleApplyFailedMsg(`Failed to apply rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
