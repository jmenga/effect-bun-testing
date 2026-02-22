import { beforeEach, describe, expect, mock } from "bun:test"
import { it } from "../src/index.ts"
import { Context, Effect, Layer } from "effect"

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

interface UserRepository {
  readonly findById: (id: string) => Effect.Effect<{ id: string; name: string } | null>
}
const UserRepository = Context.GenericTag<UserRepository>("test/UserRepository")

interface NotificationService {
  readonly send: (userId: string, message: string) => Effect.Effect<void>
  readonly test: () => Effect.Effect<void>
}
const NotificationService = Context.GenericTag<NotificationService>("test/NotificationService")

// Business logic that depends on both services
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

// ---------------------------------------------------------------------------
// Dynamically typed mocks
// ---------------------------------------------------------------------------

const mockFindById = mock()
const mockSend = mock()

const TestUserRepository = Layer.mock(UserRepository)({
  findById: mockFindById
})

const TestNotificationService = Layer.mock(NotificationService)({
  send: mockSend,
})

const TestLayer = Layer.mergeAll(TestUserRepository, TestNotificationService)

// ---------------------------------------------------------------------------
// Tests — layer provided per-test
// ---------------------------------------------------------------------------

describe("mock example", () => {
  beforeEach(() => {
    mockFindById.mockClear()
    mockSend.mockClear()

    // Default implementations: Effect.succeed for values, Effect.void for side effects
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

  it.effect("fails for non-existent user", () =>
    Effect.gen(function*() {
      const result = yield* notifyUser("user-999", "hi").pipe(
        Effect.catchAll((e) => Effect.succeed({ error: (e as Error).message }))
      )
      expect(result).toEqual({ error: "User user-999 not found" })
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect("can override mock per-test", () =>
    Effect.gen(function*() {
      // Override findById for this test only
      mockFindById.mockReturnValue(
        Effect.succeed({ id: "user-42", name: "Bob" })
      )
      const result = yield* notifyUser("user-42", "hey!")
      expect(result).toEqual({ sent: true, to: "Bob" })
      expect(mockSend).toHaveBeenCalledWith("user-42", "Bob: hey!")
    }).pipe(Effect.provide(TestLayer))
  )
})
