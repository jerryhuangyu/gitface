import { render } from "ink";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import CreateProfile, { sendProfileCreateSuccessMsg } from "./ui";

interface NewActionOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	force?: boolean;
}

const action: (name: string, options: NewActionOptions) => Promise<void> =
	withCommandHandling(async (name, options) => {
		const service = ProfileService.create();
		if (hasNewProfileOptions(options)) {
			const profile = await service.createProfile({
				name,
				gitName: options.gitName,
				email: options.email,
				signingKey: options.signingKey ?? null,
				force: Boolean(options.force),
			});

			sendProfileCreateSuccessMsg(profile);
			return;
		}

		const targetProfile = await service.findProfile(name);
		const instance = render(
			<CreateProfile
				name={name}
				defaultGitName={targetProfile?.gitName}
				defaultEmail={targetProfile?.email}
				defaultSigningKey={targetProfile?.signingKey}
			/>,
		);
		await instance.waitUntilExit();
	});

export default action;

function hasNewProfileOptions(options: NewActionOptions): boolean {
	return Boolean(options.gitName || options.email || options.signingKey);
}
