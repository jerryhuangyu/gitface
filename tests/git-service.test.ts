import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const raw = vi.fn();
	const listConfig = vi.fn();
	const addConfig = vi.fn();
	const simpleGit = vi.fn(() => ({
		raw,
		listConfig,
		addConfig,
	}));
	return { raw, listConfig, addConfig, simpleGit };
});

vi.mock("simple-git", () => ({
	simpleGit: mocks.simpleGit,
}));

import { GitService } from "../src/core/git-service";

describe("GitService.getScopedIdentity", () => {
	beforeEach(() => {
		mocks.raw.mockReset();
		mocks.listConfig.mockReset();
		mocks.addConfig.mockReset();
		mocks.simpleGit.mockClear();
	});

	test("uses a single scoped --list read when available", async () => {
		mocks.raw.mockResolvedValueOnce(
			"user.name=Alice\nuser.email=alice@example.com\nuser.signingkey=ABC123\n",
		);

		const service = new GitService();
		const identity = await service.getScopedIdentity("global");

		expect(identity).toEqual({
			gitName: "Alice",
			email: "alice@example.com",
			signingKey: "ABC123",
		});
		expect(mocks.raw).toHaveBeenCalledTimes(1);
		expect(mocks.raw).toHaveBeenCalledWith(["config", "--global", "--list"]);
	});

	test("falls back to per-key lookups if scoped --list fails", async () => {
		mocks.raw
			.mockRejectedValueOnce(new Error("list failed"))
			.mockResolvedValueOnce("Alice")
			.mockResolvedValueOnce("alice@example.com")
			.mockResolvedValueOnce("ABC123");

		const service = new GitService();
		const identity = await service.getScopedIdentity("global");

		expect(identity).toEqual({
			gitName: "Alice",
			email: "alice@example.com",
			signingKey: "ABC123",
		});
		expect(mocks.raw).toHaveBeenCalledTimes(4);
		expect(mocks.raw.mock.calls).toEqual([
			[["config", "--global", "--list"]],
			[["config", "--global", "--get", "user.name"]],
			[["config", "--global", "--get", "user.email"]],
			[["config", "--global", "--get", "user.signingkey"]],
		]);
	});
});
