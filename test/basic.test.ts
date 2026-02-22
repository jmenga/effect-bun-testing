import { describe, expect } from "bun:test"
import { it } from "../src/index.ts"
import { Effect, Layer, Ref, ServiceMap } from "effect"
import { TestClock } from "effect/testing"

describe("it.effect", () => {
  it.effect("runs a basic Effect test", () =>
    Effect.gen(function*() {
      const result = yield* Effect.succeed(42)
      expect(result).toBe(42)
    })
  )

  it.effect("can use generators with multiple yields", () =>
    Effect.gen(function*() {
      const a = yield* Effect.succeed(10)
      const b = yield* Effect.succeed(20)
      expect(a + b).toBe(30)
    })
  )

  it.effect("auto-scopes (no explicit Scope needed)", () =>
    Effect.gen(function*() {
      const ref = yield* Ref.make(0)
      yield* Effect.addFinalizer(() => Ref.set(ref, 99))
      const before = yield* Ref.get(ref)
      expect(before).toBe(0)
    })
  )

  it.effect("provides TestClock", () =>
    Effect.gen(function*() {
      const before = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      yield* TestClock.adjust("1 second")
      const after = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      expect(after - before).toBe(1000)
    })
  )

  it.effect("handles failures correctly", () =>
    Effect.gen(function*() {
      const result = yield* Effect.fail("boom").pipe(
        Effect.catch(() => Effect.succeed("recovered"))
      )
      expect(result).toBe("recovered")
    })
  )
})

// ---------------------------------------------------------------------------
// Providing layers per-test (the standard pattern)
// ---------------------------------------------------------------------------

interface Greeter {
  readonly greet: (name: string) => Effect.Effect<string>
}
const Greeter = ServiceMap.Service<Greeter>("test/Greeter")

const GreeterLive = Layer.succeed(Greeter)({
  greet: (name) => Effect.succeed(`Hello, ${name}!`)
})

describe("per-test layer provision", () => {
  it.effect("pipe a layer to an individual test", () =>
    Effect.gen(function*() {
      const greeter = yield* Greeter
      const msg = yield* greeter.greet("World")
      expect(msg).toBe("Hello, World!")
    }).pipe(Effect.provide(GreeterLive))
  )

  it.effect("compose multiple layers per-test", () =>
    Effect.gen(function*() {
      const greeter = yield* Greeter
      const msg = yield* greeter.greet("Effect")
      expect(msg).toInclude("Effect")
    }).pipe(Effect.provide(GreeterLive))
  )
})

describe("it.live", () => {
  it.live("runs without test services", () =>
    Effect.gen(function*() {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      expect(now).toBeGreaterThan(0)
    })
  )

  it.live("auto-scopes resources", () =>
    Effect.gen(function*() {
      const ref = yield* Ref.make("alive")
      yield* Effect.addFinalizer(() => Ref.set(ref, "finalized"))
      const value = yield* Ref.get(ref)
      expect(value).toBe("alive")
    })
  )
})
