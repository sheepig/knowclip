import { useCallback } from 'react'
import cn from 'clsx'
import { useDispatch, useSelector } from 'react-redux'
import r from '../redux'
import css from './Waveform.module.css'
import {
  msToPixels,
  SecondaryClipDisplayProps,
  SUBTITLES_CHUNK_HEIGHT,
  WaveformInterface,
  WAVEFORM_HEIGHT,
} from 'clipwave'
import { waveform$ as $ } from './waveformTestLabels'
import { SubtitlesCardBases } from '../selectors'
import { actions } from '../actions'
import { isWaveformItemSelectable } from '../utils/clipwave/isWaveformItemSelectable'
import { getMediaPlayer } from '../utils/media'
import { WaveformSubtitleVisibility } from '../types/WaveformSubtitleVisibility'

export const useWaveformRenderSubtitlesChunk = (
  waveform: WaveformInterface,
  visibility: WaveformSubtitleVisibility
) => {
  const subsBases = useSelector(r.getSubtitlesCardBases)
  const fieldsToTracks = useSelector(r.getSubtitlesFlashcardFieldLinks)
  const selection = waveform.getSelection()

  return useCallback(
    (displayProps: SecondaryClipDisplayProps) => (
      <WaveformSubtitlesChunk
        {...{
          ...displayProps,
          subsBases,
          selection,
          visibility,
          fieldsToTracks,
          selectItemAndSeekTo: waveform.actions.selectItemAndSeekTo,
          isSelectable: isWaveformItemSelectable(
            displayProps.clip,
            displayProps.region,
            displayProps.regionIndex,
            waveform.state.regions,
            waveform.getItem
          ),
        }}
      />
    ),
    [
      selection,
      subsBases,
      visibility,
      fieldsToTracks,
      waveform.state.regions,
      waveform.getItem,
      waveform.actions.selectItemAndSeekTo,
    ]
  )
}

function WaveformSubtitlesChunk({
  clip,
  regionIndex,
  pixelsPerSecond,
  subsBases,
  selection,
  isSelectable,
  selectItemAndSeekTo,
  visibility,
  fieldsToTracks,
}: SecondaryClipDisplayProps & {
  subsBases: SubtitlesCardBases
  selection: ReturnType<WaveformInterface['getSelection']>
  isSelectable: boolean
  selectItemAndSeekTo: WaveformInterface['actions']['selectItemAndSeekTo']
  visibility: WaveformSubtitleVisibility
  fieldsToTracks: ReturnType<typeof r.getSubtitlesFlashcardFieldLinks>
}) {
  const isSelected = selection.item?.id === clip.id

  const dispatch = useDispatch()
  const handleDoubleClick = useCallback(() => {
    dispatch(
      actions.newCardFromSubtitlesRequest(
        { type: 'Preview', id: clip.id },
        undefined,
        false
      )
    )
  }, [clip.id, dispatch])

  const handleClick = useCallback(() => {
    if (!isSelected)
      selectItemAndSeekTo(regionIndex, clip.id, getMediaPlayer(), clip.start)
  }, [clip.id, clip.start, isSelected, regionIndex, selectItemAndSeekTo])

  const cardBase = subsBases.cardsMap[clip.id]
  if (!cardBase) return null
  const clipPathId = `subs__${clip.id}`
  const displayStart = msToPixels(cardBase.start, pixelsPerSecond)
  const displayEnd = msToPixels(cardBase.end, pixelsPerSecond)
  const width = displayEnd - displayStart

  const transcriptionTrackId = fieldsToTracks['transcription']
  const meaningTrackId = fieldsToTracks['meaning']

  const visibleTrackIds = subsBases.linkedTrackIds.filter((id) => {
    if (visibility === 'SHOW_ALL') return true
    if (visibility === 'HIDE_BOTH') {
      if (id === meaningTrackId) return false
    }
    if (visibility === 'HIDE_TRANSCRIPTION' && id === transcriptionTrackId)
      return false
    if (visibility === 'HIDE_MEANING' && id === meaningTrackId) return false
    return true
  })

  const rect = {
    x: displayStart,
    y: WAVEFORM_HEIGHT,
    width: width,
    height: SUBTITLES_CHUNK_HEIGHT * visibleTrackIds.length,
  }
  const clickDataProps = {}
  const fieldsPreview = subsBases.getFieldsPreviewFromCardsBase(cardBase)

  return (
    <g
      className={cn(css.subtitlesChunk, $.subtitlesChunk, {
        [css.unselectable]: !isSelectable,
      })}
      {...clickDataProps}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
    >
      <clipPath id={clipPathId}>
        <rect {...rect} width={Math.max(0, width - 10)} />
      </clipPath>
      <rect
        className={cn(css.subtitlesChunkRectangle, {
          [css.selectedSubtitlesChunk]: isSelected,
        })}
        {...clickDataProps}
        {...rect}
        rx={SUBTITLES_CHUNK_HEIGHT / 2}
      />
      {visibleTrackIds.map((id, i) => {
        const i1 = 1 + i
        const isBlurred = visibility === 'HIDE_BOTH' && id === transcriptionTrackId
        return (
          <text
            key={id + i}
            clipPath={`url(#${clipPathId})`}
            className={css.subtitlesText}
            style={isBlurred ? { filter: 'blur(3px)' } : undefined}
            x={displayStart + 6}
            y={i1 * SUBTITLES_CHUNK_HEIGHT - 4 + WAVEFORM_HEIGHT}
            {...clickDataProps}
          >
            {fieldsPreview[id]}
          </text>
        )
      })}
    </g>
  )
}
