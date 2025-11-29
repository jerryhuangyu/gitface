import { render } from "ink";
import type { ConfigScope } from "@/core/git-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import { sendProfileUseFailedMsg, sendProfileUseSuccessMsg, SelectProfile } from "./ui";

interface UseProfileOptions {
	scope?: string;
}

const action: (
	name: string | undefined,
	options: UseProfileOptions,
) => Promise<void> = withCommandHandling(
	"command:use",
	async (name: string | undefined, options: UseProfileOptions) => {
		const scope = (options.scope ?? "local").toLowerCase();
		if (!isValidScope(scope)) {
			sendProfileUseFailedMsg("Scope must be one of: local, global, system.");
			process.exitCode = 1;
			return;
		}

		let profileName = name;

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

		sendProfileUseSuccessMsg(profile, scope);
	},
);

export default action;

function isValidScope(value: string): value is ConfigScope {
	const VALID_SCOPES = new Set<ConfigScope>(["local", "global", "system"]);
	return VALID_SCOPES.has(value as ConfigScope);
}
