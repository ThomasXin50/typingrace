import { assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { generateJoinCode, JOIN_CODE_LENGTH } from './joinCode.ts'

Deno.test('generateJoinCode - produces a code of the expected length', () => {
  const code = generateJoinCode()
  assertEquals(code.length, JOIN_CODE_LENGTH)
})

Deno.test(
  'generateJoinCode - only uses the unambiguous alphabet (no 0/O/1/I/L)',
  () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode()
      assertMatch(code, /^[A-HJ-NP-Z2-9]{6}$/)
    }
  },
)

Deno.test(
  'generateJoinCode - maps a given random source to the expected alphabet indices',
  () => {
    let calls = 0
    const sequence = [0, 0.5, 0.999, 0.1, 0.4, 0.75]
    const fixedRandom = () => sequence[calls++]

    assertEquals(generateJoinCode(fixedRandom), 'AS9DP2')
  },
)
