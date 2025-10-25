export class GitfaceError extends Error {}

export class ProfileAlreadyExistsError extends GitfaceError {
	constructor(readonly profileName: string) {
		super(`Profile '${profileName}' already exists.`);
	}
}

export class ProfileNotFoundError extends GitfaceError {
	constructor(readonly profileName: string) {
		super(`Profile '${profileName}' was not found.`);
	}
}

export class InvalidProfileError extends GitfaceError {
	// biome-ignore lint/complexity/noUselessConstructor: <remain extending ability>
	constructor(message: string) {
		super(message);
	}
}
