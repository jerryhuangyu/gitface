import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { writeFileAtomic } from "@/infra/atomic-write";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = await mkdtemp(path.join(tmpdir(), "gitface-atomic-write-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map(async (dir) => {
			await rm(dir, { recursive: true, force: true });
		}),
	);
});

describe("writeFileAtomic", () => {
	test("writes payload to the target file", async () => {
		const dir = await createTempDir();
		const filePath = path.join(dir, "profile.json");

		await writeFileAtomic(filePath, '{"name":"work"}\n');

		await expect(readFile(filePath, "utf8")).resolves.toBe('{"name":"work"}\n');
		const entries = await readdir(dir);
		expect(entries).toEqual(["profile.json"]);
	});

	test("replaces existing file contents", async () => {
		const dir = await createTempDir();
		const filePath = path.join(dir, "identity.gitconfig");

		await writeFileAtomic(filePath, "[user]\n\tname = old\n");
		await writeFileAtomic(filePath, "[user]\n\tname = new\n");

		await expect(readFile(filePath, "utf8")).resolves.toContain("name = new");
		const entries = await readdir(dir);
		expect(entries).toEqual(["identity.gitconfig"]);
	});

	test("cleans up temp file when rename fails", async () => {
		const dir = await createTempDir();
		const filePath = path.join(dir, "profile.json");
		const renameError = new Error("rename failed");

		await expect(
			writeFileAtomic(filePath, "payload", {
				writeFile: (target, content, encoding) =>
					writeFile(target, content, encoding),
				rename: vi.fn(async () => {
					throw renameError;
				}),
				unlink: (target) => unlink(target),
			}),
		).rejects.toBe(renameError);

		await expect(readdir(dir)).resolves.toEqual([]);
	});
});
