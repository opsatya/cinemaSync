import { describe, it, expect } from 'vitest'
import { isDirectLinkType, isGoogleDriveType } from './movieSource'

describe('isDirectLinkType', () => {
  it('matches the camelCase form used by CreateRoom.jsx', () => {
    expect(isDirectLinkType('directLink')).toBe(true)
  })

  it('matches the snake_case form used by the playlist backend', () => {
    expect(isDirectLinkType('direct_link')).toBe(true)
  })

  it('does not match an unrelated type', () => {
    expect(isDirectLinkType('google_drive')).toBe(false)
    expect(isDirectLinkType(undefined)).toBe(false)
  })
})

describe('isGoogleDriveType', () => {
  it('matches both the snake_case and camelCase forms', () => {
    expect(isGoogleDriveType('google_drive')).toBe(true)
    expect(isGoogleDriveType('googleDrive')).toBe(true)
  })

  it('does not match an unrelated type', () => {
    expect(isGoogleDriveType('direct_link')).toBe(false)
  })
})
