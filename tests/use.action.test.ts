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

	test("json mode resolves single query match without interactive prompt", async () => {
		const profile = {
			name: "work-main",
			gitName: "Work User",
			email: "work@example.com",
			signingKey: null,
		};
		const service = {
			listProfileNames: vi
				.fn()
				.mockResolvedValue(["work-main", "personal-main"]),
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
		const promptSpy = vi.fn().mockResolvedValue("personal-main");

		await runUseAction(undefined, { json: true, query: "work" }, promptSpy);

		expect(service.listProfileNames).toHaveBeenCalledTimes(1);
		expect(promptSpy).not.toHaveBeenCalled();
		expect(service.getProfile).toHaveBeenCalledWith("work-main");
		expect(service.applyProfile).toHaveBeenCalledWith("work-main", "local");
		expect(process.exitCode).toBeUndefined();

		logSpy.mockRestore();
	});

	test("json mode returns machine-readable error when query is ambiguous", async () => {
		const service = {
			listProfileNames: vi.fn().mockResolvedValue(["work-main", "work-admin"]),
			getProfile: vi.fn(),
			getScopedIdentity: vi.fn(),
			applyProfile: vi.fn(),
		};
		vi.spyOn(ProfileService, "create").mockReturnValue(
			service as unknown as ProfileService,
		);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const promptSpy = vi.fn().mockResolvedValue("work-main");

		await runUseAction(undefined, { json: true, query: "work" }, promptSpy);

		expect(promptSpy).not.toHaveBeenCalled();
		expect(service.getProfile).not.toHaveBeenCalled();
		expect(service.applyProfile).not.toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledOnce();
		const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as {
			status: string;
			reason: string;
		};
		expect(payload.status).toBe("error");
		expect(payload.reason).toContain("Multiple profiles matched query");
		expect(process.exitCode).toBe(1);

		logSpy.mockRestore();
	});
});
