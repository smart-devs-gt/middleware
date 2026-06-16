import { describe, it, expect } from '@jest/globals'
import { AsyncLocalStorage } from 'async_hooks'
import {
  runWithLogContext,
  getLogContext,
  logContextFromAuth,
  logContextMiddleware,
} from '../log-context'

describe('log-context (middleware)', () => {
  it('runWithLogContext exposes the context inside the scope', () => {
    runWithLogContext({ ownerId: 'tenant-1' }, () => {
      expect(getLogContext()?.ownerId).toBe('tenant-1')
    })
    expect(getLogContext()).toBeUndefined()
  })

  it('logContextFromAuth only includes present fields', () => {
    expect(logContextFromAuth({ ownerId: 'o1', userId: '', enterpriseId: 'e1' })).toEqual({
      ownerId: 'o1',
      enterpriseId: 'e1',
    })
  })

  it('shares the same ALS instance with logwise via the global symbol', () => {
    const fromGlobal = (globalThis as any)[Symbol.for('@smdv/log-context')]
    expect(fromGlobal).toBeInstanceOf(AsyncLocalStorage)
  })

  describe('logContextMiddleware', () => {
    it('opens context from gateway headers and calls next once', () => {
      const mw = logContextMiddleware()
      let seen: string | undefined
      let nextCalls = 0
      mw(
        { headers: { 'owner-id': 'tenant-9', 'user-id': 'u1' } },
        {},
        () => {
          nextCalls++
          seen = getLogContext()?.ownerId as string
        },
      )
      expect(nextCalls).toBe(1)
      expect(seen).toBe('tenant-9')
    })

    it('passes through (no context) when owner-id is absent', () => {
      const mw = logContextMiddleware()
      let nextCalls = 0
      let seen: unknown = 'sentinel'
      mw({ headers: {} }, {}, () => {
        nextCalls++
        seen = getLogContext()
      })
      expect(nextCalls).toBe(1)
      expect(seen).toBeUndefined()
    })
  })
})
