import React, { ReactChild } from 'react'
import cn from 'clsx'
import css from './FlashcardSectionDisplay.module.css'
import { useSelector } from 'react-redux'
import { getYomitan2AnkiTemplate } from '../selectors/settings'
import { TransliterationFlashcardFields } from '../types/Project'
import FlashcardDisplayField from './FlashcardSectionDisplayField'
import { ClozeControls } from '../utils/clozeField/useClozeControls'
import ClozeField from './FlashcardSectionDisplayClozeField'

const empty: ClozeDeletion[] = []

const FlashcardSectionDisplay = ({
  mediaFile,
  fieldsToTracks,
  fields,
  viewMode,
  className,
  onDoubleClickField,
  fieldHoverText,
  clozeControls,
  menuItems,
  secondaryMenuItems,
}: {
  fields: TransliterationFlashcardFields
  viewMode: ViewMode
  mediaFile: MediaFile
  fieldsToTracks: SubtitlesFlashcardFieldsLinks
  className?: string
  onDoubleClickField?: (fn: TransliterationFlashcardFieldName) => void
  fieldHoverText?: string
  clozeControls?: ClozeControls
  menuItems: ReactChild
  secondaryMenuItems?: ReactChild
}) => {
  const {
    clozeIndex = -1,
    deletions: clozeDeletions = empty,
    inputRef: fieldValueRef,
  } = clozeControls || {}

  const tmpl = useSelector((state: AppState) => getYomitan2AnkiTemplate(state))
  const tmplKeys = (tmpl?.templateParams || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const TMPL_MARKER = 'TEMPLATE_PARAMS_JSON:'
  const tmplObj = (() => {
    const v: Record<string, string> = {}
    tmplKeys.forEach((k) => (v[k] = String((fields as any)[k] || '')))
    return v
  })()

  return (
    <section
      className={cn(css.container, className, {
        [css.horizontalPreview]: viewMode === 'HORIZONTAL',
      })}
    >
      <section className={cn(css.previewFields)}>
        {clozeDeletions &&
        fieldValueRef &&
        (fields.transcription || '').trim() ? (
          <div
            className={cn(css.clozeField, {
              [css.clozeFieldEditing]: clozeIndex !== -1,
            })}
          >
            {clozeControls && (
              <ClozeField
                className={css.previewFieldTranscription}
                fieldName={'transcription'}
                subtitles={mediaFile.subtitles}
                linkedTracks={fieldsToTracks}
                mediaFileId={mediaFile.id}
                value={fields.transcription}
                clozeControls={clozeControls}
              />
            )}
          </div>
        ) : (
          <FlashcardDisplayField
            fieldName="transcription"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={cn(css.previewFieldTranscription)}
            fieldValueRef={fieldValueRef}
          >
            {fields.transcription || null}
          </FlashcardDisplayField>
        )}
        {'pronunciation' in fields && fields.pronunciation && (
          <FlashcardDisplayField
            fieldName="pronunciation"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={css.previewFieldPronunciation}
          >
            {fields.pronunciation}
          </FlashcardDisplayField>
        )}
        <FlashcardDisplayField
          fieldName="meaning"
          subtitles={mediaFile.subtitles}
          linkedTracks={fieldsToTracks}
          mediaFileId={mediaFile.id}
          onDoubleClick={onDoubleClickField}
          title={fieldHoverText}
        >
          {fields.meaning || null}
        </FlashcardDisplayField>
        {fields.notes && (
          <FlashcardDisplayField
            fieldName="notes"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={cn(css.previewFieldNotes)}
          >
            {fields.notes}
          </FlashcardDisplayField>
        )}
        {tmplKeys.length ? (
          <div>
            {tmplKeys.map((k) => (
              <div key={k}>
                {k}: {String((tmplObj as any)[k] || '')}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className={css.menu}>{menuItems}</section>
      <section className={css.secondaryMenu}>{secondaryMenuItems}</section>
    </section>
  )
}

export default FlashcardSectionDisplay
