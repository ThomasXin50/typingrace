import { describe, expect, it } from 'vitest'
import {
  BOT_PERSONALITIES,
  BOT_PERSONALITY_NAMES,
  botDisplayName,
} from './botPersonalities'

describe('BOT_PERSONALITY_NAMES', () => {
  it('has a display name for every personality', () => {
    for (const personality of BOT_PERSONALITIES) {
      expect(BOT_PERSONALITY_NAMES[personality]).toBeTruthy()
    }
  })
})

describe('botDisplayName', () => {
  it('returns the plain personality name when no other bot shares it', () => {
    const bot = { id: 'bot-1', personality: 'coder' as const }
    expect(botDisplayName(bot, [bot])).toBe('The Coder')
  })

  it('disambiguates with a short id suffix when personalities collide', () => {
    const bots = [
      { id: 'bot-1111', personality: 'coder' as const },
      { id: 'bot-2222', personality: 'coder' as const },
    ]
    expect(botDisplayName(bots[0], bots)).toBe('The Coder #1111')
    expect(botDisplayName(bots[1], bots)).toBe('The Coder #2222')
  })

  it('does not disambiguate bots with different personalities', () => {
    const bots = [
      { id: 'bot-1', personality: 'coder' as const },
      { id: 'bot-2', personality: 'typist' as const },
    ]
    expect(botDisplayName(bots[0], bots)).toBe('The Coder')
    expect(botDisplayName(bots[1], bots)).toBe('The Typist')
  })
})
