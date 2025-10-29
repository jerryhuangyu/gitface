import { Command } from "commander";
import type { CliCommand } from "../command";
import action from "./action";

const command: Command = new Command("edit")
	.description("Update the stored details for an existing Git profile")
	.argument("<profile>", "profile identifier")
	.option("-n, --git-name <value>", "New Git user.name value")
	.option("-e, --email <value>", "New Git user.email value")
	.option("-s, --signing-key <value>", "New Git signing key value")
	.option("--unset-signing-key", "Remove the stored signing key")
	.action(action);

const editProfileCommand: CliCommand = {
	command,
	action,
};

export default editProfileCommand;
