import { randomUUID } from "node:crypto";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
  sendCurrentIdentityEnvelopeError,
  sendCurrentIdentityEnvelopeSuccess,
  sendCurrentIdentityFailedJson,
  sendCurrentIdentityFailedMsg,
  sendCurrentIdentityJson,
  sendCurrentIdentityMsg,
} from "./ui";

interface CurrentOptions {
  json?: boolean;
  jsonEnvelope?: boolean;
  scope?: string;
}

const action: (options: CurrentOptions) => Promise<void> = withCommandHandling(
  "command:current",
  async (options) => {
    const startedAtMs = Date.now();
    const traceId = randomUUID();
    const outputMode =
      options.jsonEnvelope === true ? "json-envelope" : options.json === true ? "json" : "text";
    const normalizedScope = options.scope?.toLowerCase();
    if (normalizedScope && !isValidScope(normalizedScope)) {
      const reason = "Scope must be one of: local, global, system.";
      if (outputMode === "json-envelope") {
        sendCurrentIdentityEnvelopeError(
          "CURRENT_SCOPE_INVALID",
          reason,
          Date.now() - startedAtMs,
          traceId,
        );
      } else if (outputMode === "json") {
        sendCurrentIdentityFailedJson(reason);
      } else {
        sendCurrentIdentityFailedMsg(reason);
      }
      process.exitCode = 1;
      return;
    }
    const scope = normalizedScope as ConfigScope | undefined;

    const service = ProfileService.create();
    const identity = scope
      ? await service.getScopedIdentity(scope)
      : await service.getCurrentIdentity();

    if (outputMode === "json-envelope") {
      sendCurrentIdentityEnvelopeSuccess(identity, scope, Date.now() - startedAtMs, traceId);
      return;
    }
    if (outputMode === "json") {
      sendCurrentIdentityJson(identity, scope);
      return;
    }

    sendCurrentIdentityMsg(identity, scope);
  },
);

export default action;

function isValidScope(value: string): value is ConfigScope {
  const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
  return VALID_SCOPES.has(value as ConfigScope);
}
