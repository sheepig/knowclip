import React, {
  useEffect,
  useRef,
  MutableRefObject,
  AudioHTMLAttributes,
  VideoHTMLAttributes,
  useCallback,
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import cn from 'clsx'
import r from '../redux'
import css from './Media.module.css'
import { Tooltip, IconButton } from '@mui/material'
import {
  VerticalSplitSharp,
  HorizontalSplitSharp,
  Delete as DeleteIcon,
  Loop,
  ShortTextTwoTone,
} from '@mui/icons-material'
import { KEYS } from '../utils/keyboard'
import { MediaSubtitles, SubtitlesFileWithTrack } from '../selectors'
import * as selectors from '../selectors'
import FlashcardSectionForm from './FlashcardSectionForm'
import useClozeControls from '../utils/clozeField/useClozeControls'
import ClozeButtons from './FlashcardSectionDisplayClozeButtons'
import { TextField } from '@mui/material'
import { actions } from '../actions'
import { getYomitan2AnkiTemplate } from '../selectors/settings'
import { getKeyboardShortcut } from './KeyboardShortcuts'
import { flashcardSectionForm$ as $ } from './FlashcardSectionForm.testLabels'

export const MEDIA_PLAYER_ID = 'mediaPlayer'

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }
type IntersectionOf<A, B> = OmitNever<A & B>

type MediaProps = {
  constantBitrateFilePath: string | null
  loop: LoopState
  metadata: MediaFile | null
  subtitles: MediaSubtitles
  className?: string
  viewMode: ViewMode
  playerRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>
  onMediaLoaded: (mediael: HTMLAudioElement | HTMLVideoElement | null) => void
  onTimeUpdate: (
    mediaEl: HTMLVideoElement | HTMLAudioElement,
    seeking: MutableRefObject<boolean>,
    looping: boolean
  ) => void
}
let clicked = false
const setClicked = (c: boolean) => {
  clicked = c
}
const Media = ({
  constantBitrateFilePath,
  metadata,
  subtitles,
  className,
  viewMode,
  onTimeUpdate,
  playerRef,
  onMediaLoaded,
  loop,
}: MediaProps) => {
  const seeking = useRef(false)
  const seekOn = useCallback(() => {
    seeking.current = true
  }, [])
  const seekOff = useCallback(() => {
    seeking.current = false
  }, [])

  const setUpBlur = useCallback(() => {
    setClicked(true)
    if (playerRef.current) playerRef.current.blur()
  }, [playerRef])
  const blur = useCallback(() => {
    if (playerRef.current && clicked) {
      playerRef.current.blur()
      // setClicked(false)
    }
  }, [playerRef])
  const stopBlur = useCallback(() => {
    if (playerRef.current && clicked) {
      setClicked(false)
    }
  }, [playerRef])

  const looping = Boolean(loop)
  const props: IntersectionOf<
    AudioHTMLAttributes<HTMLAudioElement>,
    VideoHTMLAttributes<HTMLVideoElement>
  > = {
    loop: false,
    controls: true,
    // disablePictureInPicture: true,
    id: MEDIA_PLAYER_ID,
    controlsList: 'nodownload nofullscreen',
    src: constantBitrateFilePath
      ? new URL(`file://${constantBitrateFilePath}`).toString()
      : '',
    // @ts-expect-error not present in HTMLAudioElement
    playbackspeed: 1,

    onSeeking: seekOn,
    onSeeked: seekOff,

    onLoadedMetadata: (e) => {
      onMediaLoaded(e.currentTarget)
    },

    // prevent accidental scrub after play/pause with mouse
    onMouseEnter: setUpBlur,
    onMouseLeave: stopBlur,
    onPlay: blur,
    onPause: blur,
    onClick: blur,
    onVolumeChange: blur,
    onTimeUpdate: (e) => {
      const media = e.currentTarget
      const wasSeeking = seeking.current
      onTimeUpdate(media, seeking, looping)
      if (wasSeeking) blur()
    },

    onKeyDown: (e) => {
      if (e.key === KEYS.arrowLeft || e.key === KEYS.arrowRight) {
        if (e.altKey) e.preventDefault()
        else e.stopPropagation()
      }
    },
  }

  useEffect(() => {
    if (props.src) {
      setTimeout(() => {
        const player = document.getElementById('mediaPlayer') as
          | HTMLAudioElement
          | HTMLVideoElement
          | null
        if (player) player.src = props.src || ''
      }, 0)
    }
  }, [props.src])

  useSyncSubtitlesVisibility(subtitles.all, playerRef)
  const appliedOffsetsRef = useRef(new Map<string, number>())
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const duration = player.duration || Infinity
    const textTracks = player.textTracks
    Array.from(textTracks).forEach((domTrack) => {
      const trackId = domTrack.id
      const s = subtitles.all.find((t) => t.id === trackId)
      const desiredMs = (s?.track?.offsetMs || 0)
      const desiredSec = desiredMs / 1000
      const currentApplied = appliedOffsetsRef.current.get(trackId) || 0
      const delta = desiredSec - currentApplied
      if (!delta || !domTrack.cues) return
      // adjust all cues by delta
      const cues = domTrack.cues as any
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i]
        const newStart = Math.max(0, Math.min(duration, cue.startTime + delta))
        const newEnd = Math.max(0, Math.min(duration, cue.endTime + delta))
        cue.startTime = newStart
        cue.endTime = newEnd
      }
      appliedOffsetsRef.current.set(trackId, desiredSec)
    })
  }, [playerRef, subtitles])

  const dispatch = useDispatch()
  const toggleViewMode = useCallback(() => {
    dispatch(
      r.setViewMode(viewMode === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL')
    )
  }, [dispatch, viewMode])

  if (!metadata)
    return (
      <section className={className}>
        <div />
      </section>
    )

  return (
    <section className={cn(className, css.container)}>
      <Tooltip
        title={
          viewMode === 'HORIZONTAL'
            ? 'Switch to vertical view'
            : 'Switch to horizontal view'
        }
      >
        <IconButton
          style={{ transform: 'rotate(180deg)' }}
          onClick={toggleViewMode}
          className={css.viewModeButton}
        >
          {viewMode === 'HORIZONTAL' ? (
            <VerticalSplitSharp />
          ) : (
            <HorizontalSplitSharp />
          )}
        </IconButton>
      </Tooltip>

      {metadata.isVideo ? (
        <video
          {...(props as VideoHTMLAttributes<HTMLVideoElement>)}
          ref={playerRef as MutableRefObject<HTMLVideoElement>}
          className={cn(css.video, css.mediaPlayer)}
        >
          {subtitles.all.map((track, index) => {
            const displayFile = track.displayFile
            return (
              <Subtitles
                track={track.track}
                index={index}
                displayFile={displayFile}
                key={track.id}
                isDefault={index === 0}
              />
            )
          })}
        </video>
      ) : (
        <audio
          {...(props as AudioHTMLAttributes<HTMLAudioElement>)}
          ref={playerRef as MutableRefObject<HTMLAudioElement>}
          className={cn(css.audio, css.mediaPlayer)}
        />
      )}

      {/* <SubtitleOverlay /> */}
      <EditorOverlay metadata={metadata} playerRef={playerRef} />
    </section>
  )
}

function useSyncSubtitlesVisibility(
  subtitles: SubtitlesFileWithTrack[],
  playerRef: React.MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>
) {
  const dispatch = useDispatch()

  useEffect(() => {
    function syncReduxTracksToDom(event: Event) {
      Array.from(event.target as TextTrackList).forEach((domTrack) => {
        const track = subtitles.find((track) => track.id === domTrack.id)
        if (track && track.track && track.track.mode !== domTrack.mode)
          dispatch(
            domTrack.mode === 'showing'
              ? r.showSubtitles(track.id)
              : r.hideSubtitles(track.id)
          )
      })
    }
    if (playerRef.current)
      playerRef.current.textTracks.addEventListener(
        'change',
        syncReduxTracksToDom
      )
    const currentMediaRef = playerRef.current
    return () => {
      if (currentMediaRef)
        currentMediaRef.textTracks.removeEventListener(
          'change',
          syncReduxTracksToDom
        )
    }
  }, [subtitles, dispatch, playerRef])
  useEffect(() => {
    if (!playerRef.current) return
    for (const track of subtitles) {
      const domTrack = [...playerRef.current.textTracks].find(
        (domTrack) => domTrack.id === track.id
      )
      if (domTrack && track.track && domTrack.mode !== track.track.mode)
        domTrack.mode = track.track.mode
    }
  }, [subtitles, playerRef])
}

declare module 'react' {
  interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
    mode?: TextTrackMode
  }
}

const Subtitles = ({
  track,
  displayFile,
  isDefault,
}: {
  track: SubtitlesTrack | null
  displayFile: SubtitlesFile | null
  index: number
  isDefault: boolean
}) => {
  const { availability } = useSelector((state: AppState) => ({
    availability: displayFile
      ? r.getFileAvailability(state, displayFile)
      : null,
  }))

  if (!track || !availability || availability.status !== 'CURRENTLY_LOADED')
    return null

  return track.type === 'EmbeddedSubtitlesTrack' ? (
    <track
      id={track.id}
      kind="subtitles"
      src={new URL(`file://${availability.filePath}`).toString()}
      mode={track.mode}
      default={isDefault}
    />
  ) : (
    <track
      id={track.id}
      kind="subtitles"
      src={new URL(`file://${availability.filePath}`).toString()}
      mode={track.mode}
      default={isDefault}
    />
  )
}
export default Media

// const SubtitleOverlay = () => {
//   const { selection, subsBases, fieldsToTracks, flashcard } = useSelector(
//     (state: AppState) => ({
//       selection: selectors.getSelectionItem(state),
//       subsBases: selectors.getSubtitlesCardBases(state),
//       fieldsToTracks: selectors.getSubtitlesFlashcardFieldLinks(state),
//       flashcard: selectors.getHighlightedFlashcard(state),
//     })
//   )

//   let transcription = ''
//   let meaning = ''

//   if (selection && selection.clipwaveType === 'Secondary') {
//     const preview = subsBases.getFieldsPreviewFromCardsBase(selection)
//     const tId = fieldsToTracks['transcription']
//     const mId = fieldsToTracks['meaning']
//     transcription = (tId && preview[tId]) || ''
//     meaning = (mId && preview[mId]) || ''
//   } else if (flashcard) {
//     transcription = (flashcard.fields as any).transcription || ''
//     meaning = (flashcard.fields as any).meaning || ''
//   }

//   const show = Boolean(transcription || meaning)
//   if (!show) return null

//   return (
//     <div className={css.subtitleOverlay}>
//       {transcription && (
//         <div className={css.subtitleLinePrimary}>{transcription}</div>
//       )}
//       {meaning && <div className={css.subtitleLineSecondary}>{meaning}</div>}
//     </div>
//   )
// }

const EditorOverlay = ({
  metadata,
  playerRef,
}: {
  metadata: MediaFile | null
  playerRef: React.MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>
}) => {
  const { editing, flashcard, isLoopOn } = useSelector((state: AppState) => ({
    editing: state.session.editingCards,
    flashcard: selectors.getHighlightedFlashcard(state),
    isLoopOn: r.getLoopState(state),
  }))
  const tmpl = useSelector((state: AppState) => getYomitan2AnkiTemplate(state))
  const keys = (tmpl?.templateParams || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const parseExtra = (fields: any): Record<string, string> => {
    const values: Record<string, string> = {}
    for (const k of keys) values[k] = String(fields?.[k] || '')
    return values
  }

  const dispatch = useDispatch()
  const toggleLoop = React.useCallback(
    () => dispatch(actions.toggleLoop('BUTTON')),
    [dispatch]
  )
  const handleClickDeleteButton = React.useCallback(() => {
    if (flashcard) dispatch(actions.deleteCard(flashcard.id))
  }, [dispatch, flashcard?.id])
  const handleClickPreviewButton = React.useCallback(() => {
    dispatch(actions.stopEditingCards())
  }, [dispatch])
  const [extraValues, setExtraValues] = React.useState<Record<string, string>>(
    () => parseExtra((flashcard as any)?.fields)
  )
  React.useEffect(() => {
    setExtraValues(parseExtra((flashcard as any)?.fields))
  }, [flashcard?.id])

  const clozeControls = useClozeControls({
    deletions: flashcard?.cloze || [],
    onNewClozeCard: React.useCallback(
      (deletion) => {
        if (flashcard)
          dispatch(
            actions.addClozeDeletion(
              flashcard.id,
              flashcard.cloze,
              deletion
            )
          )
      },
      [dispatch, flashcard?.id, flashcard?.cloze]
    ),
    onEditClozeCard: React.useCallback(
      (clozeIndex, ranges) => {
        if (flashcard)
          dispatch(
            actions.editClozeDeletion(
              flashcard.id,
              flashcard.cloze,
              clozeIndex,
              ranges
            )
          )
      },
      [dispatch, flashcard?.id, flashcard?.cloze]
    ),
    onDeleteClozeCard: React.useCallback(
      (clozeIndex) => {
        if (flashcard)
          dispatch(
            actions.removeClozeDeletion(
              flashcard.id,
              flashcard.cloze,
              clozeIndex
            )
          )
      },
      [dispatch, flashcard?.id, flashcard?.cloze]
    ),
  })

  const onEditorKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === KEYS.enter && clozeControls.clozeIndex !== -1) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    [clozeControls.clozeIndex]
  )

  if (!metadata || !editing || !flashcard) return null

  const mediaIsPlaying = Boolean(playerRef.current && !playerRef.current.paused)

  return (
    <div className={css.editorOverlay} onKeyDown={onEditorKeyDown}>
      <div className={css.editorOverlayInner}>
        <FlashcardSectionForm
          className={cn(css.form)}
          mediaFile={metadata}
          flashcard={flashcard}
          clipId={flashcard.id}
          mediaIsPlaying={mediaIsPlaying}
          autofocusFieldName={'transcription'}
          clozeControls={clozeControls}
        />
      </div>
      {/* button zone */}
      {/* <section className={css.editorTopMenu}>
        {(flashcard?.fields.transcription || '').trim() && (
          <ClozeButtons controls={clozeControls} />
        )}
        {clozeControls.clozeIndex !== -1 && (
          <div className={css.editorTopHint}>
            select text and press 'Enter' to create cloze deletion
          </div>
        )}
      </section> */}
      <section className={css.menu}>
        <Tooltip
          title={`Show card preview + cloze deletions (${getKeyboardShortcut(
            'Stop editing fields'
          )})`}
        >
          <IconButton onClick={handleClickPreviewButton}>
            <ShortTextTwoTone />
          </IconButton>
        </Tooltip>
      </section>

      <section className={css.secondaryMenu}>
        <Tooltip title={`Loop selection (${getKeyboardShortcut('Toggle loop')})`}>
          <IconButton onClick={toggleLoop} color={isLoopOn ? 'secondary' : 'default'}>
            <Loop />
          </IconButton>
        </Tooltip>{' '}
        <Tooltip title="Delete clip and card">
          <IconButton onClick={handleClickDeleteButton} id={$.deleteButton}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </section>
    </div>
  )
}
