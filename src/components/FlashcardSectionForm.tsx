import {
  useCallback,
  useState,
  useEffect,
  memo,
  useRef,
  FormEventHandler,
} from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { TextField, InputLabel } from '@mui/material'
import cn from 'clsx'
import r from '../redux'
import css from './FlashcardSection.module.css'
import displayCss from './FlashcardSectionDisplay.module.css'
import { getNoteTypeFields } from '../utils/noteType'
import TagsInput from './TagsInput'
import VideoStillDisplay from './FlashcardSectionFormVideoStill'
import { actions } from '../actions'
import Field, {
  Props as FlashcardFormFieldProps,
} from './FlashcardSectionFormField'
import { getYomitan2AnkiTemplate } from '../selectors/settings'
import ClozeField from './FlashcardSectionDisplayClozeField'

import { flashcardSectionForm$ as $ } from './FlashcardSectionForm.testLabels'

const fieldContainerLabels = {
  transcription: $.transcriptionField,
  pronunciation: $.pronunciationField,
  meaning: $.meaningField,
  notes: $.notesField,
} as const

const FIELD_INPUT_PROPS = {
  style: { minHeight: '20px' },
}

const FlashcardSectionForm = memo(
  ({
    className,
    mediaFile,
    mediaIsPlaying,
    autofocusFieldName,
    flashcard,
    clozeControls,
  }: {
    className?: string
    mediaFile: MediaFile
    clipId: ClipId
    flashcard: Flashcard
    mediaIsPlaying: boolean
    autofocusFieldName: FlashcardFieldName
    clozeControls?: ReturnType<typeof import('../utils/clozeField/useClozeControls').default>
  }) => {
    const {
      allTags,
      currentNoteType,
      isLoopOn,
      subtitlesFlashcardFieldLinks,
      subtitles,
      viewMode,
    } = useSelector((state: AppState) => ({
      allTags: r.getAllTags(state),
      currentNoteType: r.getCurrentNoteType(state),
      isLoopOn: r.getLoopState(state),
      subtitlesFlashcardFieldLinks: r.getSubtitlesFlashcardFieldLinks(state),
      subtitles: r.getSubtitlesFilesWithTracks(state),
      viewMode: state.settings.viewMode,
    }))
    const { id } = flashcard

    const dispatch = useDispatch()

    const focusRef = useRef<HTMLInputElement>()

    // focus first field on highlight clip
    // and, while playing, trigger loop during further field/button interactions
    const [initialFocus, setInitialFocusComplete] = useState(false)
    const loopOnInteract = useCallback(() => {
      if (mediaIsPlaying && !isLoopOn) dispatch(actions.setLoop('EDIT'))
    }, [dispatch, isLoopOn, mediaIsPlaying])

    useEffect(() => {
      setInitialFocusComplete(false)
    }, [id])
    useEffect(() => {
      if (!initialFocus) {
        focusRef.current && focusRef.current.focus()
        if (mediaIsPlaying) setInitialFocusComplete(true)
      }
    }, [mediaIsPlaying, initialFocus])
    const handleFocus = useCallback(() => {
      if (!initialFocus) setInitialFocusComplete(true)
      else loopOnInteract()
    }, [initialFocus, loopOnInteract])

    

    const handleFlashcardSubmit: FormEventHandler = useCallback((e) => {
      e.preventDefault()
    }, [])

    const setFlashcardText: FlashcardFormFieldProps['setFlashcardText'] =
      useCallback(
        (key, text, caretLocation) =>
          dispatch(actions.setFlashcardField(id, key, text, caretLocation)),
        [dispatch, id]
      )

    const onAddChip = useCallback(
      (text: string) => dispatch(actions.addFlashcardTag(id, text)),
      [dispatch, id]
    )
    const onDeleteChip = useCallback(
      (index: number, text: string) =>
        dispatch(actions.deleteFlashcardTag(id, index, text)),
      [dispatch, id]
    )

    const fieldProps = {
      currentFlashcard: flashcard,
      setFlashcardText: setFlashcardText,
      mediaFileId: mediaFile.id,
      inputProps: FIELD_INPUT_PROPS,
      onKeyPress: loopOnInteract,
    }

    const tmpl = useSelector((state: AppState) => getYomitan2AnkiTemplate(state))
    const defaultFieldNames = currentNoteType
      ? getNoteTypeFields(currentNoteType)
      : []
    const templateKeys = (tmpl?.templateParams || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const unionKeys = Array.from(
      new Set<string>([...templateKeys, ...Object.keys(flashcard.fields as any)])
    )
    const extraFieldKeys = unionKeys.filter(
      (k) => k && !defaultFieldNames.includes(k as any)
    )

    return (
      <form
        className={cn(className, {
          [css.horizontalForm]: viewMode === 'HORIZONTAL',
        })}
        onSubmit={handleFlashcardSubmit}
        id={$.container}
      >
        <section
          className={cn(css.formTop, {
            [css.horizontalFormTop]: viewMode === 'HORIZONTAL',
          })}
        >
          {mediaFile.isVideo && (
            <VideoStillDisplay
              flashcard={flashcard}
              videoFile={mediaFile}
              onFocus={handleFocus}
              height={viewMode === 'HORIZONTAL' ? 120 : 85}
            />
          )}
        </section>
        <section className={css.formBody}>
          {currentNoteType &&
            getNoteTypeFields(currentNoteType).map((fieldName, i) => {
              const linkedTrackId =
                subtitlesFlashcardFieldLinks[fieldName] || null
              if (
                fieldName === 'transcription' &&
                clozeControls &&
                clozeControls.clozeIndex !== -1
              ) {
                const labelText = (() => {
                  const track = subtitles.all.find((s) => s.id === linkedTrackId)
                  return track
                    ? `${capitalize(fieldName)} (${track.label})`
                    : capitalize(fieldName)
                })()
                return (
                  <section
                    key={`${fieldName}_${flashcard.id}`}
                    className={cn(css.field, displayCss.previewField)}
                  >
                    <InputLabel shrink margin="dense">
                      {labelText}
                    </InputLabel>
                    <ClozeField
                      className={cn(
                        fieldContainerLabels[fieldName],
                        displayCss.previewFieldTranscription
                      )}
                      fieldName={fieldName as any}
                      subtitles={mediaFile.subtitles}
                      linkedTracks={subtitlesFlashcardFieldLinks}
                      mediaFileId={mediaFile.id}
                      value={String((flashcard.fields as any)[fieldName] || '')}
                      clozeControls={clozeControls}
                    />
                  </section>
                )
              }
              return (
                <Field
                  key={`${fieldName}_${flashcard.id}`}
                  name={fieldName}
                  subtitles={subtitles}
                  linkedSubtitlesTrack={linkedTrackId}
                  onFocus={!initialFocus && i === 0 ? () => {} : handleFocus}
                  className={fieldContainerLabels[fieldName]}
                  {...fieldProps}
                />
              )
            })}
          {extraFieldKeys.map((k) => (
            <section key={`${k}_${flashcard.id}`} className={css.field}>
              <TextField
                className={$.flashcardFields}
                inputProps={{
                  ...FIELD_INPUT_PROPS,
                  style: {
                    ...(FIELD_INPUT_PROPS.style || {}),
                    maxHeight: '4.5em',
                    overflow: 'auto',
                  },
                }}
                onChange={(e) => {
                  const caret = (e.target as HTMLInputElement).selectionEnd || 0
                  dispatch(actions.setFlashcardField(id, k, e.target.value, caret))
                }}
                onKeyPress={loopOnInteract}
                onFocus={handleFocus}
                name={k}
                value={String((flashcard.fields as any)[k] || '')}
                fullWidth
                multiline
                maxRows={3}
                margin="dense"
                label={capitalize(k)}
                placeholder={k}
              />
            </section>
          ))}
          <TagsInput
            options={allTags}
            tags={flashcard.tags}
            onAddChip={onAddChip}
            onDeleteChip={(i) => onDeleteChip(i, flashcard.tags[i])}
          />
        </section>

        
      </form>
    )
  }
)

export const capitalize = (string: string) =>
  string.substring(0, 1).toUpperCase() + string.slice(1)

export default FlashcardSectionForm
