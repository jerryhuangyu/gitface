import { randomUUID } from "node:crypto";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
  buildUseChangePlan,
  getEffectiveChanges,
  sendProfileUseAppliedEnvelope,
  sendProfileUseDryRunEnvelope,
  sendProfileUseDryRunJson,
  sendProfileUseDryRunMsg,
  sendProfileUseEnvelopeError,
  sendProfileUseFailedJson,
  sendProfileUseFailedMsg,
  sendProfileUseNoopEnvelope,
  sendProfileUseNoopJson,
  sendProfileUseNoopMsg,
  sendProfileUseSuccessJson,
  sendProfileUseSuccessMsg,
} from "./output";

interface UseProfileOptions {
  scope?: string;
  dryRun?: boolean;
  json?: boolean;
  jsonEnvelope?: boolean;
  query?: string;
}

export interface PromptForProfileSelectionOptions {
  candidates: string[];
  query?: string;
}

export type PromptForProfileSelection = (
  options: PromptForProfileSelectionOptions,
) => Promise<string | null>;

export const runUseAction = async (
  name: string | undefined,
  options: UseProfileOptions,
  promptForSelectionOrContext: PromptForProfileSelection | unknown = promptForProfileSelection,
): Promise<void> => {
  const startedAtMs = Date.now();
  const traceId = randomUUID();
  const promptForSelection =
    typeof promptForSelectionOrContext === "function"
      ? (promptForSelectionOrContext as PromptForProfileSelection)
      : promptForProfileSelection;
  const outputMode =
    options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
  const allowInteractiveSelection = outputMode === "text";

  const normalizedScope = (options.scope ?? "local").toLowerCase();
  if (!isValidScope(normalizedScope)) {
    const reason = "Scope must be one of: local, global, system.";
    if (outputMode === "json-envelope") {
      sendProfileUseEnvelopeError("USE_SCOPE_INVALID", reason, Date.now() - startedAtMs, traceId);
    } else if (outputMode === "json") {
      sendProfileUseFailedJson(reason);
    } else {
      sendProfileUseFailedMsg(reason);
    }
    process.exitCode = 1;
    return;
  }
  const scope = normalizedScope as ConfigScope;

  let profileName = name;
  const service = ProfileService.create();
  if (!profileName) {
    const resolved = await resolveProfileName({
      service,
      query: options.query,
      promptForSelection,
      allowInteractive: allowInteractiveSelection,
    });

    if ("reason" in resolved) {
      if (outputMode === "json-envelope") {
        sendProfileUseEnvelopeError(
          "USE_PROFILE_SELECTION_FAILED",
          resolved.reason,
          Date.now() - startedAtMs,
          traceId,
        );
      } else if (outputMode === "json") {
        sendProfileUseFailedJson(resolved.reason);
      } else {
        sendProfileUseFailedMsg(resolved.reason);
      }
      process.exitCode = 1;
      return;
    }

    profileName = resolved.profileName;
  }

  try {
    const profile = await service.getProfile(profileName);
    const scopedIdentity = await service.getScopedIdentity(scope);
    const currentIdentity = {
      gitName: scopedIdentity.gitName ?? null,
      email: scopedIdentity.email ?? null,
      signingKey: scopedIdentity.signingKey ?? null,
    };
    const plan = buildUseChangePlan(profile, currentIdentity);
    const effectiveChanges = getEffectiveChanges(plan);

    if (options.dryRun) {
      if (outputMode === "json-envelope") {
        sendProfileUseDryRunEnvelope(
          profile,
          scope,
          currentIdentity,
          Date.now() - startedAtMs,
          traceId,
        );
        return;
      }
      if (outputMode === "json") {
        sendProfileUseDryRunJson(profile, scope, currentIdentity);
        return;
      }

      sendProfileUseDryRunMsg(profile, scope, currentIdentity);
      return;
    }

    if (effectiveChanges.length === 0) {
      if (outputMode === "json-envelope") {
        sendProfileUseNoopEnvelope(profile, scope, Date.now() - startedAtMs, traceId);
        return;
      }
      if (outputMode === "json") {
        sendProfileUseNoopJson(profile, scope);
        return;
      }
      sendProfileUseNoopMsg(profile, scope);
      return;
    }

    await service.applyProfile(profileName, scope);

    if (outputMode === "json-envelope") {
      sendProfileUseAppliedEnvelope(
        profile,
        scope,
        effectiveChanges,
        Date.now() - startedAtMs,
        traceId,
      );
      return;
    }
    if (outputMode === "json") {
      sendProfileUseSuccessJson(profile, scope, effectiveChanges);
      return;
    }

    sendProfileUseSuccessMsg(profile, scope);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      const reason = await buildProfileNotFoundReason(
        profileName ?? error.profileName,
        error.message,
      );
      if (outputMode === "json-envelope") {
        sendProfileUseEnvelopeError(
          "USE_PROFILE_NOT_FOUND",
          reason,
          Date.now() - startedAtMs,
          traceId,
        );
      } else if (outputMode === "json") {
        sendProfileUseFailedJson(reason);
      } else {
        sendProfileUseFailedMsg(reason);
      }
      process.exitCode = 1;
      return;
    }

    if (outputMode !== "text" && error instanceof InvalidProfileError) {
      if (outputMode === "json-envelope") {
        sendProfileUseEnvelopeError(
          "USE_PROFILE_INVALID",
          error.message,
          Date.now() - startedAtMs,
          traceId,
        );
      } else {
        sendProfileUseFailedJson(error.message);
      }
      process.exitCode = 1;
      return;
    }
    throw error;
  }
};

const action: (name: string | undefined, options: UseProfileOptions) => Promise<void> =
  withCommandHandling("command:use", async (name, options) => {
    await runUseAction(name, options);
  });

export default action;

export const promptForProfileSelection: PromptForProfileSelection = async ({
  candidates,
  query,
}) => {
  const [{ render }, { SelectProfile }] = await Promise.all([
    import("ink"),
    import("./select-profile"),
  ]);

  return await new Promise<string | null>((resolve) => {
    render(
      <SelectProfile
        candidates={candidates}
        query={query}
        onSelect={(selected) => {
          resolve(selected);
        }}
        onEmpty={() => {
          resolve(null);
        }}
      />,
    );
  });
};

async function resolveProfileName({
  service,
  query,
  promptForSelection,
  allowInteractive,
}: {
  service: ProfileService;
  query?: string;
  promptForSelection: PromptForProfileSelection;
  allowInteractive: boolean;
}): Promise<{ profileName: string } | { reason: string }> {
  const names = (await service.listProfileNames()).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    return {
      reason: "No profiles found. Run `gitface new <name>` to create one first.",
    };
  }

  const normalizedQuery = normalizeQuery(query);
  const candidates = filterProfileNames(names, normalizedQuery);
  if (candidates.length === 0) {
    if (!normalizedQuery) {
      return {
        reason: "No profiles found. Run `gitface new <name>` to create one first.",
      };
    }
    return {
      reason: `No profiles matched query "${normalizedQuery}". Run \`gitface list\` to inspect available profiles.`,
    };
  }

  if (candidates.length === 1) {
    return { profileName: candidates[0] };
  }

  if (!allowInteractive || !process.stdout.isTTY) {
    if (normalizedQuery) {
      return {
        reason: `Multiple profiles matched query "${normalizedQuery}". Re-run with an explicit profile name, for example: \`gitface use ${candidates[0]}\`.`,
      };
    }
    return {
      reason: "Profile name is required in non-interactive mode. Re-run with `gitface use <name>`.",
    };
  }

  const selected = await promptForSelection({
    candidates,
    query: normalizedQuery,
  });

  if (!selected) {
    return { reason: "No profile selected." };
  }

  return { profileName: selected };
}

function normalizeQuery(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function filterProfileNames(names: string[], query: string | undefined): string[] {
  if (!query) {
    return names;
  }
  const loweredQuery = query.toLowerCase();
  return names.filter((name) => name.toLowerCase().includes(loweredQuery));
}

function isValidScope(value: string): value is ConfigScope {
  const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
  return VALID_SCOPES.has(value as ConfigScope);
}
