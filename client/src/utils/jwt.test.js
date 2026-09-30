import { describe, it, expect } from 'vitest'
import { isJwtExpired } from './jwt'

const makeToken = (payload) => {
  const base64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.fakesignature`
}

describe('isJwtExpired', () => {
  it('returns true for a null/empty token', () => {
    expect(isJwtExpired(null)).toBe(true)
    expect(isJwtExpired('')).toBe(true)
  })

  it('returns true for an unparseable token', () => {
    expect(isJwtExpired('not-a-jwt')).toBe(true)
  })

  it('returns false for a token whose exp is well in the future', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isJwtExpired(token)).toBe(false)
  })

  it('returns true for a token whose exp is in the past', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 })
    expect(isJwtExpired(token)).toBe(true)
  })

  it('treats a token expiring within the buffer window as expired', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 10 })
    expect(isJwtExpired(token, 30)).toBe(true)
  })

  it('returns false for a token with no exp claim at all', () => {
    const token = makeToken({ user_id: 'u1' })
    expect(isJwtExpired(token)).toBe(false)
  })
})
