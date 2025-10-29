import { render } from "ink";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import EditProfile, { sendProfileUpdateSuccessMsg } from "./ui";

interface EditProfileOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	unsetSigningKey?: boolean;
}

const action: (name: string, options: EditProfileOptions) => Promise<void> =
	withCommandHandling(async (name, options) => {
		if (hasUpdates(options)) {
			const service = ProfileService.create();
			const profile = await service.updateProfile(name, {
				gitName: options.gitName,
				email: options.email,
				signingKey: options.unsetSigningKey ? null : options.signingKey,
			});
			sendProfileUpdateSuccessMsg(profile.name);
			return;
		}

		const instance = render(<EditProfile name={name} onSubmit={() => {}} />);
		await instance.waitUntilExit();
	});

export default action;

function hasUpdates(options: EditProfileOptions): boolean {
	return Boolean(
		options.gitName ||
			options.email ||
			options.signingKey ||
			options.unsetSigningKey,
	);
}
