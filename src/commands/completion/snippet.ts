import process from "node:process";
import { withCommandHandling } from "../command-runner";

type SupportedShell = "zsh" | "bash";

const PROFILE_COMPLETION_SNIPPETS: Record<SupportedShell, string> = {
  zsh: `# gitface completion (zsh)
_gitface_profile_complete() {
  if (( CURRENT == 2 )); then
    local -a commands
    commands=("\${(@f)$(gitface completion commands --prefix "$PREFIX" --limit 50)}")
    compadd -- "\${commands[@]}"
    return 0
  fi

  local sub nested
  sub=\${words[2]}
  nested=\${words[3]}

  if [[ $sub == rules && CURRENT -eq 3 ]]; then
    local -a rule_commands
    rule_commands=("\${(@f)$(gitface completion rules-commands --prefix "$PREFIX" --limit 50)}")
    compadd -- "\${rule_commands[@]}"
    return 0
  fi

  if [[ $sub == rules && $nested == add ]]; then
    (( CURRENT == 5 )) || return 1
  else
    (( CURRENT == 3 )) || return 1
  fi

  local ok=0
  case $sub in
    rm|remove|use|edit|clone|rename|mv) ok=1 ;;
    rules) [[ $nested == add ]] && ok=1 ;;
  esac
  (( ok )) || return 1

  local -a names
  names=("\${(@f)$(gitface completion profiles --prefix "$PREFIX" --limit 50)}")
  compadd -- "\${names[@]}"
}
compdef _gitface_profile_complete gitface
`,
  bash: `# gitface completion (bash)
_gitface_profile_complete() {
  local cur sub nested
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  sub="\${COMP_WORDS[1]}"
  nested="\${COMP_WORDS[2]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$(gitface completion commands --prefix "$cur" --limit 50)" -- "$cur") )
    return
  fi

  if [[ $COMP_CWORD -eq 2 && "$sub" == "rules" ]]; then
    COMPREPLY=( $(compgen -W "$(gitface completion rules-commands --prefix "$cur" --limit 50)" -- "$cur") )
    return
  fi

  if [[ ( $COMP_CWORD -eq 2 && ( "$sub" == "rm" || "$sub" == "remove" || "$sub" == "use" || "$sub" == "edit" || "$sub" == "clone" || "$sub" == "rename" || "$sub" == "mv" ) ) || ( $COMP_CWORD -eq 4 && "$sub" == "rules" && "$nested" == "add" ) ]]; then
    COMPREPLY=( $(compgen -W "$(gitface completion profiles --prefix "$cur" --limit 50)" -- "$cur") )
  fi
}
complete -F _gitface_profile_complete gitface
`,
};

interface SnippetOptions {
  shell: SupportedShell;
}

const snippetAction: (options: SnippetOptions) => Promise<void> = withCommandHandling(
  "command:completion:snippet",
  async (options) => {
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
  },
);

export default snippetAction;
