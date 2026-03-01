import { randomUUID } from "node:crypto";
import process from "node:process";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import type { FolderRule } from "@/core/rule-service";
import { RuleService } from "@/core/rule-service";
import type { Profile } from "@/domain/profile";
import { Rule } from "@/domain/rule";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
	buildUseChangePlan,
	getEffectiveChanges,
	type UseChangeStep,
} from "../use/output";
import {
	sendRuleApplyAppliedJson,
	sendRuleApplyAppliedMsg,
	sendRuleApplyDryRunJson,
	sendRuleApplyDryRunMsg,
	sendRuleApplyEnvelopeError,
	sendRuleApplyFailedJson,
	sendRuleApplyFailedMsg,
	sendRuleApplyFallbackAppliedEnvelope,
	sendRuleApplyFallbackAppliedJson,
	sendRuleApplyFallbackAppliedMsg,
	sendRuleApplyFallbackDryRunEnvelope,
	sendRuleApplyFallbackDryRunJson,
	sendRuleApplyFallbackDryRunMsg,
	sendRuleApplyFallbackUnchangedEnvelope,
	sendRuleApplyFallbackUnchangedJson,
	sendRuleApplyFallbackUnchangedMsg,
	sendRuleApplyMatchedAppliedEnvelope,
	sendRuleApplyMatchedDryRunEnvelope,
	sendRuleApplyMatchedUnchangedEnvelope,
	sendRuleApplyUnchangedJson,
	sendRuleApplyUnchangedMsg,
	sendRuleApplyUnmatchedEnvelope,
	sendRuleApplyUnmatchedJson,
	sendRuleApplyUnmatchedMsg,
} from "./ui";

interface ApplyRuleOptions {
	scope?: string;
	fallbackProfile?: string;
	dryRun?: boolean;
	json?: boolean;
	jsonEnvelope?: boolean;
	strict?: boolean;
}

type ApplyOutputMode = "text" | "json" | "json-envelope";

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

const resolveOutputMode = (options: ApplyRuleOptions): ApplyOutputMode => {
	if (options.jsonEnvelope === true) {
		return "json-envelope";
	}
	if (options.json === true) {
		return "json";
	}
	return "text";
};

const writeApplyUnmatched = (
	outputMode: ApplyOutputMode,
	targetDirectory: string,
	scope: ConfigScope,
	durationMs: number,
	traceId: string,
): void => {
	if (outputMode === "json-envelope") {
		sendRuleApplyUnmatchedEnvelope(targetDirectory, scope, durationMs, traceId);
		return;
	}
	if (outputMode === "json") {
		sendRuleApplyUnmatchedJson(targetDirectory, scope);
		return;
	}
	sendRuleApplyUnmatchedMsg(targetDirectory, scope);
};

const writeApplyMatchedResult = (
	outputMode: ApplyOutputMode,
	result: "dry-run" | "unchanged" | "applied",
	targetDirectory: string,
	matchedRule: FolderRule,
	scope: ConfigScope,
	profile: Profile,
	currentIdentity: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
	effectiveChanges: UseChangeStep[],
	durationMs: number,
	traceId: string,
): void => {
	if (result === "dry-run") {
		if (outputMode === "json-envelope") {
			sendRuleApplyMatchedDryRunEnvelope(
				targetDirectory,
				matchedRule,
				scope,
				profile,
				currentIdentity,
				effectiveChanges,
				durationMs,
				traceId,
			);
			return;
		}
		if (outputMode === "json") {
			sendRuleApplyDryRunJson(
				targetDirectory,
				matchedRule,
				scope,
				profile,
				currentIdentity,
				effectiveChanges,
			);
			return;
		}
		sendRuleApplyDryRunMsg(
			targetDirectory,
			matchedRule,
			scope,
			profile,
			currentIdentity,
			effectiveChanges,
		);
		return;
	}

	if (result === "unchanged") {
		if (outputMode === "json-envelope") {
			sendRuleApplyMatchedUnchangedEnvelope(
				targetDirectory,
				matchedRule,
				scope,
				profile,
				durationMs,
				traceId,
			);
			return;
		}
		if (outputMode === "json") {
			sendRuleApplyUnchangedJson(targetDirectory, matchedRule, scope, profile);
			return;
		}
		sendRuleApplyUnchangedMsg(targetDirectory, matchedRule, scope, profile);
		return;
	}

	if (outputMode === "json-envelope") {
		sendRuleApplyMatchedAppliedEnvelope(
			targetDirectory,
			matchedRule,
			scope,
			profile,
			effectiveChanges,
			durationMs,
			traceId,
		);
		return;
	}
	if (outputMode === "json") {
		sendRuleApplyAppliedJson(targetDirectory, matchedRule, scope, profile);
		return;
	}
	sendRuleApplyAppliedMsg(targetDirectory, matchedRule, scope, profile);
};

const writeApplyFallbackResult = (
	outputMode: ApplyOutputMode,
	result: "dry-run" | "unchanged" | "applied",
	targetDirectory: string,
	scope: ConfigScope,
	profile: Profile,
	currentIdentity: {
		gitName: string | null;
		email: string | null;
		signingKey: string | null;
	},
	effectiveChanges: UseChangeStep[],
	durationMs: number,
	traceId: string,
): void => {
	if (result === "dry-run") {
		if (outputMode === "json-envelope") {
			sendRuleApplyFallbackDryRunEnvelope(
				targetDirectory,
				scope,
				profile,
				currentIdentity,
				effectiveChanges,
				durationMs,
				traceId,
			);
			return;
		}
		if (outputMode === "json") {
			sendRuleApplyFallbackDryRunJson(
				targetDirectory,
				scope,
				profile,
				currentIdentity,
				effectiveChanges,
			);
			return;
		}
		sendRuleApplyFallbackDryRunMsg(
			targetDirectory,
			scope,
			profile,
			currentIdentity,
			effectiveChanges,
		);
		return;
	}

	if (result === "unchanged") {
		if (outputMode === "json-envelope") {
			sendRuleApplyFallbackUnchangedEnvelope(
				targetDirectory,
				scope,
				profile,
				durationMs,
				traceId,
			);
			return;
		}
		if (outputMode === "json") {
			sendRuleApplyFallbackUnchangedJson(targetDirectory, scope, profile);
			return;
		}
		sendRuleApplyFallbackUnchangedMsg(targetDirectory, scope, profile);
		return;
	}

	if (outputMode === "json-envelope") {
		sendRuleApplyFallbackAppliedEnvelope(
			targetDirectory,
			scope,
			profile,
			effectiveChanges,
			durationMs,
			traceId,
		);
		return;
	}
	if (outputMode === "json") {
		sendRuleApplyFallbackAppliedJson(targetDirectory, scope, profile);
		return;
	}
	sendRuleApplyFallbackAppliedMsg(targetDirectory, scope, profile);
};

export const applyRuleAction: (
	directory: string | undefined,
	options: ApplyRuleOptions,
) => Promise<void> = withCommandHandling(
	"command:rules:apply",
	async (directory, options) => {
		const startedAtMs = Date.now();
		const traceId = randomUUID();
		const outputMode = resolveOutputMode(options);
		const targetDirectory = Rule.create(
			directory ?? process.cwd(),
			"dummy",
		).directory;
		const normalizedScope = (options.scope ?? "local").toLowerCase();
		if (!isValidScope(normalizedScope)) {
			const reason = "Scope must be one of: local, global, system.";
			if (outputMode === "json-envelope") {
				sendRuleApplyEnvelopeError(
					"RULE_APPLY_SCOPE_INVALID",
					reason,
					Date.now() - startedAtMs,
					traceId,
				);
			} else if (outputMode === "json") {
				sendRuleApplyFailedJson(targetDirectory, reason);
			} else {
				sendRuleApplyFailedMsg(reason);
			}
			process.exitCode = 1;
			return;
		}
		const scope = normalizedScope as ConfigScope;

		const ruleService = RuleService.create();
		const profileService = ProfileService.create();
		const scopedProfileService =
			scope === "local"
				? ProfileService.create({ gitBaseDir: targetDirectory })
				: profileService;

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
				writeApplyUnmatched(
					outputMode,
					targetDirectory,
					scope,
					Date.now() - startedAtMs,
					traceId,
				);
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
				writeApplyUnmatched(
					outputMode,
					targetDirectory,
					scope,
					Date.now() - startedAtMs,
					traceId,
				);
				if (options.strict) {
					process.exitCode = 1;
				}
				return;
			}

			const isFallback = !resolvedRule;
			const profile = await profileService.getProfile(resolvedProfileName);
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
				if (isFallback) {
					writeApplyFallbackResult(
						outputMode,
						"dry-run",
						targetDirectory,
						scope,
						profile,
						currentIdentity,
						effectiveChanges,
						Date.now() - startedAtMs,
						traceId,
					);
					return;
				}
				if (!resolvedRule) {
					return;
				}
				writeApplyMatchedResult(
					outputMode,
					"dry-run",
					targetDirectory,
					resolvedRule,
					scope,
					profile,
					currentIdentity,
					effectiveChanges,
					Date.now() - startedAtMs,
					traceId,
				);
				return;
			}

			if (effectiveChanges.length === 0) {
				if (isFallback) {
					writeApplyFallbackResult(
						outputMode,
						"unchanged",
						targetDirectory,
						scope,
						profile,
						currentIdentity,
						effectiveChanges,
						Date.now() - startedAtMs,
						traceId,
					);
					return;
				}
				if (!resolvedRule) {
					return;
				}
				writeApplyMatchedResult(
					outputMode,
					"unchanged",
					targetDirectory,
					resolvedRule,
					scope,
					profile,
					currentIdentity,
					effectiveChanges,
					Date.now() - startedAtMs,
					traceId,
				);
				return;
			}

			await scopedProfileService.applyProfile(profile.name, scope);
			if (isFallback) {
				writeApplyFallbackResult(
					outputMode,
					"applied",
					targetDirectory,
					scope,
					profile,
					currentIdentity,
					effectiveChanges,
					Date.now() - startedAtMs,
					traceId,
				);
				return;
			}
			if (!resolvedRule) {
				return;
			}
			writeApplyMatchedResult(
				outputMode,
				"applied",
				targetDirectory,
				resolvedRule,
				scope,
				profile,
				currentIdentity,
				effectiveChanges,
				Date.now() - startedAtMs,
				traceId,
			);
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
			if (outputMode === "json-envelope") {
				sendRuleApplyEnvelopeError(
					"RULE_APPLY_FAILED",
					reason,
					Date.now() - startedAtMs,
					traceId,
				);
			} else if (outputMode === "json") {
				sendRuleApplyFailedJson(targetDirectory, reason);
			} else {
				sendRuleApplyFailedMsg(`Failed to apply rule: ${reason}`);
			}
			process.exitCode = 1;
		}
	},
);
