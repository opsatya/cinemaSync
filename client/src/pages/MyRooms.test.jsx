import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MyRooms from './MyRooms'
import { updateRoom } from '../utils/api'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ backendToken: 'fake-token' }),
}))

vi.mock('../utils/api', () => ({
  fetchMyRooms: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

import { fetchMyRooms, deleteRoom } from '../utils/api'

const PRIVATE_ROOM = {
  room_id: 'ROOM1',
  name: 'Test Room',
  description: '',
  is_private: true,
  password_required: true,
  enable_chat: true,
  enable_reactions: true,
  participants: [],
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  fetchMyRooms.mockResolvedValue([PRIVATE_ROOM])
  updateRoom.mockResolvedValue({ ...PRIVATE_ROOM, name: 'Test Room Renamed' })
})

describe('MyRooms edit dialog', () => {
  it('does not clear an existing password when the password field is left blank', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MyRooms />
      </MemoryRouter>
    )

    await screen.findByText('Test Room')
    await user.click(screen.getByLabelText(/edit room/i))

    const nameField = await screen.findByLabelText(/room name/i)
    await user.clear(nameField)
    await user.type(nameField, 'Test Room Renamed')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(updateRoom).toHaveBeenCalled())
    const payload = updateRoom.mock.calls[0][1]
    expect(payload).not.toHaveProperty('password')
  })
})

describe('MyRooms delete confirmation', () => {
  it('accurately describes deactivation instead of implying permanent deletion', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    deleteRoom.mockResolvedValue(true)

    render(
      <MemoryRouter>
        <MyRooms />
      </MemoryRouter>
    )

    await screen.findByText('Test Room')
    await user.click(screen.getByLabelText(/delete room/i))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    const message = confirmSpy.mock.calls[0][0].toLowerCase()
    expect(message).toContain('deactivat')
    expect(message).not.toContain('permanently delete')

    confirmSpy.mockRestore()
  })
})
