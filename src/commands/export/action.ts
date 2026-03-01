import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import process from "node:process";
import {
	buildProfileExportPayload,
	serializeProfileExportPayload,
} from "@/core/profile-export-service";
import { ProfileService } from "@/core/profile-service";
import { withCommandHandling } from "../command-runner";
import {
	sendExportEnvelopeError,
	sendExportEnvelopeSuccess,
	sendExportFailedJson,
	sendExportStdout,
	sendExportSuccessJson,
	sendExportSuccessMsg,
} from "./ui";

interface Options {
	json?: boolean;
	jsonEnvelope?: boolean;
}

const action: (file: string | undefined, options: Options) => Promise<void> =
	withCommandHandling(
		"command:export",
		async (file: string | undefined, options: Options) => {
			const startedAtMs = Date.now();
			const traceId = randomUUID();
			const outputMode =
				options.jsonEnvelope === true
					? "json-envelope"
					: options.json === true
						? "json"
						: "text";
			const service = ProfileService.create();
			try {
				const profiles = await service.listProfiles();
				const payload = buildProfileExportPayload(profiles);
				const exportJson = serializeProfileExportPayload(payload);

				if (file) {
					await fs.writeFile(file, exportJson, "utf-8");
					if (outputMode === "json-envelope") {
						sendExportEnvelopeSuccess(
							"EXPORT_PROFILES_WRITTEN",
							"Profiles exported to file successfully.",
							{ count: payload.count, file },
							Date.now() - startedAtMs,
							traceId,
						);
						return;
					}
					if (outputMode === "json") {
						sendExportSuccessJson({ count: payload.count, file });
						return;
					}
					sendExportSuccessMsg(payload.count, file);
					return;
				}

				if (outputMode === "json-envelope") {
					sendExportEnvelopeSuccess(
						"EXPORT_PROFILES_STDOUT",
						"Profiles exported to stdout successfully.",
						{
							count: payload.count,
							profiles: payload.profiles,
						},
						Date.now() - startedAtMs,
						traceId,
					);
					return;
				}
				if (outputMode === "json") {
					sendExportSuccessJson({
						count: payload.count,
						profiles: payload.profiles,
					});
					return;
				}
				sendExportStdout(exportJson);
			} catch (error) {
				if (outputMode === "json-envelope") {
					const reason =
						error instanceof Error
							? error.message
							: `Unexpected error ${JSON.stringify(error)}`;
					sendExportEnvelopeError(
						file ? "EXPORT_WRITE_FAILED" : "EXPORT_PROFILES_FAILED",
						reason,
						file,
						Date.now() - startedAtMs,
						traceId,
					);
					process.exitCode = 1;
					return;
				}
				if (outputMode === "json") {
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
