import chalk from "chalk";
import type { ConfigScope } from "@/core/git-service";
import { buildResultEnvelope, type ResultEnvelope } from "@/core/result-envelope";
import type { FolderRule } from "@/core/rule-service";
import type { Profile } from "@/domain/profile";
import type { UseChangeStep } from "../use/output";

export interface RuleDoctorResult {
  directory: string;
  profileName: string;
  status: "pass" | "warn" | "fail";
  profileExists: boolean;
  directoryExists: boolean;
}

export interface RuleDoctorReport {
  status: "ok" | "issues";
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  metrics: RuleScanMetrics;
  results: RuleDoctorResult[];
}

export interface RulePruneResult {
  directory: string;
  profileName: string;
  profileExists: boolean;
  directoryExists?: boolean;
  staleReason?: "missing-profile" | "missing-directory" | "missing-profile-and-directory";
  status: "candidate" | "pruned" | "skipped";
  reason?: string;
}

export interface RulePruneReport {
  status: "dry-run" | "pruned" | "partial";
  dryRun: boolean;
  summary: {
    scanned: number;
    prunable: number;
    pruned: number;
    skipped: number;
  };
  metrics: RuleScanMetrics;
  results: RulePruneResult[];
}

export interface RuleScanMetrics {
  concurrency: number;
  scanned: number;
  uniqueProfilesChecked: number;
  uniqueDirectoriesChecked: number;
  scanDurationMs: number;
}

interface RuleAddEnvelopeData {
  result: "added" | "dry-run";
  directory: string;
  profileName: string;
  overwrite: boolean;
}

interface RuleRemoveEnvelopeData {
  result: "removed" | "dry-run";
  directory: string;
  exists: boolean | null;
}

interface RuleResolveEnvelopeData {
  result: "matched" | "unmatched";
  directory: string;
  matchedRule: FolderRule | null;
  profileExists: boolean | null;
}

export function sendRuleAddSuccessMsg(directory: string, profileName: string): void {
  console.log(
    chalk.green(`Rule added: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`),
  );
}

export function sendRuleAddSuccessJson(directory: string, profileName: string): void {
  console.log(
    JSON.stringify({
      status: "added",
      directory,
      profileName,
    }),
  );
}

export function sendRuleAddDryRunMsg(
  directory: string,
  profileName: string,
  overwrite: boolean,
): void {
  console.log(chalk.blue("Dry run: no git config was changed."));
  if (overwrite) {
    console.log(
      chalk.green(
        `Rule would be updated: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
      ),
    );
    return;
  }
  console.log(
    chalk.green(
      `Rule would be added: ${chalk.cyan(directory)} matches profile ${chalk.bold(profileName)}`,
    ),
  );
}

export function sendRuleAddDryRunJson(
  directory: string,
  profileName: string,
  overwrite: boolean,
): void {
  console.log(
    JSON.stringify({
      status: "dry-run",
      directory,
      profileName,
      overwrite,
    }),
  );
}

export function sendRuleAddFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRuleAddFailedJson(
  directory: string,
  profileName: string,
  reason: string,
): void {
  console.log(
    JSON.stringify({
      status: "error",
      directory,
      profileName,
      reason,
    }),
  );
}

const writeRuleAddEnvelope = (envelope: ResultEnvelope<RuleAddEnvelopeData | null>): void => {
  console.log(JSON.stringify(envelope));
};

export function sendRuleAddSuccessResultEnvelope(
  directory: string,
  profileName: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleAddEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_ADD_OK",
      message: "Rule added successfully.",
      data: {
        result: "added",
        directory,
        profileName,
        overwrite: false,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleAddDryRunResultEnvelope(
  directory: string,
  profileName: string,
  overwrite: boolean,
  durationMs: number,
  traceId: string,
): void {
  writeRuleAddEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_ADD_DRY_RUN",
      message: "Rule add dry-run completed.",
      data: {
        result: "dry-run",
        directory,
        profileName,
        overwrite,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleAddFailedResultEnvelope(
  directory: string,
  profileName: string,
  reason: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleAddEnvelope(
    buildResultEnvelope({
      status: "error",
      code: "RULE_ADD_FAILED",
      message: reason,
      data: {
        result: "added",
        directory,
        profileName,
        overwrite: false,
      },
      errors: [{ code: "RULE_ADD_FAILED", message: reason }],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleRemoveSuccessMsg(directory: string): void {
  console.log(chalk.green(`Rule removed for directory: ${chalk.cyan(directory)}`));
}

export function sendRuleRemoveSuccessJson(directory: string): void {
  console.log(
    JSON.stringify({
      status: "removed",
      directory,
    }),
  );
}

export function sendRuleRemoveDryRunMsg(directory: string, exists: boolean): void {
  console.log(chalk.blue("Dry run: no git config was changed."));
  if (exists) {
    console.log(chalk.green(`Rule would be removed for: ${chalk.cyan(directory)}`));
    return;
  }
  console.log(
    chalk.yellow(`No matching rule found for: ${chalk.cyan(directory)} (would be a no-op)`),
  );
}

export function sendRuleRemoveDryRunJson(directory: string, exists: boolean): void {
  console.log(
    JSON.stringify({
      status: "dry-run",
      directory,
      exists,
    }),
  );
}

export function sendRuleRemoveFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRuleRemoveFailedJson(directory: string, reason: string): void {
  console.log(
    JSON.stringify({
      status: "error",
      directory,
      reason,
    }),
  );
}

const writeRuleRemoveEnvelope = (envelope: ResultEnvelope<RuleRemoveEnvelopeData | null>): void => {
  console.log(JSON.stringify(envelope));
};

export function sendRuleRemoveSuccessResultEnvelope(
  directory: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleRemoveEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_REMOVE_OK",
      message: "Rule removed successfully.",
      data: {
        result: "removed",
        directory,
        exists: null,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleRemoveDryRunResultEnvelope(
  directory: string,
  exists: boolean,
  durationMs: number,
  traceId: string,
): void {
  writeRuleRemoveEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_REMOVE_DRY_RUN",
      message: "Rule remove dry-run completed.",
      data: {
        result: "dry-run",
        directory,
        exists,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleRemoveFailedResultEnvelope(
  directory: string,
  reason: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleRemoveEnvelope(
    buildResultEnvelope({
      status: "error",
      code: "RULE_REMOVE_FAILED",
      message: reason,
      data: {
        result: "removed",
        directory,
        exists: null,
      },
      errors: [{ code: "RULE_REMOVE_FAILED", message: reason }],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleResolveMatchedMsg(
  targetDirectory: string,
  matchedRule: FolderRule,
  profileExists: boolean,
): void {
  console.log(chalk.bold("Resolved folder rule:"));
  console.log(
    `${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(matchedRule.profileName)} ${chalk.gray(`(${matchedRule.directory})`)}`,
  );
  if (!profileExists) {
    console.log(
      chalk.yellow(
        `Warning: matched profile '${matchedRule.profileName}' does not exist in local profile store.`,
      ),
    );
  }
}

export function sendRuleResolveMatchedJson(
  targetDirectory: string,
  matchedRule: FolderRule,
  profileExists: boolean,
): void {
  console.log(
    JSON.stringify({
      status: "matched",
      directory: targetDirectory,
      matchedRule,
      profileExists,
    }),
  );
}

export function sendRuleResolveUnmatchedMsg(targetDirectory: string): void {
  console.log(chalk.gray(`No folder rule matched target directory: ${targetDirectory}`));
}

export function sendRuleResolveUnmatchedJson(targetDirectory: string): void {
  console.log(
    JSON.stringify({
      status: "unmatched",
      directory: targetDirectory,
      matchedRule: null,
      profileExists: null,
    }),
  );
}

export function sendRuleResolveFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRuleResolveFailedJson(directory: string, reason: string): void {
  console.log(
    JSON.stringify({
      status: "error",
      directory,
      reason,
    }),
  );
}

const writeRuleResolveEnvelope = (
  envelope: ResultEnvelope<RuleResolveEnvelopeData | null>,
): void => {
  console.log(JSON.stringify(envelope));
};

export function sendRuleResolveMatchedResultEnvelope(
  targetDirectory: string,
  matchedRule: FolderRule,
  profileExists: boolean,
  durationMs: number,
  traceId: string,
): void {
  writeRuleResolveEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_RESOLVE_MATCHED",
      message: "Rule resolved successfully.",
      data: {
        result: "matched",
        directory: targetDirectory,
        matchedRule,
        profileExists,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleResolveUnmatchedResultEnvelope(
  targetDirectory: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleResolveEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "RULE_RESOLVE_UNMATCHED",
      message: "No matching rule found for target directory.",
      data: {
        result: "unmatched",
        directory: targetDirectory,
        matchedRule: null,
        profileExists: null,
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleResolveFailedResultEnvelope(
  directory: string,
  reason: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleResolveEnvelope(
    buildResultEnvelope({
      status: "error",
      code: "RULE_RESOLVE_FAILED",
      message: reason,
      data: {
        result: "unmatched",
        directory,
        matchedRule: null,
        profileExists: null,
      },
      errors: [{ code: "RULE_RESOLVE_FAILED", message: reason }],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleApplyAppliedMsg(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(chalk.bold("Applied folder rule profile:"));
  console.log(
    `${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
  );
  console.log(chalk.green(`Applied to ${chalk.bold(scope)} scope with profile '${profile.name}'.`));
}

export function sendRuleApplyAppliedJson(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    JSON.stringify({
      status: "applied",
      directory: targetDirectory,
      scope,
      matchedRule,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
    }),
  );
}

export function sendRuleApplyUnchangedMsg(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(chalk.bold("Folder rule resolved:"));
  console.log(
    `${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
  );
  console.log(
    chalk.green(
      `Profile '${profile.name}' is already active for ${chalk.bold(scope)} scope. No changes were written.`,
    ),
  );
}

export function sendRuleApplyUnchangedJson(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    JSON.stringify({
      status: "unchanged",
      directory: targetDirectory,
      scope,
      matchedRule,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
      changes: [],
    }),
  );
}

export function sendRuleApplyDryRunMsg(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
): void {
  console.log(chalk.blue("Dry run: no git config was changed."));
  console.log(
    `Resolved ${chalk.cyan(targetDirectory)} ${chalk.gray("=>")} ${chalk.green(profile.name)} ${chalk.gray(`(${matchedRule.directory})`)}`,
  );
  console.log(`${chalk.gray("Scope:")} ${chalk.green(scope)}`);
  if (changes.length === 0) {
    console.log(
      chalk.green(`No changes detected. Profile '${profile.name}' already matches ${scope} scope.`),
    );
    return;
  }
  for (const change of changes) {
    const actionLabel = change.action === "unset" ? "UNSET" : "SET";
    console.log(
      `${chalk.gray(change.key)} ${chalk.yellow(actionLabel)} ${formatValue(change.before)} -> ${formatValue(change.after)}`,
    );
  }
  if (current.gitName === null && current.email === null && current.signingKey === null) {
    console.log(chalk.gray("Current identity is empty in target scope."));
  }
}

export function sendRuleApplyDryRunJson(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
): void {
  console.log(
    JSON.stringify({
      status: "dry-run",
      directory: targetDirectory,
      scope,
      matchedRule,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
      current,
      hasChanges: changes.length > 0,
      changes: changes.map((change) => ({
        key: change.key,
        action: change.action,
        before: change.before,
        after: change.after,
      })),
    }),
  );
}

export function sendRuleApplyFallbackAppliedMsg(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    chalk.yellow(
      `No folder rule matched ${targetDirectory}. Applying fallback profile '${profile.name}'.`,
    ),
  );
  console.log(chalk.green(`Applied to ${chalk.bold(scope)} scope with profile '${profile.name}'.`));
}

export function sendRuleApplyFallbackAppliedJson(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    JSON.stringify({
      status: "applied",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
    }),
  );
}

export function sendRuleApplyFallbackUnchangedMsg(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    chalk.yellow(
      `No folder rule matched ${targetDirectory}. Fallback profile '${profile.name}' selected.`,
    ),
  );
  console.log(
    chalk.green(
      `Profile '${profile.name}' already matches ${chalk.bold(scope)} scope. No changes were written.`,
    ),
  );
}

export function sendRuleApplyFallbackUnchangedJson(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
): void {
  console.log(
    JSON.stringify({
      status: "unchanged",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
      changes: [],
    }),
  );
}

export function sendRuleApplyFallbackDryRunMsg(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
): void {
  console.log(chalk.blue("Dry run: no git config was changed."));
  console.log(
    chalk.yellow(
      `No folder rule matched ${targetDirectory}. Previewing fallback profile '${profile.name}'.`,
    ),
  );
  console.log(`${chalk.gray("Scope:")} ${chalk.green(scope)}`);
  if (changes.length === 0) {
    console.log(
      chalk.green(`No changes detected. Profile '${profile.name}' already matches ${scope} scope.`),
    );
    return;
  }
  for (const change of changes) {
    const actionLabel = change.action === "unset" ? "UNSET" : "SET";
    console.log(
      `${chalk.gray(change.key)} ${chalk.yellow(actionLabel)} ${formatValue(change.before)} -> ${formatValue(change.after)}`,
    );
  }
  if (current.gitName === null && current.email === null && current.signingKey === null) {
    console.log(chalk.gray("Current identity is empty in target scope."));
  }
}

export function sendRuleApplyFallbackDryRunJson(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
): void {
  console.log(
    JSON.stringify({
      status: "dry-run",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: {
        name: profile.name,
        gitName: profile.gitName,
        email: profile.email,
        signingKey: profile.signingKey ?? null,
      },
      current,
      hasChanges: changes.length > 0,
      changes: changes.map((change) => ({
        key: change.key,
        action: change.action,
        before: change.before,
        after: change.after,
      })),
    }),
  );
}

export function sendRuleApplyUnmatchedMsg(targetDirectory: string, scope: ConfigScope): void {
  console.log(
    chalk.gray(`No folder rule matched target directory: ${targetDirectory} (scope: ${scope}).`),
  );
}

export function sendRuleApplyUnmatchedJson(targetDirectory: string, scope: ConfigScope): void {
  console.log(
    JSON.stringify({
      status: "unmatched",
      directory: targetDirectory,
      scope,
      matchedRule: null,
    }),
  );
}

export function sendRuleApplyFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRuleApplyFailedJson(directory: string, reason: string): void {
  console.log(
    JSON.stringify({
      status: "error",
      directory,
      reason,
    }),
  );
}

interface RuleApplyEnvelopeProfile {
  name: string;
  gitName: string;
  email: string;
  signingKey: string | null;
}

interface RuleApplyEnvelopeData {
  result: "applied" | "dry-run" | "unchanged" | "unmatched";
  resolution: "matched" | "fallback" | "none";
  directory: string;
  scope: ConfigScope;
  matchedRule: FolderRule | null;
  fallbackProfileName: string | null;
  profile: RuleApplyEnvelopeProfile | null;
  hasChanges: boolean;
  changes: UseChangeStep[];
  current?: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  };
}

const toRuleApplyEnvelopeProfile = (profile: Profile): RuleApplyEnvelopeProfile => {
  return {
    name: profile.name,
    gitName: profile.gitName,
    email: profile.email,
    signingKey: profile.signingKey ?? null,
  };
};

const toRuleApplyEnvelopeChanges = (changes: UseChangeStep[]): UseChangeStep[] => {
  return changes.map((item) => ({
    key: item.key,
    action: item.action,
    before: item.before,
    after: item.after,
  }));
};

const writeRuleApplyEnvelope = (envelope: ResultEnvelope<RuleApplyEnvelopeData | null>): void => {
  console.log(JSON.stringify(envelope));
};

const writeRuleApplySuccessEnvelope = (
  code: string,
  message: string,
  data: RuleApplyEnvelopeData,
  durationMs: number,
  traceId: string,
): void => {
  writeRuleApplyEnvelope(
    buildResultEnvelope({
      status: "success",
      code,
      message,
      data,
      errors: [],
      durationMs,
      traceId,
    }),
  );
};

export function sendRuleApplyMatchedAppliedEnvelope(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
  changes: UseChangeStep[],
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_APPLIED",
    "Matched rule profile applied successfully.",
    {
      result: "applied",
      resolution: "matched",
      directory: targetDirectory,
      scope,
      matchedRule,
      fallbackProfileName: null,
      profile: toRuleApplyEnvelopeProfile(profile),
      hasChanges: true,
      changes: toRuleApplyEnvelopeChanges(changes),
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyMatchedUnchangedEnvelope(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_UNCHANGED",
    "Matched rule profile already active for target scope.",
    {
      result: "unchanged",
      resolution: "matched",
      directory: targetDirectory,
      scope,
      matchedRule,
      fallbackProfileName: null,
      profile: toRuleApplyEnvelopeProfile(profile),
      hasChanges: false,
      changes: [],
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyMatchedDryRunEnvelope(
  targetDirectory: string,
  matchedRule: FolderRule,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_DRY_RUN",
    "Matched rule dry-run plan generated.",
    {
      result: "dry-run",
      resolution: "matched",
      directory: targetDirectory,
      scope,
      matchedRule,
      fallbackProfileName: null,
      profile: toRuleApplyEnvelopeProfile(profile),
      current,
      hasChanges: changes.length > 0,
      changes: toRuleApplyEnvelopeChanges(changes),
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyFallbackAppliedEnvelope(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
  changes: UseChangeStep[],
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_APPLIED",
    "Fallback profile applied successfully.",
    {
      result: "applied",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: toRuleApplyEnvelopeProfile(profile),
      hasChanges: true,
      changes: toRuleApplyEnvelopeChanges(changes),
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyFallbackUnchangedEnvelope(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_UNCHANGED",
    "Fallback profile already active for target scope.",
    {
      result: "unchanged",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: toRuleApplyEnvelopeProfile(profile),
      hasChanges: false,
      changes: [],
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyFallbackDryRunEnvelope(
  targetDirectory: string,
  scope: ConfigScope,
  profile: Profile,
  current: {
    gitName: string | null;
    email: string | null;
    signingKey: string | null;
  },
  changes: UseChangeStep[],
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_DRY_RUN",
    "Fallback profile dry-run plan generated.",
    {
      result: "dry-run",
      resolution: "fallback",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: profile.name,
      profile: toRuleApplyEnvelopeProfile(profile),
      current,
      hasChanges: changes.length > 0,
      changes: toRuleApplyEnvelopeChanges(changes),
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyUnmatchedEnvelope(
  targetDirectory: string,
  scope: ConfigScope,
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplySuccessEnvelope(
    "RULE_APPLY_UNMATCHED",
    "No rule matched target directory and no fallback profile was provided.",
    {
      result: "unmatched",
      resolution: "none",
      directory: targetDirectory,
      scope,
      matchedRule: null,
      fallbackProfileName: null,
      profile: null,
      hasChanges: false,
      changes: [],
    },
    durationMs,
    traceId,
  );
}

export function sendRuleApplyEnvelopeError(
  code: string,
  message: string,
  durationMs: number,
  traceId: string,
): void {
  writeRuleApplyEnvelope(
    buildResultEnvelope({
      status: "error",
      code,
      message,
      data: null,
      errors: [{ code, message }],
      durationMs,
      traceId,
    }),
  );
}

export function sendRuleDoctorReportMsg(report: RuleDoctorReport, strict: boolean): void {
  console.log(chalk.bold("Folder rule health report:"));
  if (report.summary.total === 0) {
    console.log(chalk.gray("No folder rules found."));
    console.log(
      chalk.gray(`Summary: total=0 pass=0 warn=0 fail=0${strict ? " (strict mode)" : ""}`),
    );
    return;
  }
  for (const result of report.results) {
    const label =
      result.status === "pass"
        ? chalk.green("PASS")
        : result.status === "warn"
          ? chalk.yellow("WARN")
          : chalk.red("FAIL");
    const details: string[] = [];
    if (!result.profileExists) {
      details.push("profile missing");
    }
    if (!result.directoryExists) {
      details.push("directory missing");
    }
    const detailText = details.length > 0 ? ` (${details.join(", ")})` : " (healthy)";
    console.log(
      `${label} ${chalk.cyan(result.directory)} -> ${chalk.bold(result.profileName)}${chalk.gray(detailText)}`,
    );
  }
  console.log(
    chalk.gray(
      `Summary: total=${report.summary.total} pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail}${strict ? " (strict mode)" : ""}`,
    ),
  );
  console.log(
    chalk.gray(
      `Scan metrics: concurrency=${report.metrics.concurrency} scanned=${report.metrics.scanned} uniqueProfiles=${report.metrics.uniqueProfilesChecked} uniqueDirectories=${report.metrics.uniqueDirectoriesChecked} durationMs=${report.metrics.scanDurationMs}`,
    ),
  );
}

export function sendRuleDoctorReportJson(report: RuleDoctorReport, strict: boolean): void {
  console.log(
    JSON.stringify({
      status: report.status,
      strict,
      summary: report.summary,
      metrics: report.metrics,
      results: report.results,
    }),
  );
}

export function sendRuleDoctorFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRuleDoctorFailedJson(reason: string): void {
  console.log(
    JSON.stringify({
      status: "error",
      reason,
    }),
  );
}

export function sendRulePruneReportMsg(report: RulePruneReport, strict: boolean): void {
  console.log(chalk.bold("Folder rule prune report:"));
  console.log(
    chalk.gray(
      `Summary: scanned=${report.summary.scanned} prunable=${report.summary.prunable} pruned=${report.summary.pruned} skipped=${report.summary.skipped}${report.dryRun ? " (dry-run)" : ""}${strict ? " (strict mode)" : ""}`,
    ),
  );
  console.log(
    chalk.gray(
      `Scan metrics: concurrency=${report.metrics.concurrency} scanned=${report.metrics.scanned} uniqueProfiles=${report.metrics.uniqueProfilesChecked} uniqueDirectories=${report.metrics.uniqueDirectoriesChecked} durationMs=${report.metrics.scanDurationMs}`,
    ),
  );
  if (report.results.length === 0) {
    console.log(chalk.green("No stale rules found."));
    return;
  }

  for (const result of report.results) {
    const label =
      result.status === "candidate"
        ? chalk.yellow("CANDIDATE")
        : result.status === "pruned"
          ? chalk.green("PRUNED")
          : chalk.red("SKIPPED");
    const reasonText = result.reason
      ? chalk.gray(` (${result.reason})`)
      : chalk.gray(` (${formatPruneStaleReason(result)})`);
    console.log(
      `${label} ${chalk.cyan(result.directory)} -> ${chalk.bold(result.profileName)}${reasonText}`,
    );
  }
}

export function sendRulePruneReportJson(report: RulePruneReport, strict: boolean): void {
  console.log(
    JSON.stringify({
      ...report,
      strict,
    }),
  );
}

export function sendRulePruneFailedMsg(reason: string): void {
  console.error(chalk.red(reason));
}

export function sendRulePruneFailedJson(reason: string): void {
  console.log(
    JSON.stringify({
      status: "error",
      reason,
    }),
  );
}

function formatValue(value: string | null): string {
  return value === null ? chalk.dim("<unset>") : chalk.white(value);
}

function formatPruneStaleReason(result: RulePruneResult): string {
  if (result.staleReason === "missing-profile-and-directory") {
    return "profile missing, directory missing";
  }
  if (result.staleReason === "missing-directory") {
    return "directory missing";
  }
  if (result.staleReason === "missing-profile") {
    return "profile missing";
  }
  return "profile missing";
}
