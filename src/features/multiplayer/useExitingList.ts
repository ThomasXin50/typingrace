import { useEffect, useRef, useState } from 'react'

export interface ExitingListEntry<T> {
  key: string
  item: T
  leaving: boolean
}

/**
 * Keeps a removed item rendered (flagged leaving: true) for exitDurationMs
 * after it drops out of `items`, instead of vanishing the instant it's
 * gone from the data - React unmounts a removed node immediately
 * otherwise, which is the whole reason a list item can't get an exit
 * animation without something like this holding it in place.
 *
 * An item that reappears (same key) before its exit timer elapses is
 * revived in place rather than treated as a brand new entry.
 */
export function useExitingList<T>(
  items: T[],
  getKey: (item: T) => string,
  exitDurationMs: number,
): ExitingListEntry<T>[] {
  const [entries, setEntries] = useState<ExitingListEntry<T>[]>(() =>
    items.map((item) => ({ key: getKey(item), item, leaving: false })),
  )
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const currentByKey = new Map(items.map((item) => [getKey(item), item]))

    setEntries((prev) => {
      const next: ExitingListEntry<T>[] = []

      for (const entry of prev) {
        const current = currentByKey.get(entry.key)
        if (current) {
          const timer = timersRef.current.get(entry.key)
          if (timer) {
            clearTimeout(timer)
            timersRef.current.delete(entry.key)
          }
          next.push({ key: entry.key, item: current, leaving: false })
        } else if (entry.leaving) {
          next.push(entry)
        } else {
          next.push({ ...entry, leaving: true })
          const timer = setTimeout(() => {
            setEntries((cur) => cur.filter((e) => e.key !== entry.key))
            timersRef.current.delete(entry.key)
          }, exitDurationMs)
          timersRef.current.set(entry.key, timer)
        }
      }

      for (const item of items) {
        const key = getKey(item)
        if (!next.some((e) => e.key === key)) {
          next.push({ key, item, leaving: false })
        }
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  return entries
}
