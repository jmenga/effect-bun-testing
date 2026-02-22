import { describe, test, expect } from "bun:test"
import { Option, Either, Exit, Cause, Effect } from "effect"
import {
  fail,
  deepStrictEqual,
  strictEqual,
  notDeepStrictEqual,
  assertEquals,
  doesNotThrow,
  assertTrue,
  assertFalse,
  assertInstanceOf,
  assertInclude,
  assertMatch,
  throws,
  throwsAsync,
  assertNone,
  assertSome,
  assertRight,
  assertLeft,
  assertExitSuccess,
  assertExitFailure
} from "../src/utils.ts"

describe("primitive assertions", () => {
  test("fail throws", () => {
    expect(() => fail("boom")).toThrow("boom")
  })

  test("deepStrictEqual", () => {
    deepStrictEqual({ a: 1 }, { a: 1 })
    expect(() => deepStrictEqual({ a: 1 }, { a: 2 } as any)).toThrow()
  })

  test("strictEqual", () => {
    strictEqual(42, 42)
    expect(() => strictEqual(42, 43 as any)).toThrow()
  })

  test("notDeepStrictEqual", () => {
    notDeepStrictEqual({ a: 1 }, { a: 2 })
  })

  test("assertEquals (Effect Equal)", () => {
    assertEquals(42, 42)
    assertEquals("hello", "hello")
    // Note: Equal.equals uses reference equality for non-Equal values in v3.
    // Plain arrays are not Equal-tagged, so only same-reference comparisons pass.
    const arr = [1, 2, 3]
    assertEquals(arr, arr)
    expect(() => assertEquals(1, 2)).toThrow()
  })

  test("doesNotThrow", () => {
    doesNotThrow(() => {})
    expect(() => doesNotThrow(() => { throw new Error("oops") })).toThrow()
  })
})

describe("boolean assertions", () => {
  test("assertTrue", () => {
    assertTrue(true)
    assertTrue(1)
    assertTrue("non-empty")
  })

  test("assertFalse", () => {
    assertFalse(false)
  })
})

describe("type assertions", () => {
  test("assertInstanceOf", () => {
    assertInstanceOf(new Error("test"), Error)
    assertInstanceOf([], Array)
  })
})

describe("string assertions", () => {
  test("assertInclude", () => {
    assertInclude("hello world", "world")
  })

  test("assertMatch", () => {
    assertMatch("hello123", /\d+/)
  })
})

describe("throw assertions", () => {
  test("throws without predicate", () => {
    throws(() => { throw new Error("boom") })
  })

  test("throws with error", () => {
    throws(() => { throw new Error("boom") }, new Error("boom"))
  })

  test("throws with function", () => {
    throws(
      () => { throw new Error("boom") },
      (e) => { expect(e).toBeInstanceOf(Error) }
    )
  })

  test("throwsAsync", async () => {
    await throwsAsync(async () => { throw new Error("async boom") })
  })
})

describe("Option assertions", () => {
  test("assertNone", () => {
    assertNone(Option.none())
  })

  test("assertSome", () => {
    assertSome(Option.some(42), 42)
  })
})

describe("Either assertions", () => {
  test("assertRight", () => {
    assertRight(Either.right("ok"), "ok")
  })

  test("assertLeft", () => {
    assertLeft(Either.left("err"), "err")
  })
})

describe("Exit assertions", () => {
  test("assertExitSuccess", () => {
    assertExitSuccess(Exit.succeed(42), 42)
  })

  test("assertExitFailure", () => {
    const exit = Exit.fail("boom")
    assertExitFailure(exit, Cause.fail("boom"))
  })
})
