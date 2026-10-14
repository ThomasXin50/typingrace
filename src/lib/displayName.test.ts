import { describe, expect, it } from 'vitest'
import { displayName } from './displayName'

describe('displayName', () => {
  it('shows the real username for a non-anonymous profile', () => {
    expect(
      displayName(
        {
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          username: 'alice',
          is_anonymous: false,
        },
        [],
      ),
    ).toBe('alice')
  })

  it('shows plain "Guest" for an anonymous profile alone in the listing', () => {
    expect(
      displayName(
        {
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          username: 'user_aaaa',
          is_anonymous: true,
        },
        [
          {
            user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            is_anonymous: true,
          },
        ],
      ),
    ).toBe('Guest')
  })

  it('appends an id-derived suffix when more than one guest shares the listing', () => {
    const listing = [
      { user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', is_anonymous: true },
      { user_id: '11111111-2222-3333-4444-5555566667777', is_anonymous: true },
    ]

    expect(
      displayName(
        {
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          username: 'user_aaaa',
          is_anonymous: true,
        },
        listing,
      ),
    ).toBe('Guest eeee')
  })

  it('never shows a suffix for a non-anonymous profile, even alongside guests', () => {
    const listing = [
      { user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', is_anonymous: false },
      { user_id: '11111111-2222-3333-4444-5555566667777', is_anonymous: true },
    ]

    expect(
      displayName(
        {
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          username: 'alice',
          is_anonymous: false,
        },
        listing,
      ),
    ).toBe('alice')
  })

  it('does not count a non-anonymous entry toward the "more than one guest" threshold', () => {
    const listing = [
      { user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', is_anonymous: true },
      { user_id: '11111111-2222-3333-4444-5555566667777', is_anonymous: false },
    ]

    expect(
      displayName(
        {
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          username: 'user_aaaa',
          is_anonymous: true,
        },
        listing,
      ),
    ).toBe('Guest')
  })
})
