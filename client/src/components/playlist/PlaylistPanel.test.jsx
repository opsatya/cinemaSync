import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlaylistPanel from './PlaylistPanel'

const ITEMS = [
  { item_id: 'a1', type: 'google_drive', video_id: 'DRIVE1', video_name: 'Movie A' },
  { item_id: 'a2', type: 'direct_link', value: 'http://example.com/b.mp4' },
]

describe('PlaylistPanel', () => {
  it('lets the host play or remove a queued item', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    const onRemove = vi.fn()
    render(
      <PlaylistPanel playlist={ITEMS} isHost onAdd={() => {}} onPlay={onPlay} onRemove={onRemove} />
    )

    expect(screen.getByText('Movie A')).toBeInTheDocument()

    const playButtons = screen.getAllByRole('button', { name: /play/i })
    await user.click(playButtons[0])
    expect(onPlay).toHaveBeenCalledWith('a1')

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    await user.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('a1')
  })

  it('hides host-only controls for non-hosts', () => {
    render(
      <PlaylistPanel playlist={ITEMS} isHost={false} onAdd={() => {}} onPlay={() => {}} onRemove={() => {}} />
    )

    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/add from google drive/i)).not.toBeInTheDocument()
  })

  it('exposes the add-from-drive affordance as a keyboard-accessible button and calls onAdd', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(
      <PlaylistPanel playlist={[]} isHost onAdd={onAdd} onPlay={() => {}} onRemove={() => {}} />
    )

    const addButton = screen.getByRole('button', { name: /add from google drive/i })
    await user.click(addButton)
    expect(onAdd).toHaveBeenCalled()
  })
})
