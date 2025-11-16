import { getDexieDb, parseFlat, HEAD, PRONUNCIATION, TextTokensTranslations, TranslatedToken } from '../dictionariesDatabase'
import { getTableName, LexiconEntry } from '../../files/dictionaryFile'

export async function lookUpActiveDictionaries(
  text: string,
  activeTypes: DictionaryFileType[]
): Promise<TextTokensTranslations> {
  const dexie = getDexieDb()
  const { tokensByIndex: potentialTokens, allTokens } = parseFlat(text, 12)

  const allLookupTokens = Array.from(allTokens)
  const queriesByType: Record<DictionaryFileType, LexiconEntry[]> = {}

  for (const type of activeTypes) {
    const table = dexie.table(getTableName(type))
    const headMatches: LexiconEntry[] = await table.where(HEAD).anyOf(allLookupTokens).distinct().toArray()
    const pronMatches: LexiconEntry[] = await table.where(PRONUNCIATION).anyOf(allLookupTokens).distinct().toArray()
    queriesByType[type] = [...headMatches, ...pronMatches]
  }

  const tokensTranslations = potentialTokens.flatMap(({ tokens, index }) => {
    const translatedTokens = tokens.flatMap((token) => {
      const candidates = Object.values(queriesByType)
        .flat()
        .flatMap((entry) => {
          const exactMatch = entry.head === token || entry.pronunciation === token
          return exactMatch ? [{ entry }] : []
        })

      const translatedTokensAtIndex: TranslatedToken[] = candidates.length
        ? [
            {
              matchedTokenText: token,
              candidates: candidates.sort((a, b) => {
                const aScore = typeof a.entry.frequencyScore === 'number' ? a.entry.frequencyScore : -Infinity
                const bScore = typeof b.entry.frequencyScore === 'number' ? b.entry.frequencyScore : -Infinity
                return bScore - aScore
              }),
            },
          ]
        : []
      return translatedTokensAtIndex
    })

    return translatedTokens.length
      ? [
          {
            textCharacterIndex: index,
            translatedTokens,
          },
        ]
      : []
  })

  return { tokensTranslations, characterIndexToTranslationsMappings: [] }
}