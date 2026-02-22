/**
 * Effect test helpers for Bun's built-in test runner.
 *
 * Ports the `@effect/vitest` API to `bun:test`, including `it.effect`,
 * `it.scoped`, `it.live`, `layer()`, `flakyTest`, property-based testing,
 * and assertion utilities.
 *
 * @example
 * ```ts
 * import { it } from "effect-bun-test"
 * import { Effect } from "effect"
 *
 * it.effect("adds numbers", () =>
 *   Effect.gen(function*() {
 *     const result = 1 + 1
 *     expect(result).toBe(2)
 *   })
 * )
 * ```
 *
 * @module
 */

// Re-export bun:test for convenience (parallel to @effect/vitest re-exporting vitest)
export {
  describe,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  test,
  mock,
  spyOn,
  jest,
  vi,
  setSystemTime
} from "bun:test"

// ---------------------------------------------------------------------------
// Core exports from internal
// ---------------------------------------------------------------------------
export {
  effect,
  scoped,
  live,
  scopedLive,
  makeTester,
  flakyTest,
  prop,
  layer,
  makeMethods,
  addEqualityTesters
} from "./internal/internal.js"

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type {
  TestFunction,
  Test,
  Tester,
  PropEffect,
  Prop,
  TestServices,
  Methods,
  MethodsNonLive,
  LayerOptions,
  LayerFn
} from "./internal/internal.js"

// ---------------------------------------------------------------------------
// Composed `it` — the primary import for most users
// ---------------------------------------------------------------------------
import { test as bunTest } from "bun:test"
import {
  effect,
  scoped,
  live,
  scopedLive,
  flakyTest,
  layer,
  prop
} from "./internal/internal.js"
import type { Methods } from "./internal/internal.js"

/**
 * Drop-in replacement for bun:test's `it` / `test`, augmented with Effect
 * methods.
 *
 * @example
 * ```ts
 * import { it } from "effect-bun-test"
 *
 * it.effect("runs an Effect test", () =>
 *   Effect.succeed(42).pipe(Effect.map((n) => expect(n).toBe(42)))
 * )
 *
 * it.scoped("runs with scope", () =>
 *   Effect.gen(function*() {
 *     yield* Effect.addFinalizer(() => Effect.void)
 *   })
 * )
 * ```
 */
export const it: typeof bunTest & Methods = Object.assign(bunTest, {
  effect,
  scoped,
  live,
  scopedLive,
  flakyTest,
  layer,
  prop
} satisfies Methods)
