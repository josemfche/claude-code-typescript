import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execAsync = promisify(exec);

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
  code?: number;
};

export type ShellResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly spawnError: string | null;
};

const isExecError = (error: unknown): error is ExecError =>
  error instanceof Error;

export const runShellCommand = (
  command: string,
): Effect.Effect<ShellResult> =>
  Effect.tryPromise({
    try: async () => {
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });

        return {
          stdout,
          stderr,
          exitCode: 0,
          spawnError: null,
        };
      } catch (error) {
        if (!isExecError(error)) {
          throw error;
        }

        return {
          stdout: error.stdout ?? "",
          stderr: error.stderr ?? "",
          exitCode: typeof error.code === "number" ? error.code : 1,
          spawnError: null,
        };
      }
    },
    catch: (cause) => (isExecError(cause) ? cause : new Error(String(cause))),
  }).pipe(
    Effect.catchAll((cause) =>
      Effect.succeed({
        stdout: isExecError(cause) ? (cause.stdout ?? "") : "",
        stderr: isExecError(cause) ? (cause.stderr ?? "") : "",
        exitCode: 1,
        spawnError: String(cause),
      }),
    ),
  );
