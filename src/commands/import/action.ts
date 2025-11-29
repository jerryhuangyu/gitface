import fs from "node:fs/promises";
import { ProfileService } from "@/core/profile-service";
import { ProfileAlreadyExistsError } from "@/errors";
import { withCommandHandling } from "../command-runner";
import {
	sendImportExistsWarning,
	sendImportFailedMsg,
	sendImportSummary,
} from "./ui";

interface Options {
	overwrite?: boolean;
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

			for (const profileData of raw) {
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
				const sourceName = String(source.name ?? "");
				try {
					await service.createProfile({
						name: sourceName,
						gitName: String(source.gitName ?? ""),
						email: String(source.email ?? ""),
						signingKey:
							source.signingKey === undefined || source.signingKey === null
								? null
								: String(source.signingKey),
						force: options.overwrite,
					});
					successCount++;
				} catch (error) {
					if (error instanceof ProfileAlreadyExistsError) {
						sendImportExistsWarning(sourceName);
					} else {
						sendImportFailedMsg(sourceName, (error as Error).message);
					}
					failCount++;
				}
			}

			sendImportSummary(successCount, failCount);
		},
	);

export default action;
