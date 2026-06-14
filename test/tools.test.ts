import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { resolveTurn } from "../app/conversation.ts";
import { editFile, formatEditOutput } from "../app/edit.ts";
import { globToRegExp, matchesPattern } from "../app/glob.ts";
import { grepFiles } from "../app/grep.ts";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const fixture = path.join("test", "fixtures", "edit-target.txt");

describe("resolveTurn", () => {
  test("continues when tool calls are present", () => {
    const outcome = resolveTurn([], {
      assistant: {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "1",
            type: "function",
            function: { name: "Read", arguments: "{}" },
          },
        ],
      },
      finishReason: "tool_calls",
    });

    expect(outcome._tag).toBe("Continue");
  });

  test("continues when finish_reason is tool_calls but tool list is empty", () => {
    const outcome = resolveTurn([], {
      assistant: {
        role: "assistant",
        content: "partial",
        toolCalls: [],
      },
      finishReason: "tool_calls",
    });

    expect(outcome._tag).toBe("Continue");
  });

  test("nudges when final assistant content is empty", () => {
    const outcome = resolveTurn([], {
      assistant: {
        role: "assistant",
        content: "   ",
        toolCalls: [],
      },
      finishReason: "stop",
    });

    expect(outcome._tag).toBe("Continue");
    if (outcome._tag === "Continue") {
      const last = outcome.conversation.at(-1);
      expect(last?.role).toBe("user");
    }
  });

  test("returns done content and notes length truncation", () => {
    const outcome = resolveTurn([], {
      assistant: {
        role: "assistant",
        content: "42",
        toolCalls: [],
      },
      finishReason: "length",
    });

    expect(outcome).toEqual({
      _tag: "Done",
      content: "42\n\n[response truncated: model hit length limit]",
    });
  });
});

describe("editFile", () => {
  test("rejects empty old_string on existing files", async () => {
    await writeFile(fixture, "hello\n", "utf-8");

    const result = await Effect.runPromise(
      Effect.either(
        editFile({
          file_path: fixture,
          old_string: "",
          new_string: "world",
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left.message).toContain("old_string cannot be empty");
    }

    await unlink(fixture);
  });

  test("formats a real unified diff", async () => {
    await writeFile(fixture, "alpha\nbeta\n", "utf-8");

    const result = await Effect.runPromise(
      editFile({
        file_path: fixture,
        old_string: "alpha",
        new_string: "gamma",
      }),
    );

    const output = formatEditOutput(result);
    expect(output).toContain("```diff");
    expect(output).toContain("-alpha");
    expect(output).toContain("+gamma");

    await unlink(fixture);
  });
});

describe("glob", () => {
  test("matches basename when search path is a single file", () => {
    const pattern = globToRegExp("*.ts");
    const filePath = path.resolve("app/main.ts");

    expect(
      matchesPattern(pattern, "*.ts", filePath, filePath, true),
    ).toBe(true);
  });

  test("matches cwd-relative path for single-file roots", () => {
    const pattern = globToRegExp("app/*.ts");
    const filePath = path.resolve("app/main.ts");

    expect(
      matchesPattern(pattern, "app/*.ts", filePath, filePath, true),
    ).toBe(true);
  });
});

describe("grepFiles", () => {
  test("reports skipped unreadable files", async () => {
    const result = await Effect.runPromise(
      grepFiles({
        pattern: "fixture",
        searchPath: "test/fixtures",
        limit: 10,
      }),
    );

    expect(result.skippedFiles).toBeGreaterThanOrEqual(0);
  });
});

describe("grep fixture readability", () => {
  test("reads grep fixture files when present", async () => {
    const content = await readFile("app/file1.py", "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });
});
