import chalk from "chalk";
import { buildResultEnvelope, type ResultEnvelope } from "@/core/result-envelope";
import type { Profile } from "@/domain/profile";

const checkIcon = chalk.greenBright("✔");
const crossIcon = chalk.redBright("✖");
const infoIcon = chalk.blue("ℹ");

export const sendProfileRenameSuccessMsg = (
  oldName: string,
  newName: string,
  rulesUpdated: number,
): void => {
  console.log();
  console.log(`${checkIcon} Renamed profile '${oldName}' to '${newName}'.`);
  console.log(`${infoIcon} ${chalk.dim("rules updated")}  ${rulesUpdated}`);
};

export const sendProfileRenameFailedMsg = (reason: string): void => {
  console.log();
  console.log(`${crossIcon} Profile rename failed: ${chalk.red(reason)}`);
};

export const sendProfileRenameDryRunMsg = (
  oldName: string,
  newName: string,
  profile: Profile,
  overwrite: boolean,
  rulesToUpdate: number,
): void => {
  const signingKey = profile.signingKey ?? chalk.dim("<unset>");
  console.log();
  console.log(`${infoIcon} Dry run: no profile files were changed.`);
  console.log(`${infoIcon} ${chalk.dim("from")}  '${oldName}'`);
  console.log(`${infoIcon} ${chalk.dim("to")}  '${newName}'`);
  console.log(`${infoIcon} ${chalk.dim("overwrite")}  ${overwrite ? "yes" : "no"}`);
  console.log(`${infoIcon} ${chalk.dim("rules to update")}  ${rulesToUpdate}`);
  console.log(`${infoIcon} ${chalk.dim("user.name")}  ${profile.gitName}`);
  console.log(`${infoIcon} ${chalk.dim("user.email")}  ${profile.email}`);
  console.log(`${infoIcon} ${chalk.dim("signingKey")}  ${signingKey}`);
  console.log();
  console.log(`${checkIcon} Would rename profile '${oldName}' to '${newName}'.`);
};

export const sendProfileRenameSuccessJson = (
  oldName: string,
  profile: Profile,
  rulesUpdated: number,
): void => {
  console.log(
    JSON.stringify({
      status: "renamed",
      oldName,
      name: profile.name,
      rulesUpdated,
      gitName: profile.gitName,
      email: profile.email,
      signingKey: profile.signingKey ?? null,
    }),
  );
};

export const sendProfileRenameFailedJson = (
  oldName: string,
  newName: string,
  reason: string,
): void => {
  console.log(
    JSON.stringify({
      status: "error",
      oldName,
      newName,
      reason,
    }),
  );
};

export const sendProfileRenameDryRunJson = (
  oldName: string,
  newName: string,
  profile: Profile,
  overwrite: boolean,
  rulesToUpdate: number,
): void => {
  console.log(
    JSON.stringify({
      status: "dry-run",
      oldName,
      newName,
      overwrite,
      rulesToUpdate,
      gitName: profile.gitName,
      email: profile.email,
      signingKey: profile.signingKey ?? null,
    }),
  );
};

interface RenameEnvelopeProfile {
  name: string;
  gitName: string;
  email: string;
  signingKey: string | null;
}

interface RenameEnvelopeData {
  result: "renamed" | "dry-run";
  oldName: string;
  newName: string;
  overwrite?: boolean;
  rulesUpdated: number;
  profile: RenameEnvelopeProfile;
}

export const sendProfileRenameEnvelopeSuccess = (
  code: string,
  message: string,
  data: RenameEnvelopeData,
  durationMs: number,
  traceId: string,
): void => {
  writeRenameEnvelope(
    buildResultEnvelope({
      status: "success",
      code,
      message,
      data,
      errors: [],
      durationMs,
      traceId,
    }),
  );
};

export const sendProfileRenameEnvelopeError = (
  code: string,
  message: string,
  durationMs: number,
  traceId: string,
): void => {
  writeRenameEnvelope(
    buildResultEnvelope({
      status: "error",
      code,
      message,
      data: null,
      errors: [{ code, message }],
      durationMs,
      traceId,
    }),
  );
};

function writeRenameEnvelope(envelope: ResultEnvelope<RenameEnvelopeData | null>): void {
  console.log(JSON.stringify(envelope));
}
