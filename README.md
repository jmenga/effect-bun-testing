# effect-bun-testing

Effect test helpers for Bun's built-in test runner.

This library ports the [`@effect/vitest`](https://github.com/Effect-TS/effect/tree/main/packages/vitest) API to [`bun:test`](https://bun.sh/docs/cli/test), providing first-class support for running Effect programs in Bun's test runner — including test services (`TestClock`, `TestConsole`), scoping, property-based testing, and all standard test modifiers.

> For Effect v3, install `effect-bun-testing@v3`.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- [Effect](https://effect.website) v4 (`^4.0.0-beta.10`)

## Installation

```bash
bun add effect-bun-testing
```

## Overview

| API | Description |
|---|---|
| `it.effect` | Run an Effect test with test services (auto-scoped) |
| `it.live` | Run an Effect test without test services (auto-scoped) |
| `it.effect.skip` | Skip an Effect test |
| `it.effect.only` | Run only this Effect test |
| `it.effect.skipIf(cond)` | Skip when condition is truthy |
| `it.effect.if(cond)` | Run when condition is truthy |
| `it.effect.each(cases)` | Parameterized Effect tests |
| `it.effect.failing` | Test that is expected to fail |
| `it.effect.prop` | Property-based Effect test |
| `it.prop` | Property-based test (non-Effect) |
| `it.flakyTest` | Retry an Effect up to 10 times within a timeout |
| `layer(L)` | Share a Layer across tests with `beforeAll`/`afterAll` lifecycle |

## Writing Tests

### Basic Effect tests

Import `it` from `effect-bun-testing` as a drop-in replacement for `bun:test`'s `it`. All standard `bun:test` functionality is preserved, with Effect methods added.

```ts
import { describe, expect } from "bun:test"
import { it } from "effect-bun-testing"
import { Effect } from "effect"

describe("my tests", () => {
  it.effect("runs a basic Effect test", () =>
    Effect.gen(function*() {
      const result = yield* Effect.succeed(42)
      expect(result).toBe(42)
    })
  )
})
```

### Defining services

```ts
import { Effect, Layer, ServiceMap } from "effect"

interface Greeter {
  readonly greet: (name: string) => Effect.Effect<string>
}
const Greeter = ServiceMap.Service<Greeter>("app/Greeter")
```

### Providing layers per-test

The standard pattern is to pipe layers directly to individual tests using `Effect.provide`. Each test gets a fresh layer instance.

```ts
const GreeterLive = Layer.succeed(Greeter)({
  greet: (name) => Effect.succeed(`Hello, ${name}!`)
})

describe("greeter", () => {
  it.effect("greets by name", () =>
    Effect.gen(function*() {
      const greeter = yield* Greeter
      const msg = yield* greeter.greet("World")
      expect(msg).toBe("Hello, World!")
    }).pipe(Effect.provide(GreeterLive))
  )
})
```

You can compose multiple layers for a single test:

```ts
it.effect("uses multiple services", () =>
  Effect.gen(function*() {
    const counter = yield* Counter
    const logger = yield* Logger
    yield* counter.increment
    const count = yield* counter.get
    yield* logger.log(`count is ${count}`)
    const msgs = yield* logger.messages
    expect(msgs).toHaveLength(1)
  }).pipe(Effect.provide(Layer.mergeAll(CounterLive, LoggerLive)))
)
```

### TestClock

`it.effect` provides `TestClock` automatically. Use `TestClock.adjust` to advance time without waiting.

```ts
import { TestClock } from "effect/testing"

it.effect("advances time via TestClock", () =>
  Effect.gen(function*() {
    const before = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
    yield* TestClock.adjust("1 second")
    const after = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
    expect(after - before).toBe(1000)
  })
)
```

### Scoped tests

`it.effect` and `it.live` auto-scope in Effect v4, so no special handling is needed for `Effect.addFinalizer` or other scoped resources:

```ts
it.effect("auto-scopes resources", () =>
  Effect.gen(function*() {
    const ref = yield* Ref.make(0)
    yield* Effect.addFinalizer(() => Ref.set(ref, 99))
    const before = yield* Ref.get(ref)
    expect(before).toBe(0)
    // finalizer runs automatically after this test
  })
)
```

### Handling failures

```ts
it.effect("handles failures", () =>
  Effect.gen(function*() {
    const result = yield* Effect.fail("boom").pipe(
      Effect.catch(() => Effect.succeed("recovered"))
    )
    expect(result).toBe("recovered")
  })
)
```

### Live tests

`it.live` runs effects without test services (`TestClock`, `TestConsole`), using the real runtime:

```ts
it.live("uses real clock", () =>
  Effect.gen(function*() {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
    expect(now).toBeGreaterThan(0)
  })
)
```

### Modifiers

All standard `bun:test` modifiers are available on `it.effect`:

```ts
// Skip a test
it.effect.skip("not ready yet", () => ...)

// Run only this test
it.effect.only("focus on this", () => ...)

// Conditional skip
it.effect.skipIf(process.env.CI)("skip in CI", () => ...)

// Conditional run
it.effect.if(process.env.CI)("only in CI", () => ...)

// Alias for .if (vitest compat)
it.effect.runIf(someCondition)("conditional", () => ...)

// Expected failure
it.effect.failing("known bug", () =>
  Effect.gen(function*() {
    yield* Effect.fail("not implemented")
  })
)

// Alias for .failing (vitest compat)
it.effect.fails("also known bug", () => ...)
```

### Parameterized tests

Use `it.effect.each` to run the same test with different inputs:

```ts
it.effect.each([1, 2, 3])("doubles %d", (n) =>
  Effect.gen(function*() {
    const result = yield* Effect.succeed(n * 2)
    expect(result).toBe(n * 2)
  })
)
```

### Flaky tests

`flakyTest` retries an Effect up to 10 times within a timeout (default 30 seconds):

```ts
import { it } from "effect-bun-testing"
import { Effect, Duration } from "effect"

it.effect("retries flaky operations", () =>
  it.flakyTest(
    Effect.gen(function*() {
      const n = Math.random()
      if (n < 0.8) yield* Effect.fail("unlucky")
      expect(n).toBeGreaterThanOrEqual(0.8)
    }),
    Duration.seconds(5)
  )
)
```

## Property-Based Testing

Property-based testing is supported via [fast-check](https://github.com/dubzzz/fast-check).

### Non-Effect properties

```ts
import * as fc from "fast-check"

it.prop(
  "arrays always have non-negative length",
  [fc.array(fc.string())],
  (arr) => {
    expect(arr.length).toBeGreaterThanOrEqual(0)
  }
)

it.prop(
  "multiple arbitraries",
  [fc.string(), fc.integer({ min: 0, max: 100 })],
  (str, num) => {
    expect(typeof str).toBe("string")
    expect(num).toBeGreaterThanOrEqual(0)
  }
)
```

### Effect properties

```ts
it.effect.prop(
  "positive numbers remain positive after increment",
  [fc.integer({ min: 1, max: 1000 })],
  (n) =>
    Effect.gen(function*() {
      const result = yield* Effect.succeed(n + 1)
      expect(result).toBeGreaterThan(n)
    })
)
```

## Shared Layer Lifecycle

For expensive resources (database connections, server instances) or tests that intentionally share state, use `layer()` to build a layer once in `beforeAll` and tear it down in `afterAll`:

```ts
import { describe, expect } from "bun:test"
import { it, layer } from "effect-bun-testing"
import { Effect, Layer, ServiceMap } from "effect"

interface Counter {
  readonly get: Effect.Effect<number>
  readonly increment: Effect.Effect<void>
}
const Counter = ServiceMap.Service<Counter>("app/Counter")

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

describe("shared counter", () => {
  layer(CounterLive)("shared lifecycle", (it) => {
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
        expect(count).toBeGreaterThanOrEqual(1)
      })
    )
  })
})
```

> **Note:** For most tests, prefer the per-test `Effect.provide(layer)` pattern. It gives each test a fresh layer instance, which avoids shared-state coupling. Use `layer()` only when you need the layer to be built once and shared.

## Mocking Effect Services

Effect services are interfaces resolved from the environment, which makes them straightforward to mock using Bun's built-in `mock()`. The pattern uses three steps:

1. Create dynamically typed mocks with `mock()`
2. Wire them into test layers with `Layer.mock` (partial implementation — only mock what you need)
3. Set default implementations in `beforeEach`

### Full example

```ts
import { beforeEach, describe, expect, mock } from "bun:test"
import { it } from "effect-bun-testing"
import { Effect, Layer, ServiceMap } from "effect"

interface UserRepository {
  readonly findById: (id: string) => Effect.Effect<{ id: string; name: string } | null>
}
const UserRepository = ServiceMap.Service<UserRepository>("app/UserRepository")

interface NotificationService {
  readonly send: (userId: string, message: string) => Effect.Effect<void>
  readonly test: () => Effect.Effect<void>
}
const NotificationService = ServiceMap.Service<NotificationService>("app/NotificationService")

// Business logic under test
const notifyUser = (userId: string, message: string) =>
  Effect.gen(function*() {
    const repo = yield* UserRepository
    const notifications = yield* NotificationService
    const user = yield* repo.findById(userId)
    if (!user) {
      return yield* Effect.fail(new Error(`User ${userId} not found`))
    }
    yield* notifications.send(userId, `${user.name}: ${message}`)
    return { sent: true, to: user.name }
  })

// 1. Create dynamically typed mocks
const mockFindById = mock()
const mockSend = mock()

// 2. Wire mocks into test layers using Layer.mock
// Layer.mock accepts a partial implementation — only mock the methods you need.
const TestUserRepository = Layer.mock(UserRepository)({
  findById: mockFindById
})

// NotificationService has both `send` and `test`, but we only need `send`
const TestNotificationService = Layer.mock(NotificationService)({
  send: mockSend
})

const TestLayer = Layer.mergeAll(TestUserRepository, TestNotificationService)

// 3. Set defaults in beforeEach, provide layer per-test
describe("notifyUser", () => {
  beforeEach(() => {
    mockFindById.mockClear()
    mockSend.mockClear()

    mockFindById.mockImplementation((id: string) =>
      Effect.succeed(id === "user-1" ? { id: "user-1", name: "Alice" } : null)
    )
    mockSend.mockReturnValue(Effect.void)
  })

  it.effect("sends notification to existing user", () =>
    Effect.gen(function*() {
      const result = yield* notifyUser("user-1", "hello!")
      expect(result).toEqual({ sent: true, to: "Alice" })
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith("user-1", "Alice: hello!")
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("can override mock per-test", () =>
    Effect.gen(function*() {
      mockFindById.mockReturnValue(
        Effect.succeed({ id: "user-42", name: "Bob" })
      )
      const result = yield* notifyUser("user-42", "hey!")
      expect(result).toEqual({ sent: true, to: "Bob" })
      expect(mockSend).toHaveBeenCalledWith("user-42", "Bob: hey!")
    }).pipe(Effect.provide(TestLayer))
  )
})
```

### Key points

- **Use `Layer.mock` (not `Layer.succeed`)** — `Layer.mock` accepts a partial implementation, so you only mock the methods your test actually exercises. `Layer.succeed` requires the full service interface.
- **Use `mock()` (not `mock<T>()`)** — dynamically typed mocks avoid wrestling with generics and work naturally with `Layer.mock`.
- **`mockImplementation`** for methods that take arguments and return an `Effect` with a value based on those arguments.
- **`mockReturnValue(Effect.void)`** for side-effect methods that always return the same thing.
- **`mockReturnValue(Effect.succeed(value))`** for methods that return a fixed value (useful for per-test overrides).
- **`mockClear()` in `beforeEach`** resets call counts and implementations, so each test starts clean.
- **Per-test overrides** simply call `mockReturnValue` or `mockImplementation` again before running the effect — `beforeEach` resets it for the next test automatically.

## Assertion Utilities

A set of assertion helpers is available at `effect-bun-testing/utils`, ported from `@effect/vitest/utils`:

```ts
import {
  assertEquals,       // Compare via Effect's Equal.equals
  assertTrue,         // Truthy assertion
  assertFalse,        // Falsy assertion
  assertNone,         // Option is None
  assertSome,         // Option is Some with expected value
  assertSuccess_,     // Result is Success with expected value
  assertFailure_,     // Result is Failure with expected value
  assertRight,        // Alias for assertSuccess_ (vitest compat)
  assertExitSuccess,  // Exit is Success with expected value
  assertExitFailure,  // Exit is Failure with expected Cause
  deepStrictEqual,    // Structural equality (toStrictEqual)
  strictEqual,        // Reference equality (toBe)
  assertInstanceOf,   // instanceof check
  assertInclude,      // String contains substring
  assertMatch,        // String matches regex
  throws,             // Function throws
  throwsAsync,        // Async function throws
  fail                // Always throws (unconditional failure)
} from "effect-bun-testing/utils"
```

## API Mapping from @effect/vitest

| @effect/vitest | effect-bun-testing | Notes |
|---|---|---|
| `it.effect(name, (ctx) => ...)` | `it.effect(name, () => ...)` | No TestContext param (Bun has none) |
| `it.live(name, (ctx) => ...)` | `it.live(name, () => ...)` | Same |
| `it.effect.fails` | `it.effect.failing` | Bun's name; `fails` alias also available |
| `it.effect.runIf(cond)` | `it.effect.if(cond)` | Bun's name; `runIf` alias also available |
| `it.effect.skip/only/skipIf/each` | `it.effect.skip/only/skipIf/each` | Direct mapping |
| `it.effect.prop` | `it.effect.prop` | Same API |
| `it.prop` | `it.prop` | Same API |
| `layer(L)(name, fn)` | `layer(L)(name, fn)` | Same API |
| `flakyTest(effect, timeout)` | `flakyTest(effect, timeout)` | Same API |

## License

MIT
