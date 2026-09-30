import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MovieBrowser from './MovieBrowser'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ backendToken: 'fake-token' }),
}))

vi.mock('../../utils/api', () => ({
  fetchMoviesList: vi.fn(),
  searchMovies: vi.fn(),
  getRecentMovies: vi.fn(),
  getStreamLink: vi.fn(),
  getGoogleHealth: vi.fn(),
  getGoogleTokensStatus: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  fetchDriveVideos: vi.fn(),
}))

import {
  getGoogleHealth,
  getGoogleTokensStatus,
  fetchDriveVideos,
  getRecentMovies,
} from '../../utils/api'

beforeEach(() => {
  getGoogleHealth.mockResolvedValue({ env_ok: true })
  getGoogleTokensStatus.mockResolvedValue(true)
  fetchDriveVideos.mockResolvedValue([
    { id: 'D1', name: 'Inception', mimeType: 'video/mp4', size: '1000' },
  ])
  getRecentMovies.mockResolvedValue([])
})

describe('MovieBrowser mode-aware action', () => {
  it('labels the per-movie action "Play in theater" when changing the current movie', async () => {
    render(
      <MemoryRouter>
        <MovieBrowser onSelectMovie={() => {}} roomId="ROOM1" mode="change" />
      </MemoryRouter>
    )

    expect(await screen.findByText('Inception')).toBeInTheDocument()
    expect(screen.getByLabelText('Play in theater')).toBeInTheDocument()
  })

  it('labels the per-movie action "Add to Playlist" when queuing a video', async () => {
    render(
      <MemoryRouter>
        <MovieBrowser onSelectMovie={() => {}} roomId="ROOM1" mode="addToPlaylist" />
      </MemoryRouter>
    )

    expect(await screen.findByText('Inception')).toBeInTheDocument()
    expect(screen.getByLabelText('Add to Playlist')).toBeInTheDocument()
  })
})
