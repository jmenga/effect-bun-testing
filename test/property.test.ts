import { describe, expect } from "bun:test"
import { it } from "../src/index.ts"
import { Effect } from "effect"
import * as fc from "fast-check"

describe("it.prop (non-Effect)", () => {
  it.prop(
    "string arrays always have non-negative length",
    [fc.array(fc.string())],
    (arr) => {
      expect(arr.length).toBeGreaterThanOrEqual(0)
    }
  )

  it.prop(
    "integers are whole numbers",
    [fc.integer()],
    (n) => {
      expect(Number.isInteger(n)).toBe(true)
    }
  )

  it.prop(
    "multiple arbitraries",
    [fc.string(), fc.integer({ min: 0, max: 100 })],
    (str, num) => {
      expect(typeof str).toBe("string")
      expect(num).toBeGreaterThanOrEqual(0)
      expect(num).toBeLessThanOrEqual(100)
    }
  )
})

describe("it.effect.prop (Effect)", () => {
  it.effect.prop(
    "Effect property: positive numbers remain positive after increment",
    [fc.integer({ min: 1, max: 1000 })],
    (n) =>
      Effect.gen(function*() {
        const result = yield* Effect.succeed(n + 1)
        expect(result).toBeGreaterThan(n)
      })
  )

  it.effect.prop(
    "Effect property: string concatenation",
    [fc.string(), fc.string()],
    (a, b) =>
      Effect.gen(function*() {
        const result = yield* Effect.succeed(a + b)
        expect(result).toBe(a + b)
        expect(result.length).toBe(a.length + b.length)
      })
  )
})
