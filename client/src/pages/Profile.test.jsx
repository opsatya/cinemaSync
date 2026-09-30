import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'
import { fetchMyRooms } from '../utils/api'

// A stable currentUser object reference matters: Profile.jsx's useEffect
// depends on [currentUser], and Firebase's real currentUser is referentially
// stable across renders. A mock that returns a fresh object every call
// would trip that dependency on every render and infinite-loop.
const STABLE_CURRENT_USER = { uid: 'user-1', displayName: 'Test User', email: 'test@example.com', photoURL: null }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: STABLE_CURRENT_USER,
    backendToken: 'fake-token',
    logout: vi.fn(),
  }),
}))

vi.mock('../utils/api', () => ({
  fetchMyRooms: vi.fn(),
}))

const ROOMS = [
  {
    room_id: 'R1',
    name: 'Friday Night',
    host_id: 'user-1',
    participants: [{ user_id: 'user-1' }],
    movie_source: { type: 'google_drive', video_id: 'D1', video_name: 'Inception' },
    updated_at: '2026-01-05T00:00:00Z',
  },
  {
    room_id: 'R2',
    name: 'Sci-Fi Marathon',
    host_id: 'someone-else',
    participants: [{ user_id: 'user-1' }, { user_id: 'someone-else' }],
    movie_source: { type: 'direct_link', value: 'http://example.com/y.mp4' },
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    room_id: 'R3',
    name: 'No Movie Yet',
    host_id: 'user-1',
    participants: [{ user_id: 'user-1' }],
    movie_source: null,
    updated_at: '2025-12-01T00:00:00Z',
  },
]

beforeEach(() => {
  fetchMyRooms.mockReset()
})

describe('Profile real data', () => {
  it('computes rooms-created and movies-watched counts from real room data', async () => {
    fetchMyRooms.mockResolvedValue(ROOMS)
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    expect(await screen.findByTestId('stat-rooms-created')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-movies-watched')).toHaveTextContent('2')
  })

  it('shows real recent rooms instead of the hardcoded mock list', async () => {
    fetchMyRooms.mockResolvedValue(ROOMS)
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    expect(await screen.findByText('Friday Night')).toBeInTheDocument()
    expect(screen.getByText('Sci-Fi Marathon')).toBeInTheDocument()
    expect(screen.queryByText('Friday Movie Night')).not.toBeInTheDocument()
  })

  it('replaces the invented favorite-movies tab with real recently-watched movies', async () => {
    const user = userEvent.setup()
    fetchMyRooms.mockResolvedValue(ROOMS)
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await screen.findByText('Friday Night')
    await user.click(screen.getByRole('tab', { name: /recently watched/i }))

    expect(await screen.findByText('Inception')).toBeInTheDocument()
    expect(screen.queryByText('The Matrix')).not.toBeInTheDocument()
  })

  it('shows an error state without crashing if fetching rooms fails', async () => {
    fetchMyRooms.mockRejectedValue(new Error('network down'))
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
  })

  it('does not nest a Chip (div) inside a paragraph — valid DOM nesting', async () => {
    fetchMyRooms.mockResolvedValue(ROOMS)
    const { container } = render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    )

    await screen.findByText('Friday Night')

    const paragraphsContainingDivs = Array.from(container.querySelectorAll('p')).filter(
      (p) => p.querySelector('div') !== null
    )
    expect(paragraphsContainingDivs).toHaveLength(0)
  })
})
