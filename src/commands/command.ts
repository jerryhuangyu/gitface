import type { Command } from "commander";

interface CliCommand {
	command: Command;
	// biome-ignore lint/suspicious/noExplicitAny: <general-purpose>
	action: (this: Command, ...args: any[]) => void | Promise<void>;
}

export type { CliCommand };
