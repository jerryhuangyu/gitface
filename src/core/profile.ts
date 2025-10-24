import { InvalidProfileError } from "../errors";

export interface ProfileSnapshot {
	name: string;
	gitName: string;
	email: string;
	signingKey?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProfileInput {
	name: string;
	gitName: string;
	email: string;
	signingKey?: string | null;
}

export interface ProfileUpdate {
	gitName?: string;
	email?: string;
	signingKey?: string | null;
}

export class Profile {
	private constructor(private readonly state: ProfileSnapshot) {}

	static create(input: ProfileInput): Profile {
		const timestamp = new Date().toISOString();
		const profile = new Profile({
			name: input.name,
			gitName: input.gitName,
			email: input.email,
			signingKey: input.signingKey ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		});
		profile.ensureValid();
		return profile;
	}

	static fromSnapshot(snapshot: ProfileSnapshot): Profile {
		const profile = new Profile({ ...snapshot });
		profile.ensureValid();
		return profile;
	}

	get name(): string {
		return this.state.name;
	}

	get gitName(): string {
		return this.state.gitName;
	}

	get email(): string {
		return this.state.email;
	}

	get signingKey(): string | null | undefined {
		return this.state.signingKey;
	}

	get createdAt(): string {
		return this.state.createdAt;
	}

	get updatedAt(): string {
		return this.state.updatedAt;
	}

	update(update: ProfileUpdate): void {
		if (update.gitName !== undefined) {
			this.state.gitName = update.gitName;
		}

		if (update.email !== undefined) {
			this.state.email = update.email;
		}

		if (update.signingKey !== undefined) {
			this.state.signingKey = update.signingKey;
		}

		this.state.updatedAt = new Date().toISOString();
		this.ensureValid();
	}

	snapshot(): ProfileSnapshot {
		return { ...this.state };
	}

	private ensureValid(): void {
		if (!this.state.gitName?.trim()) {
			throw new InvalidProfileError("Profile must define a Git user.name.");
		}

		if (!this.state.email?.trim()) {
			throw new InvalidProfileError("Profile must define a Git user.email.");
		}
	}
}
