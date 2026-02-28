import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	sendCurrentIdentityFailedJson,
	sendCurrentIdentityFailedMsg,
	sendCurrentIdentityJson,
	sendCurrentIdentityMsg,
} from "./ui";

interface CurrentOptions {
	json?: boolean;
	scope?: string;
}

const action: (options: CurrentOptions) => Promise<void> = withCommandHandling(
	"command:current",
	async (options) => {
		const normalizedScope = options.scope?.toLowerCase();
		if (normalizedScope && !isValidScope(normalizedScope)) {
			const reason = "Scope must be one of: local, global, system.";
			if (options.json) {
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

		if (options.json) {
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
