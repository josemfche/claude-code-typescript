import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { mkdir, readFile, unlink, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { resolveTurn } from "../app/conversation.ts";
import { editFile, formatEditOutput } from "../app/edit.ts";
import { fetchUrl } from "../app/fetch.ts";
import { globToRegExp, matchesPattern } from "../app/glob.ts";
import { formatListDirOutput, listDir } from "../app/ls.ts";
import { multiEditFile } from "../app/multi-edit.ts";
import { formatTodoList } from "../app/tools/todo-write.ts";

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

    try {
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
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });

  test("formats a real unified diff", async () => {
    await writeFile(fixture, "alpha\nbeta\n", "utf-8");

    try {
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
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });

  test("marks unchanged context lines without duplicate removals", async () => {
    await writeFile(fixture, "before\nalpha\nafter\n", "utf-8");

    try {
      const result = await Effect.runPromise(
        editFile({
          file_path: fixture,
          old_string: "alpha",
          new_string: "gamma",
        }),
      );

      const diff = formatEditOutput(result).split("```diff")[1]?.split("```")[0] ?? "";
      expect(diff).toContain(" before");
      expect(diff).toContain(" after");
      expect(diff).not.toContain("-before");
      expect(diff).not.toContain("+before");
      expect(diff).not.toContain("-after");
      expect(diff).not.toContain("+after");
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });
});

describe("glob", () => {
  test("matches basename when search path is a single file", () => {
    const pattern = globToRegExp("*.ts");
    const filePath = path.resolve("app/main.ts");

    expect(matchesPattern(pattern, filePath, filePath, true)).toBe(true);
  });

  test("matches cwd-relative path for single-file roots", () => {
    const pattern = globToRegExp("app/*.ts");
    const filePath = path.resolve("app/main.ts");

    expect(matchesPattern(pattern, filePath, filePath, true)).toBe(true);
  });
});

describe("listDir", () => {
  test("lists the app directory with trailing slashes on folders", async () => {
    const result = await Effect.runPromise(
      listDir({ searchPath: "app", limit: 200 }),
    );

    expect(result.path.endsWith(`${path.sep}app`)).toBe(true);
    expect(result.entries.some((entry) => entry.name === "main.ts")).toBe(true);
    expect(
      result.entries.some(
        (entry) => entry.name === "tools" && entry.kind === "directory",
      ),
    ).toBe(true);

    const output = formatListDirOutput(result);
    expect(output).toContain("tools/");
  });

  test("reports an empty directory", async () => {
    const emptyDir = path.join("test", "fixtures", "empty-dir");
    await mkdir(emptyDir, { recursive: true });

    try {
      const result = await Effect.runPromise(listDir({ searchPath: emptyDir }));
      expect(result.entries).toEqual([]);
      expect(formatListDirOutput(result)).toContain("(empty directory)");
    } finally {
      await rm(emptyDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("rejects non-directory paths", async () => {
    await writeFile(fixture, "hello\n", "utf-8");

    try {
      const result = await Effect.runPromise(
        Effect.either(listDir({ searchPath: fixture })),
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("path is not a directory");
      }
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });
});

describe("multiEditFile", () => {
  test("applies sequential edits and writes once", async () => {
    await writeFile(fixture, "one two three\n", "utf-8");

    try {
      const result = await Effect.runPromise(
        multiEditFile({
          file_path: fixture,
          edits: [
            { old_string: "one", new_string: "1" },
            { old_string: "two", new_string: "2" },
          ],
        }),
      );

      expect(result.replacements).toBe(2);
      expect(result.contentAfter).toBe("1 2 three\n");
      expect(await readFile(fixture, "utf-8")).toBe("1 2 three\n");
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });

  test("later edits operate on earlier edit results", async () => {
    await writeFile(fixture, "a\n", "utf-8");

    try {
      const result = await Effect.runPromise(
        multiEditFile({
          file_path: fixture,
          edits: [
            { old_string: "a", new_string: "b" },
            { old_string: "b", new_string: "c" },
          ],
        }),
      );

      expect(result.contentAfter).toBe("c\n");
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });

  test("is atomic: leaves the file unchanged when an edit fails", async () => {
    await writeFile(fixture, "alpha beta\n", "utf-8");

    try {
      const result = await Effect.runPromise(
        Effect.either(
          multiEditFile({
            file_path: fixture,
            edits: [
              { old_string: "alpha", new_string: "ALPHA" },
              { old_string: "missing", new_string: "x" },
            ],
          }),
        ),
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.message).toContain("edit #2");
      }
      expect(await readFile(fixture, "utf-8")).toBe("alpha beta\n");
    } finally {
      await unlink(fixture).catch(() => {});
    }
  });
});

describe("fetchUrl", () => {
  test("returns status, content type, and body for a 200 response", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response("pong", { headers: { "content-type": "text/plain" } }),
    });

    try {
      const result = await Effect.runPromise(
        fetchUrl({ url: `http://localhost:${server.port}/ping` }),
      );

      expect(result.status).toBe(200);
      expect(result.body).toBe("pong");
      expect(result.contentType).toContain("text/plain");
    } finally {
      server.stop(true);
    }
  });

  test("echoes a POST body to the server", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: async (req) => new Response(await req.text()),
    });

    try {
      const result = await Effect.runPromise(
        fetchUrl({
          url: `http://localhost:${server.port}/echo`,
          method: "POST",
          body: "hello-body",
        }),
      );

      expect(result.status).toBe(200);
      expect(result.body).toBe("hello-body");
    } finally {
      server.stop(true);
    }
  });

  test("rejects non-http(s) protocols", async () => {
    const result = await Effect.runPromise(
      Effect.either(fetchUrl({ url: "file:///etc/passwd" })),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left.message).toContain("protocol");
    }
  });
});

describe("formatTodoList", () => {
  test("renders status symbols and a summary", () => {
    const output = formatTodoList([
      { content: "Set up", status: "completed" },
      { content: "Build feature", status: "in_progress" },
      { content: "Write tests", status: "pending" },
    ]);

    expect(output).toContain("[x] 1. Set up");
    expect(output).toContain("[~] 2. Build feature");
    expect(output).toContain("[ ] 3. Write tests");
    expect(output).toContain("1 completed, 1 in progress, 1 pending");
  });

  test("notes cancelled items when present", () => {
    const output = formatTodoList([
      { content: "Abandoned", status: "cancelled" },
      { content: "Active", status: "in_progress" },
    ]);

    expect(output).toContain("[-] 1. Abandoned");
    expect(output).toContain("1 cancelled");
  });
});
