import React, {
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
  memo,
  useRef,
} from 'react'
import cn from 'clsx'
import css from './FlashcardSectionDisplay.module.css'
import FieldMenu from './FlashcardSectionFieldPopoverMenu'
import { Tooltip, Popover, Box, Typography } from '@mui/material'
import * as dictSelectors from '../selectors/dictionaryFiles'
import { useSelector } from 'react-redux'
import { ClozeControls } from '../utils/clozeField/useClozeControls'
import r from '../redux'
import usePopover from '../utils/usePopover'
 

// check nico 38:53 einverstanden? gives no result
// check tobira
const ClozeField = ({
  className,
  fieldName,
  subtitles,
  linkedTracks,
  mediaFileId,
  value,
  clozeControls,
  enableDictionaryHover,
}: {
  className?: string
  fieldName: FlashcardFieldName
  subtitles: MediaSubtitlesRelation[]
  linkedTracks: SubtitlesFlashcardFieldsLinks
  mediaFileId: MediaFileId
  value: string
  clozeControls: ClozeControls
  enableDictionaryHover?: boolean
}) => {
  const {
    clozeIndex: currentClozeIndex = -1,
    previewClozeIndex = -1,
    deletions,
    inputRef: clozeInputRef,
  } = clozeControls

  const currentClozeId = ClozeIds[currentClozeIndex]
  const selectionHue =
    ClozeHues[currentClozeId || ClozeIds[deletions.length]] || 200

  const popover = usePopover()

  const editing = currentClozeIndex !== -1

  useEffect(() => {
    if (clozeInputRef.current && editing) {
      const selection = window.getSelection()
      if (selection) selection.empty()
      clozeInputRef.current.blur()
      clozeInputRef.current.focus()
    }
  }, [currentClozeIndex, clozeInputRef, editing])
  const clozeId = ClozeIds[currentClozeIndex]
  const { viewMode, activeDicts } = useSelector((state: AppState) => ({
    viewMode: state.settings.viewMode,
    activeDicts: dictSelectors.getActiveDictionaries(state).map((f) => ({ type: f.dictionaryType, key: f.key, id: f.id })),
  }))

  const cursorPosition = -1

  const rangesWithClozeIndexes = deletions
    .flatMap(({ ranges }, clozeIndex) => {
      return ranges.map((range) => ({ range, clozeIndex }))
    })
    .sort((a, b) => a.range.start - b.range.start)
  const segments: ReactNode[] = useMemo(() => {
    const newlineChar = viewMode === 'HORIZONTAL' ? '⏎' : '\n'
    const segments: ReactNode[] = []

    const first = rangesWithClozeIndexes[0]
    if (!first || first.range.start > 0) {
      const startPaddingEnd = first ? first.range.start : value.length
      segments.push(
        ...[...value.slice(0, startPaddingEnd)].map((c, i) => (
          <CharSpan
            key={`${c}${i}`}
            {...{
              char: c,
              index: i,
              className: css.clozeValueChar,
              clozeIndex: 0,
              newlineChar,
              hasCursor: cursorPosition === i,
            }}
          />
        ))
      )
    }

    rangesWithClozeIndexes.forEach(
      ({ range: { start, end }, clozeIndex }, i) => {
        segments.push(
          ...[...value.slice(start, end)].map((c, i) => (
            <CharSpan
              key={`${c}${start + i}`}
              {...{
                char: c,
                index: start + i,
                className: cn(css.blank, {
                  [css.previewBlank]:
                    previewClozeIndex !== -1 &&
                    previewClozeIndex === clozeIndex,
                  [css.blankEditing]: clozeIndex === currentClozeIndex,
                }),
                clozeIndex,
                newlineChar,
                hasCursor: cursorPosition === start + i,
              }}
            />
          ))
        )

        const nextRange: {
          range: ClozeRange
          clozeIndex: number
        } | null = rangesWithClozeIndexes[i + 1] || null
        const subsequentGapEnd = nextRange
          ? nextRange.range.start
          : value.length

        if (subsequentGapEnd - end > 0) {
          segments.push(
            ...[...value.slice(end, subsequentGapEnd)].map((c, i) => (
              <CharSpan
                key={`${c}${end + i}`}
                {...{
                  char: c,
                  index: end + i,
                  className: css.clozeValueChar,
                  clozeIndex,
                  newlineChar,
                  hasCursor: cursorPosition === end + i,
                }}
              />
            ))
          )
        }
      }
    )
    return segments
  }, [
    currentClozeIndex,
    previewClozeIndex,
    rangesWithClozeIndexes,
    value,
    viewMode,
    cursorPosition,
  ])

  if (!value)
    return <span className={css.emptyFieldPlaceholder}>{fieldName}</span>

  const tooltipProps = editing
    ? {
        title: clozeHint,
      }
    : null

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null)
  const [candidates, setCandidates] = React.useState<Array<{ head: string; pronunciation: string | null; meanings: string[]; frequencyScore: number | null }>>([])

  const handleMouseMove: React.MouseEventHandler<HTMLSpanElement> = async (e) => {
    if (!enableDictionaryHover) return
    const target = e.target as HTMLElement
    const idxAttr = target.getAttribute('data-character-index')
    if (!idxAttr) return
    const index = Number(idxAttr)
    if (Number.isNaN(index)) return
    if (!value) return
    const { lookupByIndex } = await import('../utils/dictionaries/lookupByIndex')
    try {
      const match = await lookupByIndex(value, index, activeDicts as Array<{ type: DictionaryFileType; key: number }>)
      const { flattenMeanings } = await import('../utils/dictionaries/flatten')
      const items = match ? match.candidates : []
      const grouped: Record<string, Array<{ head: string; pronunciation: string | null; meanings: string[]; frequencyScore: number | null }>> = {}
      items.forEach(({ entry, type }) => {
        const active = activeDicts.find((d) => d.type === type && d.key === entry.dictionaryKey)
        const key = active ? `${active.type}:${active.id}` : String(type)
        const meanings = flattenMeanings(entry.meanings || [])
        const obj = {
          head: entry.head,
          pronunciation: entry.pronunciation,
          meanings,
          frequencyScore: entry.frequencyScore,
        }
        grouped[key] = grouped[key] || []
        const exists = grouped[key].some(
          (g) => g.head === obj.head && g.pronunciation === obj.pronunciation && (g.meanings[0] || '') === (obj.meanings[0] || '')
        )
        if (!exists) grouped[key].push(obj)
      })
      const orderedGroups = activeDicts.map((d) => ({ type: `${d.type}:${d.id}`, entries: grouped[`${d.type}:${d.id}`] || [] }))
      const mapped = orderedGroups.flatMap((g) => g.entries.map((e) => ({ ...e, _group: g.type }))).slice(0, 12)
      if (mapped.length) {
        setCandidates(mapped)
        setAnchorEl(target)
        setPosition({ left: e.clientX, top: e.clientY })
      } else {
        setAnchorEl(null)
        setCandidates([])
      }
    } catch (_err) {
      setAnchorEl(null)
      setCandidates([])
    }
  }
  const handleMouseLeave: React.MouseEventHandler<HTMLSpanElement> = () => {
    if (!enableDictionaryHover) return
    setAnchorEl(null)
    setCandidates([])
  }

  return (
    <div
      className={cn(css.previewField, className, {
        [css.previewFieldWithPopover]: Boolean(subtitles.length),
      })}
      style={{
        ['--cloze-selection-hue' as any]: selectionHue,
      }}
    >
      {Boolean(subtitles.length) && (
        <FieldMenu
          className={css.previewFieldMenuButton}
          linkedSubtitlesTrack={linkedTracks[fieldName]}
          mediaFileId={mediaFileId}
          fieldName={fieldName as TransliterationFlashcardFieldName}
        />
      )}
      {tooltipProps ? (
        <Tooltip key={value} {...tooltipProps}>
          <span
            className={cn(css.clozeFieldValue, clozeId, {
              [css.clozePreviewFieldValue]: previewClozeIndex !== -1,
            })}
            tabIndex={0}
            ref={clozeInputRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {segments}
            {cursorPosition === value.length && (
              <span className={css.clozeCursor} />
            )}
          </span>
        </Tooltip>
      ) : (
        <span
          className={cn(css.clozeFieldValue, clozeId, {
            [css.clozePreviewFieldValue]: previewClozeIndex !== -1,
          })}
          tabIndex={0}
          ref={clozeInputRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {segments}
          {cursorPosition === value.length && (
            <span className={css.clozeCursor} />
          )}
        </span>
      )}
      <Popover
        open={Boolean(anchorEl) && Boolean(candidates.length)}
        anchorReference="anchorPosition"
        anchorPosition={position || { left: 0, top: 0 }}
        onClose={() => setAnchorEl(null)}
      >
        <Box sx={{ p: 1, maxWidth: 320 }}>
          {candidates.map((c, i) => (
            <Box key={c.head + String(i)} sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2">{c.head}{c.pronunciation ? ` ・ ${c.pronunciation}` : ''}</Typography>
              <Typography variant="body2">{c.meanings.join('; ')}</Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </div>
  )
}

export type ClozeId =
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4'
  | 'c5'
  | 'c6'
  | 'c7'
  | 'c8'
  | 'c9'
  | 'c10'
export const ClozeIds = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'c10',
] as const

export const ClozeHues = {
  c1: 240,
  c2: 130,
  c3: 60,
  c4: 180,
  c5: 300,
  c6: 41,
  c7: 78,
  c8: 0,
  c9: 215,
  c10: 271,
}

const CharSpan = memo(
  ({
    char,
    index,
    className,
    clozeIndex,
    newlineChar,
    hasCursor,
  }: {
    char: string
    index: number
    className: string
    clozeIndex: number
    newlineChar: string
    hasCursor?: boolean
  }) => {
    const isNewline = char === '\n' || char === '\r'
    const content = isNewline ? newlineChar : char
    const ref = useRef<HTMLSpanElement>(null)

    return (
      <span
        ref={ref}
        data-character-index={index}
        className={cn(className, {
          [css.clozeNewlinePlaceholder]: isNewline,
          [css.clozeCursor]: hasCursor,
        })}
        key={String(index + char)}
        style={{
          ['--cloze-background-hue' as any]: ClozeHues[ClozeIds[clozeIndex]],
        }}
      >
        {content}
      </span>
    )
  }
)

const clozeHint = (
  <div>
    Select the text you wish to blank out.
    <br />
    <br />
    Hit Backspace to trim selection.
    <br />
    <br />
    Hit Enter when finished.
  </div>
)

export const getMetaOrCtrlKey = (
  e: KeyboardEvent | React.KeyboardEvent<Element>
) => (window.electronApi.platform === 'darwin' ? e.metaKey : e.ctrlKey)

export default ClozeField
