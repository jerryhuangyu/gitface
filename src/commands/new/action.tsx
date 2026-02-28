import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	sendProfileCreateFailedJson,
	sendProfileCreateSuccessJson,
	sendProfileCreateSuccessMsg,
} from "./output";

interface NewActionOptions {
	gitName?: string;
	email?: string;
	signingKey?: string;
	force?: boolean;
	json?: boolean;
}

const action: (name: string, options: NewActionOptions) => Promise<void> =
	withCommandHandling("command:new", async (name, options) => {
		if (options.json && !hasNewProfileOptions(options)) {
			sendProfileCreateFailedJson(
				name,
				"Non-interactive flags are required when using --json output mode.",
			);
			process.exitCode = 1;
			return;
		}

		const service = ProfileService.create();
		if (hasNewProfileOptions(options)) {
			try {
				const profile = await service.createProfile({
					name,
					gitName: options.gitName,
					email: options.email,
					signingKey: options.signingKey ?? null,
					force: Boolean(options.force),
				});

				if (options.json) {
					sendProfileCreateSuccessJson(profile);
					return;
				}

				sendProfileCreateSuccessMsg(profile);
			} catch (error) {
				if (options.json && error instanceof Error) {
					sendProfileCreateFailedJson(name, error.message);
					process.exitCode = 1;
					return;
				}

				throw error;
			}
			return;
		}

		const targetProfile = await service.findProfile(name);
		const [{ render }, { default: CreateProfile }] = await Promise.all([
			import("ink"),
			import("./ui"),
		]);
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
