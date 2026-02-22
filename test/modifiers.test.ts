import { describe, expect } from "bun:test"
import { it } from "../src/index.ts"
import { Effect } from "effect"

describe("modifiers", () => {
  it.effect.skip("skipped test", () =>
    Effect.gen(function*() {
      throw new Error("should not run")
    })
  )

  it.effect("normal test runs", () =>
    Effect.gen(function*() {
      expect(1 + 1).toBe(2)
    })
  )

  // skipIf: skip when condition is truthy
  it.effect.skipIf(true)("skipped via skipIf(true)", () =>
    Effect.gen(function*() {
      throw new Error("should not run")
    })
  )

  it.effect.skipIf(false)("runs via skipIf(false)", () =>
    Effect.gen(function*() {
      expect(true).toBe(true)
    })
  )

  // if: run when condition is truthy
  it.effect.if(true)("runs via if(true)", () =>
    Effect.gen(function*() {
      expect(42).toBe(42)
    })
  )

  it.effect.if(false)("skipped via if(false)", () =>
    Effect.gen(function*() {
      throw new Error("should not run")
    })
  )

  // runIf: alias for if (vitest compat)
  it.effect.runIf(true)("runs via runIf(true)", () =>
    Effect.gen(function*() {
      expect("ok").toBe("ok")
    })
  )

  // each: parameterized tests
  it.effect.each([1, 2, 3])("doubles %d", (n) =>
    Effect.gen(function*() {
      const result = yield* Effect.succeed(n * 2)
      expect(result).toBe(n * 2)
    })
  )

  // failing: test that is expected to fail
  it.effect.failing("expected to fail", () =>
    Effect.gen(function*() {
      yield* Effect.fail("intentional failure")
    })
  )

  // fails: alias for failing (vitest compat)
  it.effect.fails("also expected to fail (alias)", () =>
    Effect.gen(function*() {
      yield* Effect.fail("intentional failure")
    })
  )
})
