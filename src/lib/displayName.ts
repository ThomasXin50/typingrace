export interface DisplayableProfile {
  user_id: string
  username: string
  is_anonymous: boolean
}

interface ListedProfile {
  user_id: string
  is_anonymous: boolean
}

/**
 * Renders a profile for a public listing (leaderboard, room roster, race
 * results) without ever showing an anonymous profile's generated username.
 * `listing` is every profile sharing that listing, used only to decide
 * whether a disambiguating suffix is needed - plain "Guest" is ambiguous
 * once more than one guest appears together.
 */
export function displayName(
  profile: DisplayableProfile,
  listing: ListedProfile[],
): string {
  if (!profile.is_anonymous) return profile.username

  const guestCount = listing.filter((p) => p.is_anonymous).length
  if (guestCount <= 1) return 'Guest'

  return `Guest ${profile.user_id.slice(-4)}`
}
