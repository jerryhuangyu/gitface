import fs from "node:fs/promises";
import process from "node:process";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	sendExportFailedJson,
	sendExportStdout,
	sendExportSuccessJson,
	sendExportSuccessMsg,
} from "./ui";

interface Options {
	json?: boolean;
}

const action: (file: string | undefined, options: Options) => Promise<void> =
	withCommandHandling(
		"command:export",
		async (file: string | undefined, options: Options) => {
			const service = ProfileService.create();
			try {
				const profiles = await service.listProfiles();
				const snapshots = profiles.map((p) => p.snapshot());
				const exportJson = JSON.stringify(snapshots, null, 2);

				if (file) {
					await fs.writeFile(file, exportJson, "utf-8");
					if (options.json) {
						sendExportSuccessJson({ count: profiles.length, file });
						return;
					}
					sendExportSuccessMsg(profiles.length, file);
					return;
				}

				if (options.json) {
					sendExportSuccessJson({
						count: profiles.length,
						profiles: snapshots,
					});
					return;
				}
				sendExportStdout(exportJson);
			} catch (error) {
				if (options.json) {
					const reason =
						error instanceof Error
							? error.message
							: `Unexpected error ${JSON.stringify(error)}`;
					sendExportFailedJson(reason, file);
					process.exitCode = 1;
					return;
				}
				throw error;
			}
		},
	);

export default action;
