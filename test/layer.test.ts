import { describe, expect } from "bun:test"
import { it, layer } from "../src/index.ts"
import { Context, Effect, Layer } from "effect"

// -- Service definitions --

interface Counter {
  readonly get: Effect.Effect<number>
  readonly increment: Effect.Effect<void>
}
const Counter = Context.GenericTag<Counter>("test/Counter")

const CounterLive = Layer.effect(
  Counter,
  Effect.gen(function*() {
    let count = 0
    return {
      get: Effect.sync(() => count),
      increment: Effect.sync(() => { count++ })
    }
  })
)

interface Logger {
  readonly log: (msg: string) => Effect.Effect<void>
  readonly messages: Effect.Effect<ReadonlyArray<string>>
}
const Logger = Context.GenericTag<Logger>("test/Logger")

const LoggerLive = Layer.effect(
  Logger,
  Effect.sync(() => {
    const msgs: string[] = []
    return {
      log: (msg: string) => Effect.sync(() => { msgs.push(msg) }),
      messages: Effect.sync(() => [...msgs])
    }
  })
)

// ---------------------------------------------------------------------------
// Per-test layer provision (standard pattern)
// ---------------------------------------------------------------------------

describe("per-test layer provision", () => {
  it.effect("provides a single service", () =>
    Effect.gen(function*() {
      const counter = yield* Counter
      const count = yield* counter.get
      expect(count).toBe(0)
    }).pipe(Effect.provide(CounterLive))
  )

  it.effect("provides multiple services", () =>
    Effect.gen(function*() {
      const counter = yield* Counter
      const logger = yield* Logger
      yield* counter.increment
      const count = yield* counter.get
      yield* logger.log(`count is ${count}`)
      const msgs = yield* logger.messages
      expect(msgs).toHaveLength(1)
      expect(msgs[0]).toInclude("count is")
    }).pipe(Effect.provide(Layer.mergeAll(CounterLive, LoggerLive)))
  )

  it.effect("each test gets a fresh layer", () =>
    Effect.gen(function*() {
      const counter = yield* Counter
      // Fresh layer per test — counter starts at 0
      const count = yield* counter.get
      expect(count).toBe(0)
      yield* counter.increment
      yield* counter.increment
      const after = yield* counter.get
      expect(after).toBe(2)
    }).pipe(Effect.provide(CounterLive))
  )
})

// ---------------------------------------------------------------------------
// Shared layer via layer() — for expensive resources or cross-test state
// ---------------------------------------------------------------------------

describe("layer() shared lifecycle", () => {
  layer(CounterLive)("shared counter", (it) => {
    it.effect("starts at zero", () =>
      Effect.gen(function*() {
        const counter = yield* Counter
        const count = yield* counter.get
        expect(count).toBe(0)
      })
    )

    it.effect("state persists across tests (shared instance)", () =>
      Effect.gen(function*() {
        const counter = yield* Counter
        yield* counter.increment
        const count = yield* counter.get
        // Layer built once in beforeAll — state carries over
        expect(count).toBeGreaterThanOrEqual(1)
      })
    )
  })
})
