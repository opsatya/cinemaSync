import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatPanel from './ChatPanel'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'user-1', displayName: 'Tester' } }),
}))

describe('ChatPanel', () => {
  it('renders a non-system chat message without crashing', () => {
    const messages = [
      { id: '1', user_id: 'user-2', text: 'Hello there', timestamp: Date.now() },
    ]

    render(
      <ChatPanel
        users={[{ user_id: 'user-2', name: 'Alice' }]}
        roomId="ROOM1"
        messages={messages}
        setMessages={() => {}}
      />
    )

    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })
})
