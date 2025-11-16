import { getDexieDb, HEAD, PRONUNCIATION } from '../dictionariesDatabase'
import { getTableName, LexiconEntry } from '../../files/dictionaryFile'
import { toHiragana, isJapanese } from 'wanakana'

function normalizeToken(token: string) {
  const trimmed = token.replace(/[\s、。．・・，,\.！!？?～〜\-]/g, '')
  if (!trimmed) return []
  const variants = [trimmed]
  if (isJapanese(trimmed)) variants.push(toHiragana(trimmed))
  return Array.from(new Set(variants))
}

export async function lookupByIndex(
  text: string,
  index: number,
  activeDicts: Array<{ type: DictionaryFileType; key: number }>,
  maxWindow = 6
) {
  const dexie = getDexieDb()
  const results: {
    matchedTokenText: string
    candidates: { entry: LexiconEntry }[]
  }[] = []

  for (let startShift = 0; startShift <= 3; startShift++) {
    const start = Math.max(0, index - startShift)
    for (let len = Math.min(maxWindow, text.length - start); len >= 1; len--) {
      const end = start + len
      const token = text.slice(start, end)
      const variants = normalizeToken(token)
      if (!variants.length) continue
      const tables = activeDicts.map((d) => ({ d, tbl: dexie.table(getTableName(d.type)) }))
      const headMatches: { entry: LexiconEntry; type: DictionaryFileType }[] = (
        await Promise.all(
          tables.map(async ({ d, tbl }) => {
            const arr = await tbl
              .where(HEAD)
              .anyOf(variants)
              .and((e: LexiconEntry) => e.dictionaryKey === d.key)
              .distinct()
              .toArray()
            return arr.map((e) => ({ entry: e, type: d.type }))
          })
        )
      ).flat()
      const pronMatches: { entry: LexiconEntry; type: DictionaryFileType }[] = (
        await Promise.all(
          tables.map(async ({ d, tbl }) => {
            const arr = await tbl
              .where(PRONUNCIATION)
              .anyOf(variants)
              .and((e: LexiconEntry) => e.dictionaryKey === d.key)
              .distinct()
              .toArray()
            return arr.map((e) => ({ entry: e, type: d.type }))
          })
        )
      ).flat()
      const candidates = [...headMatches, ...pronMatches]
      if (candidates.length) {
        results.push({ matchedTokenText: token, candidates })
        // Prefer longest match first, break inner loop once found
        break
      }
    }
    if (results.length) break
  }

  // sort candidates by frequency if present
  results.forEach((r) => {
    r.candidates.sort((a, b) => {
      const as =
        typeof a.entry.frequencyScore === 'number' ? a.entry.frequencyScore : -Infinity
      const bs =
        typeof b.entry.frequencyScore === 'number' ? b.entry.frequencyScore : -Infinity
      return bs - as
    })
  })

  return results[0] || null
}
