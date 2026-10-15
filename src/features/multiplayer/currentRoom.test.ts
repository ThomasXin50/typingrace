import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCurrentRoomId,
  getCurrentRoomId,
  setCurrentRoomId,
} from './currentRoom'

describe('currentRoom', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been set', () => {
    expect(getCurrentRoomId()).toBeNull()
  })

  it('round-trips a room id through set/get', () => {
    setCurrentRoomId('room-1')
    expect(getCurrentRoomId()).toBe('room-1')
  })

  it('clears a stored room id', () => {
    setCurrentRoomId('room-1')
    clearCurrentRoomId()
    expect(getCurrentRoomId()).toBeNull()
  })

  describe('when localStorage throws (private browsing / storage disabled)', () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked')
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('getCurrentRoomId falls back to null instead of throwing', () => {
      expect(() => getCurrentRoomId()).not.toThrow()
      expect(getCurrentRoomId()).toBeNull()
    })

    it('setCurrentRoomId falls back silently instead of throwing', () => {
      expect(() => setCurrentRoomId('room-1')).not.toThrow()
    })

    it('clearCurrentRoomId falls back silently instead of throwing', () => {
      expect(() => clearCurrentRoomId()).not.toThrow()
    })
  })
})
