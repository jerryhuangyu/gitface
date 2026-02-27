import fs from "node:fs/promises";
import { ProfileService } from "@/core/profile-service";
import { Profile } from "@/domain/profile";
import { ProfileAlreadyExistsError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendImportDryRunSummary,
	sendImportExistsWarning,
	sendImportFailedMsg,
	sendImportSummary,
} from "./ui";

interface Options {
	overwrite?: boolean;
	dryRun?: boolean;
}

interface ImportCandidate {
	name: string;
	gitName: string;
	email: string;
	signingKey: string | null;
}

const action: (file: string, options: Options) => Promise<void> =
	withCommandHandling(
		"command:import",
		async (file: string, options: Options) => {
			const content = await fs.readFile(file, "utf-8");
			const raw = JSON.parse(content);

			if (!Array.isArray(raw)) {
				throw new Error("Invalid format: expected an array of profiles.");
			}

			const service = ProfileService.create();
			let successCount = 0;
			let failCount = 0;
			const isDryRun = options.dryRun ?? false;
			const overwrite = options.overwrite ?? false;

			for (const profileData of raw) {
				let sourceName = "<unknown>";
				try {
					const candidate = parseImportCandidate(profileData);
					sourceName = candidate.name;

					if (isDryRun) {
						await validateDryRunCandidate(service, candidate, overwrite);
					} else {
						await service.createProfile({
							...candidate,
							force: overwrite,
						});
					}
					successCount++;
				} catch (error) {
					if (error instanceof ProfileAlreadyExistsError) {
						sendImportExistsWarning(sourceName, isDryRun);
					} else {
						sendImportFailedMsg(sourceName, (error as Error).message, isDryRun);
					}
					failCount++;
				}
			}

			if (isDryRun) {
				sendImportDryRunSummary(successCount, failCount);
				return;
			}

			sendImportSummary(successCount, failCount);
		},
	);

function parseImportCandidate(profileData: unknown): ImportCandidate {
	if (
		profileData &&
		typeof profileData === "object" &&
		"state" in (profileData as Record<string, unknown>)
	) {
		throw new Error(
			"Invalid format: expected plain profile snapshots without 'state' wrapper.",
		);
	}

	const source = profileData as Record<string, unknown>;
	const sourceName = String(source.name ?? "").trim();

	if (!sourceName) {
		throw new Error("Invalid format: profile name is required.");
	}

	return {
		name: sourceName,
		gitName: String(source.gitName ?? ""),
		email: String(source.email ?? ""),
		signingKey:
			source.signingKey === undefined || source.signingKey === null
				? null
				: String(source.signingKey),
	};
}

async function validateDryRunCandidate(
	service: ProfileService,
	candidate: ImportCandidate,
	overwrite: boolean,
): Promise<void> {
	if (!overwrite && (await service.findProfile(candidate.name))) {
		throw new ProfileAlreadyExistsError(candidate.name);
	}

	Profile.create(candidate);
}

export default action;
