import path from "node:path";

export interface FolderRule {
	directory: string;
	profileName: string;
}

export class Rule {
	private constructor(
		public readonly directory: string,
		public readonly profileName: string,
	) {}

	static create(directory: string, profileName: string): Rule {
		const absPath = path.resolve(directory);
		const cleanPath = absPath.endsWith(path.sep) ? absPath : absPath + path.sep;
		return new Rule(cleanPath, profileName);
	}

	static parse(key: string, value: string): Rule | null {
		// key format: includeif.gitdir:/path/to/dir/.path
		if (!key.toLowerCase().startsWith("includeif.gitdir:")) {
			return null;
		}

		const match = key.match(/^includeif\.gitdir:(.+)\.path$/i);
		if (!match) {
			return null;
		}

		const directory = match[1];
		// Value is the path to the profile config file: .../identities/<name>.gitconfig
		const configPath = value;
		const basename = path.basename(configPath);
		
		if (!basename.endsWith(".gitconfig")) {
			return null;
		}

		const profileName = basename.replace(".gitconfig", "");
		return new Rule(directory, profileName);
	}

	get configKey(): string {
		return `includeIf.gitdir:${this.directory}.path`;
	}

	equals(other: Rule): boolean {
		return (
			this.directory === other.directory && this.profileName === other.profileName
		);
	}
}
