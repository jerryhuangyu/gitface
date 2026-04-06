import chalk from "chalk";
import type { ConfigScope, GitIdentity } from "@/core/git-service";
import { buildResultEnvelope, type ResultEnvelope } from "@/core/result-envelope";

const infoIcon = chalk.blue("ℹ");
const errorIcon = chalk.red("✖");

export const sendCurrentIdentityMsg = (identity: GitIdentity, scope?: ConfigScope): void => {
  const heading = scope ? `Current Git identity (${scope} scope):` : "Current Git identity:";
  const gitName = identity.gitName ?? chalk.dim("<unset>");
  const email = identity.email ?? chalk.dim("<unset>");
  const signingKey = identity.signingKey ?? chalk.dim("<unset>");

  console.log();
  console.log(heading);
  console.log();
  console.log(`${infoIcon} ${chalk.dim("user.name")}  ${gitName}`);
  console.log(`${infoIcon} ${chalk.dim("user.email")}  ${email}`);
  console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
  console.log();
};

export const sendCurrentIdentityJson = (identity: GitIdentity, scope?: ConfigScope): void => {
  console.log(
    JSON.stringify(
      {
        gitName: identity.gitName,
        email: identity.email,
        signingKey: identity.signingKey ?? null,
        ...(scope ? { scope } : {}),
      },
      null,
      2,
    ),
  );
};

interface CurrentIdentityEnvelopeData {
  gitName: string | null;
  email: string | null;
  signingKey: string | null;
  scope?: ConfigScope;
}

export const sendCurrentIdentityEnvelopeSuccess = (
  identity: GitIdentity,
  scope: ConfigScope | undefined,
  durationMs: number,
  traceId: string,
): void => {
  writeCurrentEnvelope(
    buildResultEnvelope({
      status: "success",
      code: "CURRENT_IDENTITY_RESOLVED",
      message: "Current Git identity resolved.",
      data: {
        gitName: identity.gitName ?? null,
        email: identity.email ?? null,
        signingKey: identity.signingKey ?? null,
        ...(scope ? { scope } : {}),
      },
      errors: [],
      durationMs,
      traceId,
    }),
  );
};

export const sendCurrentIdentityEnvelopeError = (
  errorCode: string,
  message: string,
  durationMs: number,
  traceId: string,
): void => {
  writeCurrentEnvelope(
    buildResultEnvelope({
      status: "error",
      code: errorCode,
      message,
      data: null,
      errors: [{ code: errorCode, message }],
      durationMs,
      traceId,
    }),
  );
};

export const sendCurrentIdentityFailedMsg = (reason: string): void => {
  console.error(`${errorIcon} ${reason}`);
};

export const sendCurrentIdentityFailedJson = (reason: string): void => {
  console.log(
    JSON.stringify(
      {
        status: "error",
        reason,
      },
      null,
      2,
    ),
  );
};

function writeCurrentEnvelope(envelope: ResultEnvelope<CurrentIdentityEnvelopeData | null>): void {
  console.log(JSON.stringify(envelope));
}
