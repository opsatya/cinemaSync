import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import UserList from './UserList'

const PARTICIPANTS = [
  { user_id: 'host-123456', is_host: true, joined_at: '2026-01-01T00:00:00Z' },
  { user_id: 'viewer-789012', is_host: false, joined_at: '2026-01-01T00:05:00Z' },
]

describe('UserList', () => {
  it('renders real participant data instead of undefined fields', () => {
    render(<UserList users={PARTICIPANTS} currentUserId="viewer-789012" />)

    // "You" for the current user, a host badge for the host, no undefined/blank names
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})
