import fs from "node:fs/promises";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import { sendExportStdout, sendExportSuccessMsg } from "./ui";

interface Options {
	file?: string;
}

const action: (file: string | undefined, options: Options) => Promise<void> =
	withCommandHandling(
		"command:export",
		async (file: string | undefined, _options: Options) => {
			const service = ProfileService.create();
			const profiles = await service.listProfiles();
			const snapshots = profiles.map((p) => p.snapshot());
			const json = JSON.stringify(snapshots, null, 2);

			if (file) {
				await fs.writeFile(file, json, "utf-8");
				sendExportSuccessMsg(profiles.length, file);
			} else {
				sendExportStdout(json);
			}
		},
	);

export default action;
