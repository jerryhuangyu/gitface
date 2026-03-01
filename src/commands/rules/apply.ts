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
	sendRuleApplyFallbackAppliedJson,
	sendRuleApplyFallbackAppliedMsg,
	sendRuleApplyFallbackDryRunJson,
	sendRuleApplyFallbackDryRunMsg,
	sendRuleApplyFallbackUnchangedJson,
	sendRuleApplyFallbackUnchangedMsg,
	sendRuleApplyUnchangedJson,
	sendRuleApplyUnchangedMsg,
	sendRuleApplyUnmatchedJson,
	sendRuleApplyUnmatchedMsg,
} from "./ui";

interface ApplyRuleOptions {
	scope?: string;
	fallbackProfile?: string;
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

			const fallbackProfileName = options.fallbackProfile?.trim();
			if (!matchedRule && !fallbackProfileName) {
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

			const resolvedRule = matchedRule ?? undefined;
			const resolvedProfileName = resolvedRule
				? resolvedRule.profileName
				: fallbackProfileName;
			if (!resolvedProfileName) {
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

			const isFallback = !resolvedRule;
			const profile = await profileService.getProfile(resolvedProfileName);
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
					if (isFallback && options.json) {
						sendRuleApplyFallbackDryRunJson(
							targetDirectory,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					} else if (isFallback) {
						sendRuleApplyFallbackDryRunMsg(
							targetDirectory,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					} else if (options.json && resolvedRule) {
						sendRuleApplyDryRunJson(
							targetDirectory,
							resolvedRule,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					} else if (resolvedRule) {
						sendRuleApplyDryRunMsg(
							targetDirectory,
							resolvedRule,
							scope,
							profile,
							currentIdentity,
							effectiveChanges,
						);
					}
					return;
				}

				if (effectiveChanges.length === 0) {
					if (isFallback && options.json) {
						sendRuleApplyFallbackUnchangedJson(targetDirectory, scope, profile);
					} else if (isFallback) {
						sendRuleApplyFallbackUnchangedMsg(targetDirectory, scope, profile);
					} else if (options.json && resolvedRule) {
						sendRuleApplyUnchangedJson(
							targetDirectory,
							resolvedRule,
							scope,
							profile,
						);
					} else if (resolvedRule) {
						sendRuleApplyUnchangedMsg(
							targetDirectory,
							resolvedRule,
							scope,
							profile,
						);
					}
					return;
				}

				await scopedProfileService.applyProfile(profile.name, scope);
				if (isFallback && options.json) {
					sendRuleApplyFallbackAppliedJson(targetDirectory, scope, profile);
				} else if (isFallback) {
					sendRuleApplyFallbackAppliedMsg(targetDirectory, scope, profile);
				} else if (options.json && resolvedRule) {
					sendRuleApplyAppliedJson(
						targetDirectory,
						resolvedRule,
						scope,
						profile,
					);
				} else if (resolvedRule) {
					sendRuleApplyAppliedMsg(
						targetDirectory,
						resolvedRule,
						scope,
						profile,
					);
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
