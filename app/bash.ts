import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execAsync = promisify(exec);

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
};

const isExecError = (error: unknown): error is ExecError =>
  error instanceof Error;

const formatCommandOutput = (stdout: string, stderr: string): string => {
  if (stdout && stderr) {
    return `${stdout}${stderr}`;
  }
  return stdout || stderr || "";
};

const runShellCommandUnsafe = async (command: string): Promise<string> => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });
    return formatCommandOutput(stdout, stderr);
  } catch (error) {
    if (!isExecError(error)) {
      throw error;
    }

    const output = formatCommandOutput(
      error.stdout ?? "",
      error.stderr ?? "",
    );
    return output || error.message;
  }
};

export const runShellCommand = (
  command: string,
): Effect.Effect<string, ExecError> =>
  Effect.tryPromise({
    try: () => runShellCommandUnsafe(command),
    catch: (cause) => (isExecError(cause) ? cause : new Error(String(cause))),
  });
