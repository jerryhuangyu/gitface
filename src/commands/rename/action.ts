import { randomUUID } from "node:crypto";
import { ProfileRenameService } from "@/core/profile-rename-service";
import { InvalidProfileError, ProfileAlreadyExistsError, ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
  sendProfileRenameDryRunJson,
  sendProfileRenameDryRunMsg,
  sendProfileRenameEnvelopeError,
  sendProfileRenameEnvelopeSuccess,
  sendProfileRenameFailedJson,
  sendProfileRenameFailedMsg,
  sendProfileRenameSuccessJson,
  sendProfileRenameSuccessMsg,
} from "./ui";

interface Options {
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
  jsonEnvelope?: boolean;
}

type OutputMode = "text" | "json" | "json-envelope";

const action: (oldName: string, newName: string, options: Options) => Promise<void> =
  withCommandHandling(
    "command:rename",
    async (oldName: string, newName: string, options: Options) => {
      const startedAtMs = Date.now();
      const traceId = randomUUID();
      const outputMode: OutputMode =
        options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
      const service = ProfileRenameService.create();
      try {
        if (options.dryRun) {
          const preview = await service.previewRename(oldName, newName);
          if (!options.force && preview.overwrite) {
            throw new ProfileAlreadyExistsError(newName);
          }
          if (outputMode === "json-envelope") {
            sendProfileRenameEnvelopeSuccess(
              "RENAME_PROFILE_DRY_RUN",
              "Profile rename dry-run completed.",
              {
                result: "dry-run",
                oldName,
                newName,
                overwrite: preview.overwrite,
                rulesUpdated: preview.rulesToUpdate,
                profile: {
                  name: preview.profile.name,
                  gitName: preview.profile.gitName,
                  email: preview.profile.email,
                  signingKey: preview.profile.signingKey ?? null,
                },
              },
              Date.now() - startedAtMs,
              traceId,
            );
            return;
          }
          if (outputMode === "json") {
            sendProfileRenameDryRunJson(
              oldName,
              newName,
              preview.profile,
              preview.overwrite,
              preview.rulesToUpdate,
            );
            return;
          }
          sendProfileRenameDryRunMsg(
            oldName,
            newName,
            preview.profile,
            preview.overwrite,
            preview.rulesToUpdate,
          );
          return;
        }

        const { profile, rulesUpdated } = await service.renameProfile(
          oldName,
          newName,
          options.force ?? false,
        );
        if (outputMode === "json-envelope") {
          sendProfileRenameEnvelopeSuccess(
            "RENAME_PROFILE_OK",
            "Profile renamed successfully.",
            {
              result: "renamed",
              oldName,
              newName: profile.name,
              rulesUpdated,
              profile: {
                name: profile.name,
                gitName: profile.gitName,
                email: profile.email,
                signingKey: profile.signingKey ?? null,
              },
            },
            Date.now() - startedAtMs,
            traceId,
          );
          return;
        }
        if (outputMode === "json") {
          sendProfileRenameSuccessJson(oldName, profile, rulesUpdated);
          return;
        }
        sendProfileRenameSuccessMsg(oldName, profile.name, rulesUpdated);
      } catch (error) {
        if (error instanceof ProfileNotFoundError) {
          const reason = await buildProfileNotFoundReason(oldName, `'${oldName}' does not exist.`);
          if (outputMode === "json-envelope") {
            sendProfileRenameEnvelopeError(
              "RENAME_PROFILE_NOT_FOUND",
              reason,
              Date.now() - startedAtMs,
              traceId,
            );
          } else if (outputMode === "json") {
            sendProfileRenameFailedJson(oldName, newName, reason);
          } else {
            sendProfileRenameFailedMsg(reason);
          }
          process.exitCode = 1;
          return;
        }

        if (error instanceof ProfileAlreadyExistsError) {
          const reason = error.message;
          if (outputMode === "json-envelope") {
            sendProfileRenameEnvelopeError(
              "RENAME_PROFILE_CONFLICT",
              reason,
              Date.now() - startedAtMs,
              traceId,
            );
          } else if (outputMode === "json") {
            sendProfileRenameFailedJson(oldName, newName, reason);
          } else {
            sendProfileRenameFailedMsg(reason);
          }
          process.exitCode = 1;
          return;
        }

        if (error instanceof InvalidProfileError) {
          const reason = error.message;
          if (outputMode === "json-envelope") {
            sendProfileRenameEnvelopeError(
              "RENAME_PROFILE_INVALID",
              reason,
              Date.now() - startedAtMs,
              traceId,
            );
          } else if (outputMode === "json") {
            sendProfileRenameFailedJson(oldName, newName, reason);
          } else {
            sendProfileRenameFailedMsg(reason);
          }
          process.exitCode = 1;
          return;
        }

        throw error;
      }
    },
  );

export default action;
