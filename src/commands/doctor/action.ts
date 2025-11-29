import path from "node:path";
import simpleGit from "simple-git";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import type { DoctorCheckResult } from "./ui";
import {
	sendDoctorCheckResult,
	sendDoctorHeading,
	sendDoctorSummary,
} from "./ui";

type DoctorCheck = () => Promise<DoctorCheckResult>;

const doctorChecks: DoctorCheck[] = [
	checkGitInstallation,
	checkProfileStore,
	checkGlobalConfig,
];

const action: () => Promise<void> = withCommandHandling(
	"command:doctor",
	async () => {
		sendDoctorHeading();

		const results = await Promise.all(doctorChecks.map((check) => check()));

		// biome-ignore lint/suspicious/useIterableCallbackReturn: <todo>
		results.forEach((result) => sendDoctorCheckResult(result));

		const hasFailures = results.some((result) => result.status === "fail");

		sendDoctorSummary(hasFailures);

		if (hasFailures) {
			process.exitCode = 1;
		}
	},
);

async function checkGitInstallation(): Promise<DoctorCheckResult> {
	try {
		const git = simpleGit();
		const version = await git.version();

		return {
			status: "pass",
			message: `Git is installed: ${version.major}.${version.minor}.${version.patch}`,
		};
	} catch (error) {
		return {
			status: "fail",
			message: `Git is not installed or accessible: ${(error as Error).message}`,
		};
	}
}

async function checkProfileStore(): Promise<DoctorCheckResult> {
	try {
		const service = ProfileService.create();
		await service.listProfiles();

		const configDir = process.env.XDG_CONFIG_HOME
			? path.join(process.env.XDG_CONFIG_HOME, "gitface", "profiles")
			: path.join(process.env.HOME ?? "", ".config", "gitface", "profiles");

		return {
			status: "pass",
			message: `Profile store is accessible at: ${configDir}`,
		};
	} catch (error) {
		return {
			status: "fail",
			message: `Profile store is not accessible: ${(error as Error).message}`,
		};
	}
}

async function checkGlobalConfig(): Promise<DoctorCheckResult> {
	try {
		const git = simpleGit();
		const name = await git.getConfig("user.name");
		const email = await git.getConfig("user.email");

		if (name.value && email.value) {
			return {
				status: "pass",
				message: `Global Git identity is set: ${name.value} <${email.value}>`,
			};
		}

		return {
			status: "warn",
			message:
				"Global Git identity is missing. GitFace will require explicit values for new profiles.",
		};
	} catch (error) {
		return {
			status: "fail",
			message: `Failed to check global Git config: ${(error as Error).message}`,
		};
	}
}

export default action;
