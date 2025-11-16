import React, { useCallback, ReactNode } from 'react'
import cn from 'clsx'
import css from './FlashcardSectionDisplay.module.css'
import FieldMenu from './FlashcardSectionFieldPopoverMenu'
import { Tooltip, Popover, Box, Typography } from '@mui/material'
import { useSelector } from 'react-redux'
import * as dictSelectors from '../selectors/dictionaryFiles'

const FlashcardDisplayField = ({
  children,
  fieldName,
  subtitles,
  linkedTracks,
  mediaFileId,
  onDoubleClick,
  className,
  title,
  fieldValueRef,
  enableDictionaryHover,
}: {
  children: string | null
  fieldName: FlashcardFieldName
  subtitles: MediaSubtitlesRelation[]
  linkedTracks: SubtitlesFlashcardFieldsLinks
  mediaFileId: MediaFileId
  onDoubleClick?: (fieldName: FlashcardFieldName) => void
  className?: string
  title?: string
  fieldValueRef?: React.RefObject<HTMLSpanElement>
  enableDictionaryHover?: boolean
}) => {
  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) onDoubleClick(fieldName)
  }, [fieldName, onDoubleClick])

  const linkedSubtitlesTrack = linkedTracks[fieldName] || null
  const subtitlesMenu = Boolean(subtitles.length) && (
    <FieldMenu
      className={css.previewFieldMenuButton}
      linkedSubtitlesTrack={linkedSubtitlesTrack}
      mediaFileId={mediaFileId}
      fieldName={fieldName as TransliterationFlashcardFieldName}
    />
  )

  return (
    <div
      className={cn(css.previewField, className, {
        [css.previewFieldWithPopover]: Boolean(subtitles.length),
      })}
      onDoubleClick={handleDoubleClick}
    >
      {subtitlesMenu}
      <FlashcardDisplayFieldValue
        fieldName={fieldName}
        value={children}
        title={title}
        fieldValueRef={fieldValueRef}
        enableDictionaryHover={enableDictionaryHover}
      />
    </div>
  )
}

const FlashcardDisplayFieldValue = ({
  fieldName,
  value,
  title,
  fieldValueRef,
  enableDictionaryHover,
}: {
  fieldName: FlashcardFieldName
  value: string | null
  title: string | undefined
  clozeIndex?: number
  fieldValueRef?: React.RefObject<HTMLSpanElement>
  enableDictionaryHover?: boolean
}) => {
  if (!value)
    return title ? (
      <Tooltip title={title}>
        <span className={css.emptyFieldPlaceholder}>{fieldName}</span>
      </Tooltip>
    ) : (
      <span className={css.emptyFieldPlaceholder}>{fieldName}</span>
    )

  const withoutNewlines: ReactNode[] = []
  const lines = value.split(/[\n\r]/)
  lines.forEach((line, i) => {
    if (i !== 0)
      withoutNewlines.push(
        <span className={css.newlinePlaceholder} key={String(i)}>
          <span className={css.newline}>{'\n'}</span>
        </span>
      )
    withoutNewlines.push(line)
  })

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null)
  const [candidates, setCandidates] = React.useState<Array<{ head: string; pronunciation: string | null; meanings: string[]; frequencyScore: number | null }>>([])

  const activeDicts = useSelector((s: AppState) => dictSelectors.getActiveDictionaries(s)).map((f) => ({ type: f.dictionaryType, key: f.key, id: f.id }))
  const handleMouseMove: React.MouseEventHandler<HTMLSpanElement> = async (e) => {
    if (!enableDictionaryHover) return
    const el = e.currentTarget
    const docAny = document as any
    let index = 0
    if (docAny.caretRangeFromPoint) {
      const range = docAny.caretRangeFromPoint(e.clientX, e.clientY)
      if (range && el.contains(range.startContainer)) {
        const pre = document.createRange()
        pre.selectNodeContents(el)
        pre.setEnd(range.startContainer, range.startOffset)
        index = pre.toString().length
      }
    } else if (docAny.caretPositionFromPoint) {
      const pos = docAny.caretPositionFromPoint(e.clientX, e.clientY)
      if (pos && el.contains(pos.offsetNode)) {
        const pre = document.createRange()
        pre.selectNodeContents(el)
        pre.setEnd(pos.offsetNode, pos.offset)
        index = pre.toString().length
      }
    }
    const text = typeof value === 'string' ? value : ''
    if (!text) return
    const { lookupByIndex } = await import('../utils/dictionaries/lookupByIndex')
    const { flattenMeanings } = await import('../utils/dictionaries/flatten')
    try {
      const match = await lookupByIndex(text, index, activeDicts.map((d) => ({ type: d.type, key: d.key })) as Array<{ type: DictionaryFileType; key: number }>)
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
        // dedupe by head+pron+first meaning
        const exists = grouped[key].some(
          (g) => g.head === obj.head && g.pronunciation === obj.pronunciation && (g.meanings[0] || '') === (obj.meanings[0] || '')
        )
        if (!exists) grouped[key].push(obj)
      })
      const orderedGroups = activeDicts.map((d) => ({ type: `${d.type}:${d.id}`, entries: grouped[`${d.type}:${d.id}`] || [] }))
      const mapped = orderedGroups.flatMap((g) => g.entries.map((e) => ({ ...e, _group: g.type }))).slice(0, 12)
      if (mapped.length) {
        setCandidates(mapped)
        setAnchorEl(el)
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
    setAnchorEl(null)
    setCandidates([])
  }

  return (
    <>
      <span
        ref={fieldValueRef}
        className={css.fieldValue}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {withoutNewlines}
      </span>
      <Popover
        open={Boolean(anchorEl) && Boolean(candidates.length)}
        anchorReference="anchorPosition"
        anchorPosition={position || { left: 0, top: 0 }}
        onClose={() => setAnchorEl(null)}
      >
        <Box sx={{ p: 1, maxWidth: 320 }}>
          {candidates.map((c, i) => (
            <Box key={c.head + String(i)} sx={{ mb: 0.75 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{(c as any)._group}</Typography>
              <Typography variant="subtitle2">{c.head}{c.pronunciation ? ` ・ ${c.pronunciation}` : ''}{typeof c.frequencyScore === 'number' ? `  · ${c.frequencyScore}` : ''}</Typography>
              <Typography variant="body2">{c.meanings.join('；')}</Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  )
}

export default FlashcardDisplayField
