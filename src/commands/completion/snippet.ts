import process from "node:process";
import { withCommandHandling } from "../command-runner";

type SupportedShell = "zsh" | "bash";

const PROFILE_COMPLETION_SNIPPETS: Record<SupportedShell, string> = {
	zsh: `# gitface completion (zsh)
_gitface_profile_complete() {
  local sub
  sub="\${words[2]}"

  if [[ $CURRENT -ne 3 ]]; then
    return 1
  fi

  if [[ "$sub" != "rm" && "$sub" != "remove" && "$sub" != "use" && "$sub" != "edit" && "$sub" != "clone" && "$sub" != "rename" && "$sub" != "mv" ]]; then
    return 1
  fi

  local -a names
  names=("\${(@f)$(gitface completion profiles --prefix "$PREFIX")}")
  compadd -- "$names[@]"
}
compdef _gitface_profile_complete gitface
`,
	bash: `# gitface completion (bash)
_gitface_profile_complete() {
  local cur sub
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  sub="\${COMP_WORDS[1]}"

  if [[ $COMP_CWORD -eq 2 && ( "$sub" == "rm" || "$sub" == "remove" || "$sub" == "use" || "$sub" == "edit" || "$sub" == "clone" || "$sub" == "rename" || "$sub" == "mv" ) ]]; then
    COMPREPLY=( $(compgen -W "$(gitface completion profiles --prefix "$cur")" -- "$cur") )
  fi
}
complete -F _gitface_profile_complete gitface
`,
};

interface SnippetOptions {
	shell: SupportedShell;
}

const snippetAction: (options: SnippetOptions) => Promise<void> =
	withCommandHandling("command:completion:snippet", async (options) => {
		const shell = options.shell;
		const snippet = PROFILE_COMPLETION_SNIPPETS[shell];

		if (!snippet) {
			process.exitCode = 1;
			return;
		}

		const needsTrailingNewline = !snippet.endsWith("\n");
		process.stdout.write(snippet);
		if (needsTrailingNewline) {
			process.stdout.write("\n");
		}
	});

export default snippetAction;
