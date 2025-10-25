import { Command } from "commander";
import {
	currentIdentityCommand,
	editProfileCommand,
	listProfilesCommand,
	newProfileCommand,
	removeProfileCommand,
	useProfileCommand,
} from "@/commands";

function buildProgram(): Command {
	const program = new Command();

	program
		.name("gitface")
		.description("A simple CLI tool to change your “face” in Git")
		.version("0.1.0");

	// Profile CRUD
	program.addCommand(newProfileCommand);
	program.addCommand(listProfilesCommand);
	program.addCommand(editProfileCommand);
	program.addCommand(removeProfileCommand);

	// Profile application
	program.addCommand(useProfileCommand);
	program.addCommand(currentIdentityCommand);

	program.showHelpAfterError("(use --help for usage information)");
	program.showSuggestionAfterError(true);

	return program;
}

export function runCLI(): void {
	const program = buildProgram();
	program.parse();
}
