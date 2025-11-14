import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const functionsDir = join(import.meta.dir, "..", "..");
const edgeFunctionDirectories = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "_shared")
  .map((entry) => ({
    name: entry.name,
    indexPath: join(functionsDir, entry.name, "index.ts"),
  }))
  .filter(({ indexPath }) => existsSync(indexPath));

describe("edge function middleware migration", () => {
  it("ensures each edge function composes the middleware stack", () => {
    const withoutStack = edgeFunctionDirectories
      .filter(({ indexPath }) => {
        const source = readFileSync(indexPath, "utf8");
        return !source.includes("createMiddlewareStack");
      })
      .map(({ name }) => name);

    expect(withoutStack).toEqual([]);
  });

  it("ensures each edge function loads Supabase via middleware", () => {
    const withoutSupabaseMiddleware = edgeFunctionDirectories
      .filter(({ indexPath }) => {
        const source = readFileSync(indexPath, "utf8");
        return !source.includes("withSupabaseServiceRole");
      })
      .map(({ name }) => name);

    expect(withoutSupabaseMiddleware).toEqual([]);
  });
});
