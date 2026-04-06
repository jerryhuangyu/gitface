import { randomUUID } from "node:crypto";
import { ProfileRemoveService } from "@/core/profile-remove-service";
import { InvalidProfileError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
  sendProfileRemoveDryRunJson,
  sendProfileRemoveDryRunMsg,
  sendProfileRemoveEnvelopeError,
  sendProfileRemoveEnvelopeSuccess,
  sendProfileRemoveFailedJson,
  sendProfileRemoveFailedMsg,
  sendProfileRemoveSkippedJson,
  sendProfileRemoveSuccessJson,
  sendProfileRemoveSuccessMsg,
  sendProfileRemoveWithForceMsg,
} from "./ui";

interface RemoveProfileOptions {
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
  jsonEnvelope?: boolean;
}

type OutputMode = "text" | "json" | "json-envelope";

const action: (name: string, options: RemoveProfileOptions) => Promise<void> = withCommandHandling(
  "command:remove",
  async (name, options) => {
    const startedAtMs = Date.now();
    const traceId = randomUUID();
    const outputMode: OutputMode =
      options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
    const service = ProfileRemoveService.create();

    try {
      const result = await service.executeRemove(name, {
        dryRun: options.dryRun,
        force: options.force,
      });

      if (result.result === "dry-run" && result.profile !== null) {
        if (outputMode === "json-envelope") {
          sendProfileRemoveEnvelopeSuccess(
            "REMOVE_PROFILE_DRY_RUN",
            "Profile remove dry-run completed.",
            {
              result: "dry-run",
              name: result.profile.name,
              force: result.force,
              profile: {
                name: result.profile.name,
                gitName: result.profile.gitName,
                email: result.profile.email,
                signingKey: result.profile.signingKey ?? null,
              },
              reason: null,
            },
            Date.now() - startedAtMs,
            traceId,
          );
          return;
        }
        if (outputMode === "json") {
          sendProfileRemoveDryRunJson(result.profile);
          return;
        }
        sendProfileRemoveDryRunMsg(result.profile);
        return;
      }

      if (result.result === "skipped") {
        if (outputMode === "json-envelope") {
          sendProfileRemoveEnvelopeSuccess(
            "REMOVE_PROFILE_SKIPPED",
            "Profile removal skipped due to --force missing profile.",
            {
              result: "skipped",
              name: result.name,
              force: result.force,
              profile: null,
              reason: result.reason,
            },
            Date.now() - startedAtMs,
            traceId,
          );
          return;
        }
        if (outputMode === "json") {
          sendProfileRemoveSkippedJson(result.name);
          return;
        }
        sendProfileRemoveWithForceMsg(result.name);
        return;
      }

      if (result.profile === null) {
        throw new Error("Unexpected remove result: profile payload is missing.");
      }

      if (outputMode === "json-envelope") {
        sendProfileRemoveEnvelopeSuccess(
          "REMOVE_PROFILE_OK",
          "Profile removed successfully.",
          {
            result: "removed",
            name: result.profile.name,
            force: result.force,
            profile: {
              name: result.profile.name,
              gitName: result.profile.gitName,
              email: result.profile.email,
              signingKey: result.profile.signingKey ?? null,
            },
            reason: null,
          },
          Date.now() - startedAtMs,
          traceId,
        );
        return;
      }
      if (outputMode === "json") {
        sendProfileRemoveSuccessJson(result.profile);
        return;
      }
      sendProfileRemoveSuccessMsg(result.profile);
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        const reason = await buildProfileNotFoundReason(name, `'${name}' does not exist.`);
        if (outputMode === "json-envelope") {
          sendProfileRemoveEnvelopeError(
            "REMOVE_PROFILE_NOT_FOUND",
            reason,
            Date.now() - startedAtMs,
            traceId,
          );
        } else if (outputMode === "json") {
          sendProfileRemoveFailedJson(name, reason);
        } else {
          sendProfileRemoveFailedMsg(reason);
        }
        process.exitCode = 1;
        return;
      }
      if (error instanceof InvalidProfileError) {
        const reason = error.message;
        if (outputMode === "json-envelope") {
          sendProfileRemoveEnvelopeError(
            "REMOVE_PROFILE_INVALID",
            reason,
            Date.now() - startedAtMs,
            traceId,
          );
        } else if (outputMode === "json") {
          sendProfileRemoveFailedJson(name, reason);
        } else {
          sendProfileRemoveFailedMsg(reason);
        }
        process.exitCode = 1;
        return;
      }
      const reason =
        error instanceof Error ? error.message : `Unexpected error ${JSON.stringify(error)}`;
      if (outputMode === "json-envelope") {
        sendProfileRemoveEnvelopeError(
          "REMOVE_PROFILE_FAILED",
          reason,
          Date.now() - startedAtMs,
          traceId,
        );
      } else if (outputMode === "json") {
        sendProfileRemoveFailedJson(name, reason);
      } else {
        sendProfileRemoveFailedMsg(reason);
      }
      process.exitCode = 1;
    }
  },
);

export default action;
