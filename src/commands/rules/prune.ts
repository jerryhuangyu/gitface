import process from "node:process";
import { RuleService } from "@/core/rule-service";
import { withCommandHandling } from "../command-runner";
import {
  parseConcurrency,
  type RuleIntegrityRecord,
  type RuleIntegrityScanMetrics,
  scanRuleIntegrity,
} from "./integrity";
import {
  type RulePruneReport,
  type RulePruneResult,
  sendRulePruneFailedJson,
  sendRulePruneFailedMsg,
  sendRulePruneReportJson,
  sendRulePruneReportMsg,
} from "./ui";

interface RulePruneOptions {
  dryRun?: boolean;
  json?: boolean;
  includeMissingDirectory?: boolean;
  strict?: boolean;
  concurrency?: string;
}

const isMissingGlobalConfigError = (error: unknown): boolean => {
  return (
    error instanceof Error && error.message.toLowerCase().includes("unable to read config file")
  );
};

async function scanPrunableRules(
  integrityResults: RuleIntegrityRecord[],
  options: RulePruneOptions,
): Promise<RulePruneResult[]> {
  const includeMissingDirectory = options.includeMissingDirectory ?? false;

  const candidates: RulePruneResult[] = [];
  for (const result of integrityResults) {
    if (!includeMissingDirectory) {
      if (!result.profileExists) {
        candidates.push({
          directory: result.directory,
          profileName: result.profileName,
          profileExists: false,
          status: "candidate",
        });
      }
      continue;
    }

    if (result.profileExists && result.directoryExists) {
      continue;
    }
    const staleReason =
      !result.profileExists && !result.directoryExists
        ? "missing-profile-and-directory"
        : !result.profileExists
          ? "missing-profile"
          : "missing-directory";
    candidates.push({
      directory: result.directory,
      profileName: result.profileName,
      profileExists: result.profileExists,
      directoryExists: result.directoryExists,
      staleReason,
      status: "candidate",
    });
  }

  return candidates;
}

const buildEmptyMetrics = (concurrency: number): RuleIntegrityScanMetrics => ({
  concurrency,
  scanned: 0,
  uniqueProfilesChecked: 0,
  uniqueDirectoriesChecked: 0,
  scanDurationMs: 0,
});

async function buildDryRunReportWithOptions(
  options: RulePruneOptions,
  concurrency: number,
): Promise<RulePruneReport> {
  const ruleService = RuleService.create();
  const scannedRules = await ruleService.listRules().catch((error) => {
    if (isMissingGlobalConfigError(error)) {
      return [];
    }
    throw error;
  });
  const integrityReport =
    scannedRules.length === 0
      ? {
          records: [],
          metrics: buildEmptyMetrics(concurrency),
        }
      : await scanRuleIntegrity(scannedRules, {
          checkDirectory: options.includeMissingDirectory ?? false,
          concurrency,
        });
  const results = await scanPrunableRules(integrityReport.records, options);
  return {
    status: "dry-run",
    dryRun: true,
    summary: {
      scanned: scannedRules.length,
      prunable: results.length,
      pruned: 0,
      skipped: 0,
    },
    metrics: integrityReport.metrics,
    results,
  };
}

async function buildApplyReport(
  options: RulePruneOptions,
  concurrency: number,
): Promise<RulePruneReport> {
  const ruleService = RuleService.create();
  const scannedRules = await ruleService.listRules().catch((error) => {
    if (isMissingGlobalConfigError(error)) {
      return [];
    }
    throw error;
  });
  const integrityReport =
    scannedRules.length === 0
      ? {
          records: [],
          metrics: buildEmptyMetrics(concurrency),
        }
      : await scanRuleIntegrity(scannedRules, {
          checkDirectory: options.includeMissingDirectory ?? false,
          concurrency,
        });
  const candidates = await scanPrunableRules(integrityReport.records, options);

  const results: RulePruneResult[] = [];
  let pruned = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      await ruleService.removeRule(candidate.directory);
      results.push({
        ...candidate,
        status: "pruned",
      });
      pruned += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        ...candidate,
        status: "skipped",
        reason,
      });
      skipped += 1;
    }
  }

  return {
    status: skipped > 0 ? "partial" : "pruned",
    dryRun: false,
    summary: {
      scanned: scannedRules.length,
      prunable: candidates.length,
      pruned,
      skipped,
    },
    metrics: integrityReport.metrics,
    results,
  };
}

export const pruneRuleAction: (options: RulePruneOptions) => Promise<void> = withCommandHandling(
  "command:rules:prune",
  async (options) => {
    try {
      const concurrency = parseConcurrency(options.concurrency);
      const report = options.dryRun
        ? await buildDryRunReportWithOptions(options, concurrency)
        : await buildApplyReport(options, concurrency);
      if (options.json) {
        sendRulePruneReportJson(report, options.strict ?? false);
      } else {
        sendRulePruneReportMsg(report, options.strict ?? false);
      }

      if (
        (options.dryRun && options.strict && report.summary.prunable > 0) ||
        (!options.dryRun && report.summary.skipped > 0)
      ) {
        process.exitCode = 1;
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : `Unexpected error ${JSON.stringify(error)}`;
      if (options.json) {
        sendRulePruneFailedJson(reason);
      } else {
        sendRulePruneFailedMsg(`Failed to prune rules: ${reason}`);
      }
      process.exitCode = 1;
    }
  },
);
