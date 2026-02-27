import { Command } from "commander";
import {
	cloneProfileCommand,
	completionCommand,
	currentIdentityCommand,
	doctorCommand,
	editProfileCommand,
	exportProfileCommand,
	importProfileCommand,
	listProfilesCommand,
	newProfileCommand,
	removeProfileCommand,
	renameProfileCommand,
	rulesCommand,
	useProfileCommand,
} from "@/commands";

function buildProgram(version: string): Command {
	const program = new Command();

	program
		.name("gitface")
		.description("A simple CLI tool to change your “face” in Git")
		.version(version)
		.action(currentIdentityCommand.action);

	// Profile CRUD
	program.addCommand(newProfileCommand.command);
	program.addCommand(listProfilesCommand.command);
	program.addCommand(editProfileCommand.command);
	program.addCommand(removeProfileCommand.command);
	program.addCommand(cloneProfileCommand.command);
	program.addCommand(renameProfileCommand.command);
	program.addCommand(exportProfileCommand.command);
	program.addCommand(importProfileCommand.command);
	program.addCommand(completionCommand.command);

	// Profile application
	program.addCommand(useProfileCommand.command);
	program.addCommand(currentIdentityCommand.command);
    program.addCommand(rulesCommand.command);

	// Diagnostics
	program.addCommand(doctorCommand.command);

	program.showHelpAfterError("(use --help for usage information)");
	program.showSuggestionAfterError(true);

	return program;
}

export function runCLI(version: string): void {
	const program = buildProgram(version);
	program.parse();
}
