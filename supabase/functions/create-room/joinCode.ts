export const JOIN_CODE_LENGTH = 6

// Excludes 0/O and 1/I/L - easy to mis-type or mis-read when a host reads
// a code aloud or a player copies it by hand.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateJoinCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)]
  }
  return code
}
