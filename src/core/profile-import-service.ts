import { Profile } from "@/domain/profile";
import { ProfileAlreadyExistsError } from "@/errors";
import type { ProfileService } from "./profile-service";

export interface ImportCandidate {
  name: string;
  gitName: string;
  email: string;
  signingKey: string | null;
}

export type ImportResultStatus = "imported" | "failed";
export type ImportResultKind = "imported" | "exists" | "failed" | "atomic-skipped";

export interface ImportResultItem {
  name: string;
  status: ImportResultStatus;
  kind: ImportResultKind;
  message: string;
}

export interface ImportSummaryResultItem {
  name: string;
  status: ImportResultStatus;
  message: string;
}

export interface ImportSummary {
  dryRun: boolean;
  total: number;
  imported: number;
  failed: number;
  results: ImportSummaryResultItem[];
}

export interface ExecuteImportOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  atomic?: boolean;
}

export interface ExecuteImportResult {
  summary: ImportSummary;
  results: ImportResultItem[];
  atomicAborted: boolean;
}

interface AtomicPreflightSuccess {
  name: string;
  candidate: ImportCandidate;
}

interface AtomicPreflightFailure {
  name: string;
  reason: string;
}

interface AtomicPreflightReport {
  successes: AtomicPreflightSuccess[];
  failures: AtomicPreflightFailure[];
}

export async function executeProfileImport(
  raw: unknown[],
  service: ProfileService,
  options: ExecuteImportOptions,
): Promise<ExecuteImportResult> {
  const results: ImportResultItem[] = [];
  const isDryRun = options.dryRun ?? false;
  const overwrite = options.overwrite ?? false;
  const atomic = options.atomic ?? false;

  if (atomic) {
    const preflight = await preflightAtomicCandidates(raw, service, overwrite);
    if (preflight.failures.length > 0) {
      for (const failure of preflight.failures) {
        results.push({
          name: failure.name,
          status: "failed",
          kind: "failed",
          message: failure.reason,
        });
      }
      for (const success of preflight.successes) {
        results.push({
          name: success.name,
          status: "failed",
          kind: "atomic-skipped",
          message: "Skipped due to --atomic precheck failure.",
        });
      }
      return {
        summary: buildImportSummary(results, isDryRun),
        results,
        atomicAborted: true,
      };
    }

    if (isDryRun) {
      for (const success of preflight.successes) {
        results.push({
          name: success.name,
          status: "imported",
          kind: "imported",
          message: "Validated for import.",
        });
      }
    } else {
      for (const success of preflight.successes) {
        await service.createProfile({
          ...success.candidate,
          force: overwrite,
        });
        results.push({
          name: success.name,
          status: "imported",
          kind: "imported",
          message: "Imported.",
        });
      }
    }

    return {
      summary: buildImportSummary(results, isDryRun),
      results,
      atomicAborted: false,
    };
  }

  for (const profileData of raw) {
    let sourceName = "<unknown>";
    try {
      const candidate = parseImportCandidate(profileData);
      sourceName = candidate.name;

      if (isDryRun) {
        await validateDryRunCandidate(service, candidate, overwrite);
      } else {
        await service.createProfile({
          ...candidate,
          force: overwrite,
        });
      }

      results.push({
        name: sourceName,
        status: "imported",
        kind: "imported",
        message: isDryRun ? "Validated for import." : "Imported.",
      });
    } catch (error) {
      if (error instanceof ProfileAlreadyExistsError) {
        results.push({
          name: sourceName,
          status: "failed",
          kind: "exists",
          message: "Profile already exists. Use --overwrite to replace.",
        });
        continue;
      }

      results.push({
        name: sourceName,
        status: "failed",
        kind: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    summary: buildImportSummary(results, isDryRun),
    results,
    atomicAborted: false,
  };
}

function buildImportSummary(results: ImportResultItem[], dryRun: boolean): ImportSummary {
  return {
    dryRun,
    total: results.length,
    imported: results.filter((item) => item.status === "imported").length,
    failed: results.filter((item) => item.status === "failed").length,
    results: results.map(({ name, status, message }) => ({
      name,
      status,
      message,
    })),
  };
}

async function preflightAtomicCandidates(
  raw: unknown[],
  service: ProfileService,
  overwrite: boolean,
): Promise<AtomicPreflightReport> {
  const seenNames = new Set<string>();
  const successes: AtomicPreflightSuccess[] = [];
  const failures: AtomicPreflightFailure[] = [];

  for (const profileData of raw) {
    let sourceName = "<unknown>";
    try {
      const candidate = parseImportCandidate(profileData);
      sourceName = candidate.name;
      if (seenNames.has(candidate.name)) {
        throw new Error(`Duplicate profile name '${candidate.name}' found in import payload.`);
      }
      seenNames.add(candidate.name);
      await validateDryRunCandidate(service, candidate, overwrite);
      successes.push({
        name: candidate.name,
        candidate,
      });
    } catch (error) {
      failures.push({
        name: sourceName,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    successes,
    failures,
  };
}

export function parseImportCandidate(profileData: unknown): ImportCandidate {
  if (
    profileData &&
    typeof profileData === "object" &&
    "state" in (profileData as Record<string, unknown>)
  ) {
    throw new Error("Invalid format: expected plain profile snapshots without 'state' wrapper.");
  }

  const source = profileData as Record<string, unknown>;
  const sourceName = String(source.name ?? "").trim();

  if (!sourceName) {
    throw new Error("Invalid format: profile name is required.");
  }

  return {
    name: sourceName,
    gitName: String(source.gitName ?? ""),
    email: String(source.email ?? ""),
    signingKey:
      source.signingKey === undefined || source.signingKey === null
        ? null
        : String(source.signingKey),
  };
}

async function validateDryRunCandidate(
  service: ProfileService,
  candidate: ImportCandidate,
  overwrite: boolean,
): Promise<void> {
  if (!overwrite && (await service.findProfile(candidate.name))) {
    throw new ProfileAlreadyExistsError(candidate.name);
  }

  Profile.create(candidate);
}
