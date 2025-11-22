import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IconButton, Tooltip } from '@mui/material'
import { ChevronLeft, ChevronRight, Image, BorderColor, Loop, LibraryAdd } from '@mui/icons-material'
import { actions } from '../actions'
import { getKeyboardShortcut } from './KeyboardShortcuts'
import useClozeControls from '../utils/clozeField/useClozeControls'
import ClozeButtons from './FlashcardSectionDisplayClozeButtons'
import * as r from '../selectors'

const WaveformOperationsBar = ({
  waveform,
  playerRef,
}: {
  waveform: ReturnType<typeof import('clipwave').useWaveform>
  playerRef: React.RefObject<HTMLVideoElement | HTMLAudioElement>
}) => {
  const dispatch = useDispatch()
  const { includeStill, selection, loop, flashcard } = useSelector((state: AppState) => ({
    includeStill: state.session.defaultIncludeStill,
    selection: state.session.waveformSelection,
    loop: state.session.loopMedia,
    flashcard: r.getHighlightedFlashcard(state),
  }))

  const prev = useCallback(() => {
    waveform.actions.selectPreviousItemAndSeek(playerRef.current, () => true)
  }, [waveform, playerRef])
  const next = useCallback(() => {
    waveform.actions.selectNextItemAndSeek(playerRef.current, () => true)
  }, [waveform, playerRef])

  const toggleImage = useCallback(() => {
    dispatch(actions.setDefaultClipSpecs({ includeStill: !includeStill }))
  }, [dispatch, includeStill])

  // Creating card from current subtitles preview is achieved by starting editing
  // which triggers newClipFromChunkOnEdit epic when selection is Preview.

  const startCloze = useCallback(() => {
    if (!selection || (selection as any).type !== 'Preview') {
      dispatch(actions.simpleMessageSnackbar('Please select a subtitles sentence first.', 3000))
      return
    }
    dispatch(actions.startEditingCards())
  }, [dispatch, selection])

  const toggleLoop = useCallback(() => {
    dispatch(actions.toggleLoop('BUTTON'))
  }, [dispatch])

  const onNewClozeCard = useCallback(
    (deletion: ClozeDeletion) => {
      if (!flashcard) return
      dispatch(
        actions.addClozeDeletion(flashcard.id, flashcard.cloze || [], deletion)
      )
    },
    [dispatch, flashcard]
  )
  const onEditClozeCard = useCallback(
    (clozeIndex: number, ranges: ClozeRange[]) => {
      if (!flashcard) return
      dispatch(
        actions.editClozeDeletion(
          flashcard.id,
          flashcard.cloze,
          clozeIndex,
          ranges
        )
      )
    },
    [dispatch, flashcard]
  )
  const onDeleteClozeCard = useCallback(
    (clozeIndex: number) => {
      if (!flashcard) return
      dispatch(
        actions.removeClozeDeletion(
          flashcard.id,
          flashcard.cloze,
          clozeIndex
        )
      )
    },
    [dispatch, flashcard]
  )

  const clozeControls = useClozeControls({
    deletions: flashcard?.cloze || [],
    onNewClozeCard,
    onEditClozeCard,
    onDeleteClozeCard,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#000000de', color: '#fff' }}>
      <Tooltip title={`Previous (${getKeyboardShortcut('Select previous')})`}>
        <IconButton onClick={prev} size="small">
          <ChevronLeft style={{ color: '#fff'}} />
        </IconButton>
      </Tooltip>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Tooltip title={`${includeStill ? 'Include image' : 'Exclude image'} (no shortcut)`}>
          <IconButton onClick={toggleImage} size="small">
            <Image style={{ color: includeStill ? '#fff' : '#bbb'}} fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={`Loop selection (${getKeyboardShortcut('Toggle loop')})`}>
          <IconButton onClick={toggleLoop} size="small">
            <Loop fontSize="small" style={{ color: loop ? '#ff9800' : '#fff' }} />
          </IconButton>
        </Tooltip>

        {flashcard && (flashcard.fields as any).transcription?.trim() && (
          <section>
            <ClozeButtons controls={clozeControls} onEnterClozeMode={startCloze} />
          </section>
        )}

        <Tooltip title={`Create flashcard and start editing (${getKeyboardShortcut('Start editing fields')})`}>
          <IconButton onClick={startCloze} size="small">
            <LibraryAdd style={{ color: '#fff'}} />
          </IconButton>
        </Tooltip>
      </div>

      

      <Tooltip title={`Next (${getKeyboardShortcut('Select next')})`}>
        <IconButton onClick={next} size="small">
          <ChevronRight style={{ color: '#fff'}} />
        </IconButton>
      </Tooltip>
    </div>
  )
}

export default WaveformOperationsBar