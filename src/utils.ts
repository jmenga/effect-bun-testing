import { expect } from "bun:test"
import * as Equal from "effect/Equal"
import { Option, Result, Exit, Cause } from "effect"

// ---------------------------------------------------------------------------
// Primitive assertions
// ---------------------------------------------------------------------------

export function fail(message: string): never {
  throw new Error(message)
}

export function deepStrictEqual<A>(actual: A, expected: A, message?: string): void {
  expect(actual).toStrictEqual(expected)
  if (message) {
    // Message is informational — the assertion above throws on failure
  }
}

export function strictEqual<A>(actual: A, expected: A, message?: string): void {
  expect(actual).toBe(expected)
}

export function notDeepStrictEqual<A>(actual: A, expected: A, message?: string): void {
  expect(actual).not.toStrictEqual(expected)
}

/** Compare using Effect's `Equal.equals` for structural equality. */
export function assertEquals<A>(actual: A, expected: A, message?: string): void {
  if (!Equal.equals(actual, expected)) {
    const msg = message ?? `Expected values to be equal (via Equal.equals)`
    throw new Error(
      `${msg}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`
    )
  }
}

export function doesNotThrow(thunk: () => void, message?: string): void {
  try {
    thunk()
  } catch (e) {
    throw new Error(message ?? `Expected function not to throw, but it threw: ${e}`)
  }
}

// ---------------------------------------------------------------------------
// Boolean assertions
// ---------------------------------------------------------------------------

export function assertTrue(self: unknown, message?: string): asserts self {
  expect(self).toBeTruthy()
}

export function assertFalse(self: boolean, message?: string): void {
  expect(self).toBeFalsy()
}

// ---------------------------------------------------------------------------
// Type assertions
// ---------------------------------------------------------------------------

export function assertInstanceOf<C extends abstract new (...args: any[]) => any>(
  value: unknown,
  constructor: C,
  message?: string
): asserts value is InstanceType<C> {
  expect(value).toBeInstanceOf(constructor)
}

// ---------------------------------------------------------------------------
// String assertions
// ---------------------------------------------------------------------------

export function assertInclude(actual: string | undefined, expected: string): void {
  expect(actual).toBeDefined()
  expect(actual).toInclude(expected)
}

export function assertMatch(actual: string, regexp: RegExp): void {
  expect(actual).toMatch(regexp)
}

// ---------------------------------------------------------------------------
// Throw assertions
// ---------------------------------------------------------------------------

export function throws(
  thunk: () => void,
  error?: Error | ((u: unknown) => void)
): void {
  if (typeof error === "function") {
    try {
      thunk()
      throw new Error("Expected function to throw")
    } catch (e) {
      error(e)
    }
  } else if (error) {
    expect(thunk).toThrow(error.message)
  } else {
    expect(thunk).toThrow()
  }
}

export async function throwsAsync(
  thunk: () => Promise<void>,
  error?: Error | ((u: unknown) => void)
): Promise<void> {
  if (typeof error === "function") {
    try {
      await thunk()
      throw new Error("Expected async function to throw")
    } catch (e) {
      error(e)
    }
  } else {
    try {
      await thunk()
      throw new Error("Expected async function to throw")
    } catch (e) {
      if (error && e instanceof Error) {
        expect(e.message).toInclude(error.message)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Option assertions
// ---------------------------------------------------------------------------

export function assertNone<A>(
  option: Option.Option<A>
): asserts option is Option.None<never> {
  expect(Option.isNone(option)).toBe(true)
}

export function assertSome<A>(
  option: Option.Option<A>,
  expected: A
): asserts option is Option.Some<A> {
  expect(Option.isSome(option)).toBe(true)
  if (Option.isSome(option)) {
    assertEquals(option.value, expected)
  }
}

// ---------------------------------------------------------------------------
// Result assertions (v4: Either → Result)
// ---------------------------------------------------------------------------

export function assertSuccess_<A, E>(
  result: Result.Result<A, E>,
  expected: A
): asserts result is Result.Success<A, E> {
  expect(Result.isSuccess(result)).toBe(true)
  if (Result.isSuccess(result)) {
    assertEquals(result.success, expected)
  }
}

export function assertFailure_<A, E>(
  result: Result.Result<A, E>,
  expected: E
): asserts result is Result.Failure<A, E> {
  expect(Result.isFailure(result)).toBe(true)
  if (Result.isFailure(result)) {
    assertEquals(result.failure as any, expected as any)
  }
}

/** Alias for assertSuccess_ (vitest compat: assertRight). */
export function assertRight<A, E>(
  result: Result.Result<A, E>,
  expected: A
): asserts result is Result.Success<A, E> {
  assertSuccess_(result, expected)
}

/** Alias for assertFailure_ (vitest compat: assertLeft). */
export function assertLeft<A, E>(
  result: Result.Result<A, E>,
  expected: E
): asserts result is Result.Failure<A, E> {
  assertFailure_(result, expected)
}

// ---------------------------------------------------------------------------
// Exit assertions
// ---------------------------------------------------------------------------

export function assertExitSuccess<A, E>(
  exit: Exit.Exit<A, E>,
  expected: A
): asserts exit is Exit.Success<A, never> {
  expect(Exit.isSuccess(exit)).toBe(true)
  if (Exit.isSuccess(exit)) {
    assertEquals(exit.value, expected)
  }
}

export function assertExitFailure<A, E>(
  exit: Exit.Exit<A, E>,
  expected: Cause.Cause<E>
): asserts exit is Exit.Failure<never, E> {
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    assertEquals(exit.cause as any, expected as any)
  }
}

/** @deprecated Use assertExitSuccess. Alias. */
export const assertSuccess = assertExitSuccess
/** @deprecated Use assertExitFailure. Alias. */
export const assertFailure = assertExitFailure
