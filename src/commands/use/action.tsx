import { render } from "ink";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	SelectProfile,
	sendProfileUseFailedJson,
	sendProfileUseFailedMsg,
	sendProfileUseSuccessJson,
	sendProfileUseSuccessMsg,
} from "./ui";

interface UseProfileOptions {
	scope?: string;
	json?: boolean;
}

const action: (
	name: string | undefined,
	options: UseProfileOptions,
) => Promise<void> = withCommandHandling(
	"command:use",
	async (name: string | undefined, options: UseProfileOptions) => {
		const scope = (options.scope ?? "local").toLowerCase();
		if (!isValidScope(scope)) {
			const reason = "Scope must be one of: local, global, system.";
			if (options.json) {
				sendProfileUseFailedJson(reason);
			} else {
				sendProfileUseFailedMsg(reason);
			}
			process.exitCode = 1;
			return;
		}

		let profileName = name;
		if (options.json && !profileName) {
			sendProfileUseFailedJson(
				"Profile name is required when using --json output mode.",
			);
			process.exitCode = 1;
			return;
		}

		if (!profileName) {
			await new Promise<void>((resolve) => {
				render(
					<SelectProfile
						onSelect={(selected) => {
							profileName = selected;
							resolve();
						}}
					/>,
				);
			});
			return;
		}

		const service = ProfileService.create();
		const profile = await service.applyProfile(profileName, scope);

		if (options.json) {
			sendProfileUseSuccessJson(profile, scope);
			return;
		}

		sendProfileUseSuccessMsg(profile, scope);
	},
);

export default action;

function isValidScope(value: string): value is ConfigScope {
	const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
	return VALID_SCOPES.has(value as ConfigScope);
}
