import fs from "node:fs/promises";
import { Command } from "commander";
import { vi } from "vitest";

export function buildProgram(commands: Command[]): Command {
	const program = new Command();
	program
		.name("gitface")
		.description("A simple CLI tool to change your “face” in Git")
		.version("test");

	commands.forEach((c) => program.addCommand(c));
	return program;
}

export async function runCli(
	commands: Command[],
	args: string[],
): Promise<void> {
	const program = buildProgram(commands);
	await program.parseAsync(args);
}

export function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-9;]*m/g, "");
}

export function spyConsole(logs: string[]): () => void {
	const log = vi
		.spyOn(console, "log")
		.mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
	const warn = vi
		.spyOn(console, "warn")
		.mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});
	const error = vi
		.spyOn(console, "error")
		.mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		});

	return () => {
		log.mockRestore();
		warn.mockRestore();
		error.mockRestore();
	};
}

export async function safeRemove(target: string): Promise<void> {
	try {
		await fs.rm(target, { recursive: true, force: true, maxRetries: 3 });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}
}
