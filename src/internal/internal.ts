import {
  Cause,
  Duration,
  Effect,
  Exit,
  Layer,
  pipe,
  Schedule,
  Scope
} from "effect"
import * as TestContext from "effect/TestContext"
import * as Logger from "effect/Logger"
import {
  describe,
  beforeAll,
  afterAll,
  test as bunTest,
  expect
} from "bun:test"
import * as fc from "fast-check"
import * as Equal from "effect/Equal"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A test body that returns an Effect. */
export interface TestFunction<A, E, R> {
  (): Effect.Effect<A, E, R>
}

/** Registers a named test whose body returns an Effect. */
export interface Test<R> {
  <A, E>(
    name: string,
    self: TestFunction<A, E, R>,
    timeout?: number
  ): void
}

/** Full tester with modifiers (skip, only, each, etc.). */
export interface Tester<R> extends Test<R> {
  readonly skip: Test<R>
  readonly only: Test<R>
  readonly skipIf: (condition: unknown) => Test<R>
  readonly if: (condition: unknown) => Test<R>
  /** Alias for `if` (vitest compat). */
  readonly runIf: (condition: unknown) => Test<R>
  readonly each: <T>(
    cases: ReadonlyArray<T>
  ) => <A, E>(
    name: string,
    self: (args: T) => Effect.Effect<A, E, R>,
    timeout?: number
  ) => void
  readonly failing: Test<R>
  /** Alias for `failing` (vitest compat). */
  readonly fails: Test<R>
  readonly prop: PropEffect<R>
}

/** Property-based test that returns an Effect. */
export interface PropEffect<R> {
  <const Arbs extends ReadonlyArray<fc.Arbitrary<any>>>(
    name: string,
    arbitraries: Arbs,
    self: (
      ...args: { [K in keyof Arbs]: Arbs[K] extends fc.Arbitrary<infer T> ? T : never }
    ) => Effect.Effect<any, any, R>,
    timeout?: number | { readonly fastCheck?: fc.Parameters<any> }
  ): void
}

/** Property-based test that returns void / Promise<void>. */
export interface Prop {
  <const Arbs extends ReadonlyArray<fc.Arbitrary<any>>>(
    name: string,
    arbitraries: Arbs,
    self: (
      ...args: { [K in keyof Arbs]: Arbs[K] extends fc.Arbitrary<infer T> ? T : never }
    ) => void | Promise<void>,
    timeout?: number | { readonly fastCheck?: fc.Parameters<any> }
  ): void
}

export type TestServices = never

/** Full method set exposed on `it` and returned from `makeMethods`. */
export interface Methods {
  readonly effect: Tester<never>
  readonly scoped: Tester<Scope.Scope>
  readonly live: Tester<never>
  readonly scopedLive: Tester<Scope.Scope>
  readonly flakyTest: typeof flakyTest
  readonly layer: typeof layer
  readonly prop: Prop
}

/** Method set available inside a `layer()` callback. */
export interface MethodsNonLive<R, ExcludeTestServices extends boolean = false> {
  readonly effect: Tester<R>
  readonly scoped: Tester<R | Scope.Scope>
  readonly flakyTest: typeof flakyTest
  readonly layer: <R2, E2>(
    layer_: Layer.Layer<R2, E2>,
    options?: LayerOptions
  ) => LayerFn<R2, ExcludeTestServices>
  readonly prop: Prop
}

export interface LayerOptions {
  readonly memoMap?: Layer.MemoMap
  readonly timeout?: Duration.DurationInput
  readonly excludeTestServices?: boolean
}

export type LayerFn<R, ExcludeTestServices extends boolean = false> = {
  (f: (it: MethodsNonLive<R, ExcludeTestServices>) => void): void
  (name: string, f: (it: MethodsNonLive<R, ExcludeTestServices>) => void): void
}

// ---------------------------------------------------------------------------
// Test Environment
// ---------------------------------------------------------------------------

const TestEnv: Layer.Layer<any> = TestContext.TestContext.pipe(
  Layer.provide(Logger.remove(Logger.defaultLogger))
)

// ---------------------------------------------------------------------------
// runPromise  — Bun-adapted Effect runner (no signal, no onTestFinished)
// ---------------------------------------------------------------------------

const runPromise = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(effect)
    if (Exit.isSuccess(exit)) {
      return exit.value
    }
    if (Cause.isInterruptedOnly(exit.cause)) {
      throw new Error("All fibers interrupted without errors.")
    }
    const errors = Cause.prettyErrors(exit.cause)
    for (let i = 1; i < errors.length; i++) {
      yield* Effect.logError(errors[i])
    }
    throw errors[0]!
  }).pipe(Effect.runPromise)

// ---------------------------------------------------------------------------
// makeTester  — creates a Tester<R> that maps each test body through mapEffect
// ---------------------------------------------------------------------------

export const makeTester = <R>(
  mapEffect: (self: Effect.Effect<any, any, R>) => Effect.Effect<any, any, never>,
  testFn: typeof bunTest = bunTest
): Tester<R> => {
  const run = <A, E>(self: () => Effect.Effect<A, E, R>): Promise<void> =>
    runPromise(pipe(Effect.suspend(self), mapEffect, Effect.asVoid))

  const f: Test<R> = (name, self, timeout) =>
    testFn(name, () => run(self), timeout)

  const skip: Test<R> = (name, self, timeout) =>
    testFn.skip(name, () => run(self), timeout)

  const only: Test<R> = (name, self, timeout) =>
    testFn.only(name, () => run(self), timeout)

  const skipIf =
    (condition: unknown): Test<R> =>
    (name, self, timeout) =>
      testFn.skipIf(condition as boolean)(name, () => run(self), timeout)

  const ifCond =
    (condition: unknown): Test<R> =>
    (name, self, timeout) =>
      testFn.if(condition as boolean)(name, () => run(self), timeout)

  const each =
    <T>(cases: ReadonlyArray<T>) =>
    <A, E>(
      name: string,
      self: (args: T) => Effect.Effect<A, E, R>,
      timeout?: number
    ) =>
      testFn.each(cases as T[])(
        name,
        (args: T) =>
          runPromise(pipe(Effect.suspend(() => self(args)), mapEffect, Effect.asVoid)),
        timeout
      )

  const failing: Test<R> = (name, self, timeout) =>
    testFn.failing(name, () => run(self), timeout)

  const propFn: PropEffect<R> = (name, arbitraries, self, timeout) => {
    const fcOptions =
      typeof timeout === "object" ? timeout?.fastCheck : undefined
    const timeoutMs = typeof timeout === "number" ? timeout : undefined
    testFn(
      name,
      async () => {
        await fc.assert(
          fc.asyncProperty(
            ...(arbitraries as unknown as [fc.Arbitrary<any>]),
            (...args: any[]) =>
              runPromise(
                pipe(
                  Effect.suspend(() => (self as any)(...args)) as Effect.Effect<any, any, R>,
                  mapEffect,
                  Effect.asVoid
                )
              )
          ),
          fcOptions
        )
      },
      timeoutMs
    )
  }

  return Object.assign(f, {
    skip,
    only,
    skipIf,
    if: ifCond,
    runIf: ifCond,
    each,
    failing,
    fails: failing,
    prop: propFn
  }) as Tester<R>
}

// ---------------------------------------------------------------------------
// Preconfigured testers
// ---------------------------------------------------------------------------

/** Run effects with test services (TestClock, TestConsole, etc.). Not auto-scoped. */
export const effect: Tester<never> = makeTester((e) =>
  Effect.provide(e, TestEnv)
)

/** Run effects with test services, auto-scoped. */
export const scoped: Tester<Scope.Scope> = makeTester((e) =>
  e.pipe(Effect.scoped, Effect.provide(TestEnv))
)

/** Run effects live (no test services), not auto-scoped. */
export const live: Tester<never> = makeTester((e) => e as any)

/** Run effects live (no test services), auto-scoped. */
export const scopedLive: Tester<Scope.Scope> = makeTester((e) => Effect.scoped(e))

// ---------------------------------------------------------------------------
// flakyTest  — retry an effect up to 10 times within a timeout
// ---------------------------------------------------------------------------

export const flakyTest = <A, E, R>(
  self: Effect.Effect<A, E, R>,
  timeout: Duration.DurationInput = Duration.seconds(30)
): Effect.Effect<A, never, R> =>
  pipe(
    Effect.catchAllDefect(self, (defect) => Effect.fail(defect as any)),
    Effect.retry(
      pipe(
        Schedule.recurs(10),
        Schedule.compose(Schedule.elapsed),
        Schedule.whileOutput(Duration.lessThanOrEqualTo(timeout))
      )
    ),
    Effect.orDie
  ) as any

// ---------------------------------------------------------------------------
// prop  — non-Effect property-based test
// ---------------------------------------------------------------------------

export const prop: Prop = (name, arbitraries, self, timeout) => {
  const fcOptions =
    typeof timeout === "object" ? timeout?.fastCheck : undefined
  const timeoutMs = typeof timeout === "number" ? timeout : undefined
  bunTest(
    name,
    async () => {
      await fc.assert(
        fc.asyncProperty(
          ...(arbitraries as unknown as [fc.Arbitrary<any>]),
          (...args: any[]) => (self as any)(...args)
        ),
        fcOptions
      )
    },
    timeoutMs
  )
}

// ---------------------------------------------------------------------------
// layer  — shared Layer across tests with beforeAll/afterAll lifecycle
// ---------------------------------------------------------------------------

export const layer = <R, E, const ExcludeTestServices extends boolean = false>(
  layer_: Layer.Layer<R, E>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly timeout?: Duration.DurationInput
    readonly excludeTestServices?: ExcludeTestServices
  }
): LayerFn<R, ExcludeTestServices> => {

  return ((...args: any[]) => {
    const excludeTestServices = options?.excludeTestServices ?? false
    const withTestEnv: Layer.Layer<any, any> = excludeTestServices
      ? (layer_ as any)
      : Layer.provideMerge(layer_ as any, TestEnv as any)
    const memoMap = options?.memoMap ?? Effect.runSync(Layer.makeMemoMap)
    const scope = Effect.runSync(Scope.make())
    const timeout = options?.timeout
      ? Duration.toMillis(options.timeout)
      : undefined

    const runtimeEffect = pipe(
      Layer.toRuntimeWithMemoMap(withTestEnv, memoMap),
      Scope.extend(scope),
      Effect.orDie,
      Effect.cached,
      Effect.runSync
    )

    const effectTester = makeTester<any>(
      (e) =>
        Effect.flatMap(runtimeEffect, (runtime) =>
          Effect.provide(e, runtime)
        ) as any
    )

    const scopedTester = makeTester<any>(
      (e) =>
        Effect.flatMap(runtimeEffect, (runtime) =>
          e.pipe(Effect.scoped, Effect.provide(runtime))
        ) as any
    )

    const makeIt = (): MethodsNonLive<R, ExcludeTestServices> =>
      ({
        effect: effectTester,
        scoped: scopedTester,
        flakyTest,
        prop,
        layer: <R2, E2>(
          nestedLayer: Layer.Layer<R2, E2>,
          nestedOptions?: LayerOptions
        ) =>
          layer(
            Layer.provideMerge(nestedLayer as any, withTestEnv) as any,
            {
              ...nestedOptions,
              memoMap,
              excludeTestServices: true
            } as any
          )
      }) as any

    if (args.length === 1) {
      beforeAll(
        () => runPromise(Effect.asVoid(runtimeEffect)),
        timeout
      )
      afterAll(
        () => runPromise(Scope.close(scope, Exit.void)),
        timeout
      )
      return args[0](makeIt())
    }

    return describe(args[0] as string, () => {
      beforeAll(
        () => runPromise(Effect.asVoid(runtimeEffect)),
        timeout
      )
      afterAll(
        () => runPromise(Scope.close(scope, Exit.void)),
        timeout
      )
      return args[1](makeIt())
    })
  }) as any
}

// ---------------------------------------------------------------------------
// makeMethods  — compose the full `Methods` object
// ---------------------------------------------------------------------------

export const makeMethods = (): Methods => ({
  effect,
  scoped,
  live,
  scopedLive,
  flakyTest,
  layer,
  prop
})

// ---------------------------------------------------------------------------
// addEqualityTesters  — register Effect Equal-aware matchers via expect.extend
// ---------------------------------------------------------------------------

export const addEqualityTesters = (): void => {
  expect.extend({
    toEqualEffect(received: unknown, expected: unknown) {
      if (!Equal.isEqual(received) || !Equal.isEqual(expected)) {
        const pass = Object.is(received, expected)
        return {
          pass,
          message: () =>
            pass
              ? `Expected values to not be equal`
              : `Expected values to be equal`
        }
      }
      const pass = Equal.equals(received, expected)
      return {
        pass,
        message: () =>
          pass
            ? `Expected Effect values to not be equal (via Equal.equals)`
            : `Expected Effect values to be equal (via Equal.equals), but they differ`
      }
    }
  })
}
