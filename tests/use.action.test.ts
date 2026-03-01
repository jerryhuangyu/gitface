import { afterEach, describe, expect, test, vi } from "vitest";
import { runUseAction } from "../src/commands/use/action";
import { ProfileService } from "../src/core/profile-service";

describe("runUseAction scoped identity reads", () => {
	const originalExitCode = process.exitCode;

	afterEach(() => {
		process.exitCode = originalExitCode;
		vi.restoreAllMocks();
	});

	test("uses profile service scoped identity for dry-run planning", async () => {
		const profile = {
			name: "work",
			gitName: "Work User",
			email: "work@example.com",
			signingKey: null,
		};
		const service = {
			getProfile: vi.fn().mockResolvedValue(profile),
			getScopedIdentity: vi.fn().mockResolvedValue({
				gitName: "Current User",
				email: "current@example.com",
				signingKey: null,
			}),
			applyProfile: vi.fn(),
		};
		vi.spyOn(ProfileService, "create").mockReturnValue(
			service as unknown as ProfileService,
		);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await runUseAction("work", {
			scope: "global",
			dryRun: true,
			json: true,
		});

		expect(service.getProfile).toHaveBeenCalledWith("work");
		expect(service.getScopedIdentity).toHaveBeenCalledTimes(1);
		expect(service.getScopedIdentity).toHaveBeenCalledWith("global");
		expect(service.applyProfile).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();

		logSpy.mockRestore();
	});
});
