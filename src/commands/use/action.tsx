import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import { sendProfileUseFailedMsg, sendProfileUseSuccessMsg } from "./ui";

interface UseProfileOptions {
	scope?: string;
}

const action: (name: string, options: UseProfileOptions) => Promise<void> =
	withCommandHandling(async (name: string, options: UseProfileOptions) => {
		const scope = (options.scope ?? "local").toLowerCase();
		if (!isValidScope(scope)) {
			sendProfileUseFailedMsg("Scope must be one of: local, global, system.");
			process.exitCode = 1;
			return;
		}

		const service = ProfileService.create();
		const profile = await service.applyProfile(name, scope);

		sendProfileUseSuccessMsg(profile, scope);
	});

export default action;

function isValidScope(value: string): value is ConfigScope {
	const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
	return VALID_SCOPES.has(value as ConfigScope);
}
