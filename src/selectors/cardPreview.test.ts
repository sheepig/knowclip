import { describe, it, expect } from 'vitest'
import { getSubtitlesCardBases } from './cardPreview'

function makeState({
  chunks,
  threshold,
}: {
  chunks: Array<{ start: number; end: number }>
  threshold: number
}): any {
  const mediaId = 'media-1'
  const trackId = 'track-1'
  return {
    subtitles: {
      [trackId]: {
        id: trackId,
        chunks: chunks.map((c, i) => ({ ...c, text: String(i), index: i })),
        type: 'ExternalSubtitlesTrack',
      },
    },
    files: {
      MediaFile: {
        [mediaId]: {
          id: mediaId,
          type: 'MediaFile',
          durationSeconds: 300,
          format: 'UNKNOWN',
          subtitles: [{ id: trackId, type: 'ExternalSubtitlesTrack' }],
          flashcardFieldsToSubtitlesTracks: { transcription: trackId },
          subtitlesTracksStreamIndexes: [],
          isVideo: false,
        },
      },
      ProjectFile: {
        project1: {
          id: 'project1',
          type: 'ProjectFile',
          name: 'p',
          noteType: 'Transliteration',
          mediaFileIds: [mediaId],
          error: null,
          lastSaved: 'now',
          createdAt: 'now',
          subtitlesMergeThresholdMs: threshold,
        },
      },
    },
    session: {
      currentMediaFileId: mediaId,
      currentProjectId: 'project1',
    },
    clips: {
      idsByMediaFileId: { [mediaId]: [] },
      byId: {},
    },
    fileAvailabilities: { MediaFile: {}, ProjectFile: {} },
  }
}

describe('combineSubtitles merging', () => {
  it('merges all when gaps are below threshold', () => {
    const state = makeState({
      chunks: [
        { start: 1000, end: 2000 },
        { start: 2400, end: 3000 },
        { start: 3400, end: 4000 },
      ],
      threshold: 500,
    })
    const bases = getSubtitlesCardBases(state)
    expect(bases.cards.length).toBe(1)
    const base = bases.cards[0]
    expect(base.start).toBe(1000)
    expect(base.end).toBe(4000)
    expect(base.fields['track-1']).toEqual([0, 1, 2])
  })

  it('does not merge when gaps exceed threshold', () => {
    const state = makeState({
      chunks: [
        { start: 1000, end: 2000 },
        { start: 2400, end: 3000 },
        { start: 3400, end: 4000 },
      ],
      threshold: 300,
    })
    const bases = getSubtitlesCardBases(state)
    expect(bases.cards.length).toBe(3)
    expect(bases.cards[0].fields['track-1']).toEqual([0])
    expect(bases.cards[1].fields['track-1']).toEqual([1])
    expect(bases.cards[2].fields['track-1']).toEqual([2])
  })

  it('partially merges when some gaps are small and others large', () => {
    const state = makeState({
      chunks: [
        { start: 0, end: 1000 },
        { start: 1300, end: 1800 },
        { start: 2500, end: 3000 },
      ],
      threshold: 400,
    })
    const bases = getSubtitlesCardBases(state)
    expect(bases.cards.length).toBe(2)
    expect(bases.cards[0].fields['track-1']).toEqual([0, 1])
    expect(bases.cards[1].fields['track-1']).toEqual([2])
  })

  it('SRT case: 17-18 gap 83ms with threshold 50 should not merge', () => {
    const state = makeState({
      chunks: [
        { start: 2_23_434, end: 2_24_269 }, // 00:02:23,434 → 00:02:24,269
        { start: 2_24_352, end: 2_25_687 }, // 00:02:24,352 → 00:02:25,687
        { start: 2_26_271, end: 2_28_356 }, // 00:02:26,271 → 00:02:28,356
      ],
      threshold: 50,
    })
    const bases = getSubtitlesCardBases(state)
    expect(bases.cards.length).toBe(3)
    expect(bases.cards[0].fields['track-1']).toEqual([0])
    expect(bases.cards[1].fields['track-1']).toEqual([1])
    expect(bases.cards[2].fields['track-1']).toEqual([2])
  })
})