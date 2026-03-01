import fs from "node:fs/promises";
import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { Profile } from "@/domain/profile";
import { ProfileAlreadyExistsError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendImportDryRunSummary,
	sendImportExistsWarning,
	sendImportFailedMsg,
	sendImportJsonSummary,
	sendImportSummary,
} from "./ui";

interface Options {
	overwrite?: boolean;
	dryRun?: boolean;
	strict?: boolean;
	json?: boolean;
}

interface ImportCandidate {
	name: string;
	gitName: string;
	email: string;
	signingKey: string | null;
}

type ImportResultStatus = "imported" | "failed";

interface ImportResultItem {
	name: string;
	status: ImportResultStatus;
	message: string;
}

interface ImportSummary {
	dryRun: boolean;
	total: number;
	imported: number;
	failed: number;
	results: ImportResultItem[];
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
			const results: ImportResultItem[] = [];
			const isDryRun = options.dryRun ?? false;
			const overwrite = options.overwrite ?? false;
			const strict = options.strict ?? false;

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

					results.push({
						name: sourceName,
						status: "imported",
						message: isDryRun ? "Validated for import." : "Imported.",
					});
				} catch (error) {
					if (error instanceof ProfileAlreadyExistsError) {
						if (!options.json) {
							sendImportExistsWarning(sourceName, isDryRun);
						}
						results.push({
							name: sourceName,
							status: "failed",
							message: "Profile already exists. Use --overwrite to replace.",
						});
					} else {
						const reason =
							error instanceof Error ? error.message : "Unknown error";
						if (!options.json) {
							sendImportFailedMsg(sourceName, reason, isDryRun);
						}
						results.push({
							name: sourceName,
							status: "failed",
							message: reason,
						});
					}
				}
			}

			const summary: ImportSummary = {
				dryRun: isDryRun,
				total: results.length,
				imported: results.filter((item) => item.status === "imported").length,
				failed: results.filter((item) => item.status === "failed").length,
				results,
			};

			if (strict && summary.failed > 0) {
				process.exitCode = 1;
			}

			if (options.json) {
				sendImportJsonSummary(summary);
				return;
			}

			if (isDryRun) {
				sendImportDryRunSummary(summary.imported, summary.failed);
				return;
			}

			sendImportSummary(summary.imported, summary.failed);
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
