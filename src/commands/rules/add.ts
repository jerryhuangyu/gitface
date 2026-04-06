import { randomUUID } from "node:crypto";
import { ProfileService } from "@/core/profile-service";
import { RuleService } from "@/core/rule-service";
import { Rule } from "@/domain/rule";
import { ProfileNotFoundError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import { buildProfileNotFoundReason } from "../profile-not-found-reason";
import {
  sendRuleAddDryRunJson,
  sendRuleAddDryRunMsg,
  sendRuleAddDryRunResultEnvelope,
  sendRuleAddFailedJson,
  sendRuleAddFailedMsg,
  sendRuleAddFailedResultEnvelope,
  sendRuleAddSuccessJson,
  sendRuleAddSuccessMsg,
  sendRuleAddSuccessResultEnvelope,
} from "./ui";

interface AddRuleOptions {
  dryRun?: boolean;
  json?: boolean;
  jsonEnvelope?: boolean;
}

type AddOutputMode = "text" | "json" | "json-envelope";

const isMissingGlobalConfigError = (error: unknown): boolean => {
  return (
    error instanceof Error && error.message.toLowerCase().includes("unable to read config file")
  );
};

export const addRuleAction: (
  directory: string,
  profileName: string,
  options: AddRuleOptions,
) => Promise<void> = withCommandHandling(
  "command:rules:add",
  async (directory, profileName, options) => {
    const startedAtMs = Date.now();
    const traceId = randomUUID();
    const outputMode: AddOutputMode =
      options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
    const ruleService = RuleService.create();
    const profileService = ProfileService.create();
    const normalizedDirectory = Rule.create(directory, profileName).directory;
    try {
      if (options.dryRun) {
        await profileService.getProfile(profileName);
        const existingRules = await ruleService.listRules().catch((error) => {
          if (isMissingGlobalConfigError(error)) {
            return [];
          }
          throw error;
        });
        const overwrite = existingRules.some((rule) => rule.directory === normalizedDirectory);
        if (outputMode === "json-envelope") {
          sendRuleAddDryRunResultEnvelope(
            normalizedDirectory,
            profileName,
            overwrite,
            Date.now() - startedAtMs,
            traceId,
          );
          return;
        }
        if (outputMode === "json") {
          sendRuleAddDryRunJson(normalizedDirectory, profileName, overwrite);
          return;
        }
        sendRuleAddDryRunMsg(normalizedDirectory, profileName, overwrite);
        return;
      }

      await ruleService.addRule(directory, profileName);
      if (outputMode === "json-envelope") {
        sendRuleAddSuccessResultEnvelope(
          normalizedDirectory,
          profileName,
          Date.now() - startedAtMs,
          traceId,
        );
        return;
      }
      if (outputMode === "json") {
        sendRuleAddSuccessJson(normalizedDirectory, profileName);
        return;
      }
      sendRuleAddSuccessMsg(directory, profileName);
    } catch (error) {
      const reason =
        error instanceof ProfileNotFoundError
          ? await buildProfileNotFoundReason(profileName, `Profile '${profileName}' not found.`)
          : error instanceof Error
            ? error.message
            : `Unexpected error ${JSON.stringify(error)}`;
      if (outputMode === "json-envelope") {
        sendRuleAddFailedResultEnvelope(
          normalizedDirectory,
          profileName,
          reason,
          Date.now() - startedAtMs,
          traceId,
        );
      } else if (outputMode === "json") {
        sendRuleAddFailedJson(normalizedDirectory, profileName, reason);
      } else {
        sendRuleAddFailedMsg(`Failed to add rule: ${reason}`);
      }
      process.exitCode = 1;
    }
  },
);
