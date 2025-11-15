import { filter, map, mergeMap, switchMap, takeUntil, catchError } from 'rxjs/operators'
import { fromEvent, from, of, merge, EMPTY } from 'rxjs'
import { combineEpics, ofType } from 'redux-observable'
import r from '../redux'
import A from '../types/ActionType'
import { KEYS } from '../utils/keyboard'
import { getMetaOrCtrlKey } from '../components/FlashcardSectionDisplayClozeField'
import { isTextFieldFocused } from '../utils/isTextFieldFocused'

const keydownEpic: AppEpic = (action$, state$, effects) =>
  fromEvent<KeyboardEvent>(window, 'keydown').pipe(
    mergeMap((event) => {
      const { ctrlKey, key } = event

      if (key.toLowerCase() === KEYS.tLowercase && !isTextFieldFocused()) {
        event.preventDefault()
        const links = r.getSubtitlesFlashcardFieldLinks(state$.value)
        const trackId = links.meaning
        if (trackId) {
          const track = r.getSubtitlesTrack(state$.value, trackId)
          return of(
            track && track.mode === 'showing'
              ? r.hideSubtitles(trackId)
              : r.showSubtitles(trackId)
          )
        }
        return EMPTY
      }

      if (key.toLowerCase() === KEYS.yLowercase && !isTextFieldFocused()) {
        event.preventDefault()
        const links = r.getSubtitlesFlashcardFieldLinks(state$.value)
        const trackId = links.transcription
        if (!trackId) return EMPTY
        const track = r.getSubtitlesTrack(state$.value, trackId)
        if (!track) return EMPTY
        const currentMs = Math.floor(effects.getCurrentTime() * 1000)
        const chunk = track.chunks.find(
          (c) => currentMs >= c.start && currentMs <= c.end
        )
        if (!chunk || !chunk.text) return EMPTY
        const text = chunk.text
        const write = navigator.clipboard?.writeText
        if (typeof write === 'function') {
          return from(write(text)).pipe(
            map(() => r.simpleMessageSnackbar('Copied subtitle to clipboard')),
            catchError(() => of(r.simpleMessageSnackbar('Copy failed')))
          )
        }
        try {
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
          return of(r.simpleMessageSnackbar('Copied subtitle to clipboard'))
        } catch (err) {
          return of(r.simpleMessageSnackbar('Copy failed'))
        }
      }

      if (
        key.toLowerCase() === KEYS.lLowercase &&
        (ctrlKey || !isTextFieldFocused())
      )
        return of(r.toggleLoop('KEYBOARD'))

      if (
        key.toLowerCase() === KEYS.eLowercase &&
        !isTextFieldFocused() &&
        !(
          r.getHighlightedClipId(state$.value) &&
          r.isUserEditingCards(state$.value)
        )
      ) {
        event.preventDefault()
        return of(r.startEditingCards())
      }
      const playPauseForceKey =
        window.electronApi.platform === 'win32' ? 'ctrlKey' : 'shiftKey'

      if (
        (key === KEYS.space || key === KEYS.process) &&
        (event[playPauseForceKey] || !isTextFieldFocused())
      ) {
        event.preventDefault()
        if (
          !(
            document.activeElement &&
            document.activeElement === effects.getMediaPlayer()
          )
        )
          effects.toggleMediaPaused()
        return EMPTY
      }

      if (key === KEYS.escape) {
        if (r.getCurrentDialog(state$.value) || (window as any).cloze)
          return of({ type: 'NOOP_ESC_KEY' } as unknown as Action)

        if (
          r.getHighlightedClipId(state$.value) &&
          state$.value.session.editingCards
        )
          return from([
            ...(r.getLoopState(state$.value) ? [r.setLoop(false)] : []),
            r.stopEditingCards(),
          ])

        if (state$.value.session.dictionaryPopoverIsOpen) {
          return from([r.closeDictionaryPopover()])
        }

        const mediaIsPlaying = effects.isMediaPlaying()
        const currentTime = effects.getCurrentTime()

        if (
          mediaIsPlaying &&
          r.getClipIdAt(state$.value, currentTime * 1000) ===
            r.getHighlightedClipId(state$.value)
        )
          return of(r.setLoop(false))

        return EMPTY
      }

      if (key === KEYS.dUppercase && ctrlKey) {
        const highlightedClipId = r.getHighlightedClipId(state$.value)
        event.preventDefault()
        return highlightedClipId ? of(r.deleteCard(highlightedClipId)) : EMPTY
      }

      return EMPTY
    })
  )

const saveKey = (window: Window) =>
  merge(
    fromEvent<KeyboardEvent>(window, 'keydown').pipe(
      filter((e) => {
        const { key } = e
        return key.toLowerCase() === KEYS.sLowercase && getMetaOrCtrlKey(e)
      })
    )
  )

const saveEpic: AppEpic = (action$, state$, { window }) =>
  action$.pipe(
    ofType(A.openProject as const),
    switchMap(() =>
      saveKey(window).pipe(
        map(({ shiftKey }) =>
          shiftKey ? r.saveProjectAsRequest() : r.saveProjectRequest()
        ),
        takeUntil(action$.pipe(ofType(A.closeProject as const)))
      )
    )
  )

export default combineEpics(keydownEpic, saveEpic)
