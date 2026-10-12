import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import type { Dish } from './types/dish'

const sampleDishes: Dish[] = [
  {
    dishId: '1',
    dishName: 'Jeera Rice',
    imageUrl: 'https://example.com/jeera.jpg',
    isPublished: true,
    version: 1,
  },
  {
    dishId: '2',
    dishName: 'Paneer Tikka',
    imageUrl: 'https://example.com/paneer.jpg',
    isPublished: false,
    version: 1,
  },
]

describe('DishDashboard App (Phase 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    // Hang fetch so loading state is visible
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {})
    )

    render(<App />)
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
    expect(screen.getByText('Loading Menu Dishes')).toBeInTheDocument()
  })

  it('renders dishes and their details after successful fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dishes: sampleDishes, total: 2 }),
    } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Paneer Tikka')).toBeInTheDocument()
    expect(screen.getByText('ID: 1')).toBeInTheDocument()
    expect(screen.getByText('ID: 2')).toBeInTheDocument()
    expect(screen.getAllByText('v1')).toHaveLength(2)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Total:')).toBeInTheDocument()
  })

  it('shows fallback when a dish image fails to load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dishes: sampleDishes, total: 2 }),
    } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const images = screen.getAllByRole('img', { hidden: true })
    // Simulate image error on first image
    fireEvent.error(images[0])

    await waitFor(() => {
      expect(screen.getByText('Image Unavailable')).toBeInTheDocument()
    })
  })

  it('editing a draft updates only local state without calling backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dishes: sampleDishes, total: 2 }),
    } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'Spiced Jeera Rice' } })

    // Input changes locally
    expect(nameInput).toHaveValue('Spiced Jeera Rice')
    // Unsaved badge appears
    expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument()
    expect(screen.getByText(/You have 1 unsaved draft/i)).toBeInTheDocument()

    // Ensure backend was NOT called for PATCH
    expect(fetchSpy).toHaveBeenCalledTimes(1) // Only initial GET
  })

  it('discarding changes restores original server values and clears unsaved state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ dishes: sampleDishes, total: 2 }),
    } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'Edited Draft Rice' } })
    expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument()

    // Find and click discard button
    const card = screen.getByTestId('dish-card-1')
    const discardBtn = card.querySelector('button[type="button"]')
    expect(discardBtn).toHaveTextContent('Discard')
    fireEvent.click(discardBtn!)

    // Reverts to original name
    expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument()
  })

  it('successful save updates dish, increments version, and clears unsaved draft', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // Initial GET /dishes
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dishes: sampleDishes, total: 2 }),
      } as Response)
      // PATCH /dishes/1 response
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Dish updated successfully',
          dish: {
            dishId: '1',
            dishName: 'Premium Jeera Rice',
            imageUrl: 'https://example.com/jeera.jpg',
            isPublished: true,
            version: 2,
          },
        }),
      } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'Premium Jeera Rice' } })

    const card = screen.getByTestId('dish-card-1')
    const saveBtn = card.querySelector('button[type="submit"]')
    expect(saveBtn).toHaveTextContent('Save')
    fireEvent.click(saveBtn!)

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument()
    })

    // Check payload sent to backend
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/dishes/1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: 1,
          dishName: 'Premium Jeera Rice',
        }),
      })
    )

    // Unsaved badge should be gone
    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument()
  })

  it('prevents duplicate submissions while save is in progress', async () => {
    let resolvePatch: (value: Response) => void
    const patchPromise = new Promise<Response>((resolve) => {
      resolvePatch = resolve
    })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dishes: sampleDishes, total: 2 }),
      } as Response)
      .mockImplementationOnce(() => patchPromise)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'Saving In Progress Rice' } })

    const card = screen.getByTestId('dish-card-1')
    const saveBtn = card.querySelector('button[type="submit"]')!
    fireEvent.click(saveBtn)

    // While saving, button shows Saving... and is disabled
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(saveBtn).toBeDisabled()

    // Resolve patch
    resolvePatch!({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Dish updated successfully',
        dish: {
          dishId: '1',
          dishName: 'Saving In Progress Rice',
          imageUrl: 'https://example.com/jeera.jpg',
          isPublished: true,
          version: 2,
        },
      }),
    } as Response)

    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })
  })

  it('preserves draft and displays error message when save fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dishes: sampleDishes, total: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Bad Request',
          message: 'Publishing requires a non-empty dishName.',
        }),
      } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'Failed Attempt' } })

    const card = screen.getByTestId('dish-card-1')
    const saveBtn = card.querySelector('button[type="submit"]')!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(
        screen.getByText('Publishing requires a non-empty dishName.')
      ).toBeInTheDocument()
    })

    // Draft is preserved
    expect(nameInput).toHaveValue('Failed Attempt')
    expect(screen.getByTestId('unsaved-badge')).toBeInTheDocument()
  })

  it('on 409 Conflict preserves draft and provides reload latest action', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dishes: sampleDishes, total: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'Conflict',
          message: 'Stale version conflict. Expected version 1, but current version is 2.',
          currentDish: {
            dishId: '1',
            dishName: 'Concurrent Remote Rice',
            imageUrl: 'https://example.com/jeera.jpg',
            isPublished: true,
            version: 2,
          },
        }),
      } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Jeera Rice')
    fireEvent.change(nameInput, { target: { value: 'My Local Rice' } })

    const card = screen.getByTestId('dish-card-1')
    const saveBtn = card.querySelector('button[type="submit"]')!
    fireEvent.click(saveBtn)

    // Conflict banner appears
    await waitFor(() => {
      expect(screen.getByText(/Version Conflict Detected/i)).toBeInTheDocument()
    })

    // Local draft is preserved!
    expect(nameInput).toHaveValue('My Local Rice')

    // Warning is clearly shown
    expect(
      screen.getByText(/Warning: Reloading replaces your current draft with the server version/i)
    ).toBeInTheDocument()

    // Click "Reload latest (discard draft)"
    const reloadBtn = screen.getByText('Reload latest (discard draft)')
    fireEvent.click(reloadBtn)

    // Replaces draft with server version
    await waitFor(() => {
      expect(screen.getByDisplayValue('Concurrent Remote Rice')).toBeInTheDocument()
      expect(screen.getByText('v2')).toBeInTheDocument()
    })

    // Conflict banner and unsaved badge are cleared
    expect(screen.queryByText(/Version Conflict Detected/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('unsaved-badge')).not.toBeInTheDocument()
  })

  it('handles API fetch error state with retry option', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error connecting to backend'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ dishes: sampleDishes, total: 2 }),
      } as Response)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('api-error-state')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed to Load Dishes')).toBeInTheDocument()
    expect(
      screen.getByText('Network error connecting to backend')
    ).toBeInTheDocument()

    // Click Retry Connection
    const retryBtn = screen.getByText('Retry Connection')
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jeera Rice')).toBeInTheDocument()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
