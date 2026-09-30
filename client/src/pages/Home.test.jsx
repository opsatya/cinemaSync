import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateMock }
})

import Home from './Home'

describe('Home room code join', () => {
  it('normalizes a lowercase room code to uppercase before navigating', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await user.type(screen.getByPlaceholderText(/enter room code/i), 'abc123ef')
    await user.click(screen.getByRole('button', { name: /join room/i }))

    expect(navigateMock).toHaveBeenCalledWith('/theater/ABC123EF')
  })
})
