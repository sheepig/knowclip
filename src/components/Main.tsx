import React, { useCallback, useMemo, useState } from 'react'
import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CircularProgress, Tooltip, IconButton, Select, MenuItem } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import cn from 'clsx'
import Media from '../components/Media'
import {
  Waveform,
  useWaveform,
  WaveformItem,
  sortWaveformItems,
  usePlayButtonSync,
  WAVEFORM_HEIGHT,
  SUBTITLES_CHUNK_HEIGHT,
} from 'clipwave'
// import FlashcardSection from '../components/FlashcardSection'
import Header from '../components/MainHeader'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import DarkTheme from '../components/DarkTheme'
import { HelpOutline } from '@mui/icons-material'
import css from '../components/Main.module.css'
import waveformCss from '../components/Waveform.module.css'
import * as r from '../selectors'
import { actions } from '../actions'
import { setMousePosition } from '../utils/mousePosition'
import 'clipwave/dist/index.css'
import { SubtitlesCardBase } from '../selectors'
import { usePrevious } from '../utils/usePrevious'
import { useWaveformRenderSubtitlesChunk } from './WaveformSubtitlesChunk'
import { waveform$ } from './waveformTestLabels'
import { useWaveformRenderClip } from './WaveformClip'
import { getFreshRegions } from '../epics/getFreshRegions'
import { isWaveformItemSelectable } from '../utils/clipwave/isWaveformItemSelectable'
import { useWaveformEventHandlers } from '../utils/clipwave/useWaveformEventHandlers'
import WaveformOperationsBar from './WaveformOperationsBar'

import { main$ as $ } from './Main.testLabels'
import { CLIPWAVE_ID } from '../utils/clipwave'

const Main = () => {
  const [subtitleVisibility, setSubtitleVisibility] = useState<WaveformSubtitleVisibility>('SHOW_ALL')
  const routeParams = useParams()
  const {
    loop,
    mediaIsEffectivelyLoading,
    currentProject,
    constantBitrateFilePath,
    currentMediaFile,
    subtitles,
    viewMode,
    clipsMap,
    waveformImages,
    subsBases,
    editing,
    currentFileClipsOrder,
    fieldsToTracks,
  } = useSelector((state: AppState) => {
    const currentMediaFile = r.getCurrentMediaFile(state)
    return {
      loop: r.getLoopState(state),
      mediaIsEffectivelyLoading: r.isMediaEffectivelyLoading(state),
      currentProject: r.getCurrentProject(state),
      constantBitrateFilePath: r.getCurrentMediaConstantBitrateFilePath(state),
      currentMediaFile,
      clipsIdsForExport: currentMediaFile
        ? state.clips.idsByMediaFileId[currentMediaFile.id]
        : EMPTY,
      subtitles: r.getSubtitlesFilesWithTracks(state),
      viewMode: state.settings.viewMode,
      waveformImages: r.getWaveformImages(state),
      clipsMap: r.getClipsObject(state),
      currentFileClipsOrder: r.getCurrentFileClipsOrder(state),
      subsBases: r.getSubtitlesCardBases(state),
      editing: r.isUserEditingCards(state),
      fieldsToTracks: r.getSubtitlesFlashcardFieldLinks(state),
    }
  })

  const waveformImagesWithUrls = useMemo(() => {
    return waveformImages.map(
      ({ file: { startSeconds, endSeconds }, path }) => ({
        url: new URL(`file://${path}`).toString(),
        startSeconds,
        endSeconds,
      })
    )
  }, [waveformImages])

  const mediaFileId = currentMediaFile?.id
  const transcriptionTrackId = fieldsToTracks['transcription']
  const meaningTrackId = fieldsToTracks['meaning']

  const visibleTrackIdsCount = useMemo(() => {
    const filtered = subsBases.linkedTrackIds.filter((id) => {
      if (subtitleVisibility === 'SHOW_ALL') return true
      if (subtitleVisibility === 'HIDE_BOTH') {
        if (id === meaningTrackId) return false
      }
      if (subtitleVisibility === 'HIDE_TRANSCRIPTION' && id === transcriptionTrackId)
        return false
      if (subtitleVisibility === 'HIDE_MEANING' && id === meaningTrackId) return false
      return true
    })

    if (
      filtered.length === 0 &&
      subtitleVisibility === 'HIDE_BOTH' &&
      subsBases.linkedTrackIds.length > 0
    ) {
      return 1
    }
    return filtered.length
  }, [
    subsBases.linkedTrackIds,
    subtitleVisibility,
    transcriptionTrackId,
    meaningTrackId,
  ])

  const getWaveformItem = useCallback(
    (id: string): WaveformItem | null => {
      const clip: Clip | null = clipsMap[id] || null
      if (clip && clip.fileId === mediaFileId) return clip

      const subsBase: SubtitlesCardBase | null = subsBases.cardsMap[id]
      if (subsBase) return subsBase

      return null
    },
    [clipsMap, subsBases, mediaFileId]
  )

  useEffect(() => {
    const trackCursor = (e: MouseEvent) => {
      setMousePosition([e.clientX, e.clientY])
    }
    document.addEventListener('mousemove', trackCursor)
    return () => document.removeEventListener('mousemove', trackCursor)
  }, [])

  // Keyboard shortcuts for waveform subtitle visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      // Only trigger with Shift key
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key
      const visibilityModes: WaveformSubtitleVisibility[] = [
        'SHOW_ALL',
        'HIDE_MEANING',
        'HIDE_TRANSCRIPTION',
        'HIDE_BOTH'
      ]

      const num = parseInt(key)
      if (!isNaN(num) && num >= 1 && num <= 4) {
        e.preventDefault()
        setSubtitleVisibility(visibilityModes[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSubtitleVisibility])


  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const waveform = useWaveform({
    getItemFn: getWaveformItem,
    id: CLIPWAVE_ID,
    maxViewportWidth: useWindowInnerWidth(),
  })
  const { onTimeUpdate } = waveform
  const { resetWaveformState } = waveform.actions

  const prevMediaFileId = usePrevious(mediaFileId)
  useEffect(() => {
    if (mediaFileId !== prevMediaFileId) {
      resetWaveformState(
        playerRef.current,
        sortWaveformItems([
          ...currentFileClipsOrder.map((id) => clipsMap[id]),
          ...subsBases.cards,
        ])
      )
    }
  }, [
    clipsMap,
    currentFileClipsOrder,
    mediaFileId,
    prevMediaFileId,
    resetWaveformState,
    subsBases.cards,
  ])

  const handleMediaLoaded = useCallback(
    (player: HTMLVideoElement | HTMLAudioElement | null) => {
      resetWaveformState(
        player,
        sortWaveformItems([
          ...currentFileClipsOrder.map((id) => clipsMap[id]),
          ...subsBases.cards,
        ])
      )
    },
    [clipsMap, currentFileClipsOrder, resetWaveformState, subsBases.cards]
  )
  const { playing: mediaIsPlaying } = usePlayButtonSync(
    waveform.state.pixelsPerSecond,
    playerRef
  )

  const previousSelection = usePrevious(waveform.state.selection)

  const selection = waveform.getSelection()

  const prevSubsBases = usePrevious(subsBases)
  useEffect(() => {
    if (subsBases !== prevSubsBases) {
      const { regions, newSelection } = getFreshRegions(
        currentFileClipsOrder,
        clipsMap,
        subsBases,
        waveform,
        playerRef.current
      )

      waveform.dispatch({
        type: 'SET_REGIONS',
        regions,
        newSelectionRegion: newSelection.regionIndex,
        newSelectionItemId: newSelection.item || undefined,
      })
    }
  }, [
    prevSubsBases,
    subsBases,
    currentFileClipsOrder,
    clipsMap,
    waveform,
    playerRef,
  ])

  const dispatch = useDispatch()

  const { highlightedClipId } = useSelector((state: AppState) => {
    return {
      highlightedClipId: r.getHighlightedClipId(state),
    }
  })

  useEffect(() => {
    if (selection.selection.item !== previousSelection?.item) {
      const newSelection = selection.item
        ? {
          type:
            selection.item.clipwaveType === 'Primary'
              ? ('Clip' as const)
              : ('Preview' as const),
          id: selection.item.id,
        }
        : null

      if (!newSelection && editing) {
        dispatch(actions.stopEditingCards())
      }

      dispatch(actions.selectWaveformItem(newSelection))
    }
  }, [dispatch, editing, previousSelection, selection])

  const { selectPreviousItemAndSeek, selectNextItemAndSeek } = waveform.actions
  const selectPreviousCard = useCallback(() => {
    selectPreviousItemAndSeek(playerRef.current, isWaveformItemSelectable)
  }, [selectPreviousItemAndSeek])
  const selectNextCard = useCallback(() => {
    selectNextItemAndSeek(playerRef.current, isWaveformItemSelectable)
  }, [selectNextItemAndSeek])

  const { handleWaveformDrag, handleClipDrag, handleClipEdgeDrag } =
    useWaveformEventHandlers({
      playerRef,
      dispatch,
      waveform,
      highlightedClipId,
    })

  const renderPrimaryClip = useWaveformRenderClip()
  const renderSecondaryClip = useWaveformRenderSubtitlesChunk(waveform, subtitleVisibility)

  const idFromParams = routeParams.projectId!
  const currentProjectId = currentProject?.id || null
  const closed = useRef(false)
  const prevProjectId = usePrevious(currentProjectId)
  const navigate = useNavigate()
  useEffect(() => {
    if (prevProjectId && !currentProjectId) {
      closed.current = true
      navigate('/')
    }
    if (!closed.current && currentProjectId !== idFromParams) {
      dispatch(actions.openProjectRequestById(idFromParams))
    }
  }, [currentProjectId, dispatch, idFromParams, navigate, prevProjectId])

  return (
    <div className={css.container} id={$.container}>
      <DarkTheme>
        <Header
          currentProjectId={currentProjectId}
          currentMediaFile={currentMediaFile}
          waveform={waveform}
          playerRef={playerRef}
        />
      </DarkTheme>

      <section
        className={cn(css.middle, {
          [css.horizontal]: viewMode === 'HORIZONTAL',
        })}
      >
        {mediaIsEffectivelyLoading ? (
          <div
            className={css.media}
            style={{ alignItems: 'center', margin: '2rem' }}
          >
            <CircularProgress variant="indeterminate" />
          </div>
        ) : (
          <Media
            key={String(constantBitrateFilePath)}
            className={css.media}
            constantBitrateFilePath={constantBitrateFilePath}
            loop={loop}
            metadata={currentMediaFile}
            subtitles={subtitles}
            viewMode={viewMode}
            playerRef={playerRef}
            onMediaLoaded={handleMediaLoaded}
            onTimeUpdate={onTimeUpdate}
          />
        )}

        {/* {currentProject && (
          <FlashcardSection
            mediaFile={currentMediaFile}
            className={css.flashcardSection}
            projectFile={currentProject}
            selectPrevious={selectPreviousCard}
            selectNext={selectNextCard}
            mediaIsPlaying={mediaIsPlaying}
          />
        )} */}
      </section>
      <WaveformOperationsBar
        waveform={waveform}
        playerRef={playerRef as any}
      />
      {currentMediaFile && !mediaIsEffectivelyLoading ? (
        <div style={{ position: 'relative', width: '100%' }}>
          <Waveform
            waveform={waveform}
            playerRef={playerRef}
            key={currentMediaFile.id}
            images={waveformImagesWithUrls}
            onWaveformDrag={handleWaveformDrag}
            onClipDrag={handleClipDrag}
            onClipEdgeDrag={handleClipEdgeDrag}
            renderPrimaryClip={renderPrimaryClip}
            renderSecondaryClip={renderSecondaryClip}
            height={
              WAVEFORM_HEIGHT +
              visibleTrackIdsCount * SUBTITLES_CHUNK_HEIGHT
            }
            style={{ background: 'gray', alignSelf: 'flex-start', width: '100%' }}
          />
          <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 8, alignItems: 'center', zIndex: 10 }}>
            <Select
              value={subtitleVisibility}
              onChange={(e) => setSubtitleVisibility(e.target.value as WaveformSubtitleVisibility)}
              size="small"
              variant="outlined"
              style={{ color: 'white', minWidth: 120, height: 30, background: 'rgba(0,0,0,0.5)' }}
              sx={{
                '.MuiSelect-select': { padding: '4px 24px 4px 8px', fontSize: '0.75rem' },
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                '.MuiSvgIcon-root': { color: 'white' }
              }}
            >
              <MenuItem value="SHOW_ALL">Show All</MenuItem>
              <MenuItem value="HIDE_MEANING">Hide Meaning</MenuItem>
              <MenuItem value="HIDE_TRANSCRIPTION">Hide Transcription</MenuItem>
              <MenuItem value="HIDE_BOTH">Hide Both</MenuItem>
            </Select>
          </div>
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <Tooltip title="Subtitle sentence segmentation follows the subtitles track linked to “transcription”; if the gap between adjacent sentences is smaller than the project’s “merge adjacent gap” threshold, they are treated as a single sentence." placement="left">
              <IconButton size="small" aria-label="Subtitles segmentation info">
                <HelpOutline fontSize="small" style={{ color: '#fff' }} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div
          className={cn(waveformCss.waveformPlaceholder, waveform$.placeholder)}
        />
      )}

      <KeyboardShortcuts />
    </div>
  )
}

const EMPTY: string[] = []

import { WaveformSubtitleVisibility } from '../types/WaveformSubtitleVisibility'

export default Main

function useWindowInnerWidth() {
  const [windowInnerWidth, setWindowInnerWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handleResize = () => {
      setWindowInnerWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return windowInnerWidth
}
