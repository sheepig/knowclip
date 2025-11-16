import React, { ReactChild } from 'react'
import { useSelector } from 'react-redux'
import cn from 'clsx'
import css from './FlashcardSectionDisplay.module.css'
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
                enableDictionaryHover={false}
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
            enableDictionaryHover={false}
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
            className={cn({
              [css.meaningHidden]: (useSelector((state: AppState) => state.settings.meaningHidden) || false),
            })}
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
        {String((useSelector((state: AppState) => (state.settings as any)?.youmitan2AnkiTemplate?.templateParams) || ''))
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => (
            ((fields as any)[name] || '').trim() ? (
              <FlashcardDisplayField
                key={`custom_${name}`}
                fieldName={name as any}
                subtitles={mediaFile.subtitles}
                linkedTracks={fieldsToTracks}
                mediaFileId={mediaFile.id}
                onDoubleClick={onDoubleClickField}
                title={fieldHoverText}
                className={cn(css.previewFieldNotes)}
              >
                {(fields as any)[name]}
              </FlashcardDisplayField>
            ) : null
          ))}
        {('dictionary' in (fields as any)) && (fields as any).dictionary && (
          <FlashcardDisplayField
            fieldName={'dictionary' as any}
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={'Dictionary entries'}
            className={cn(css.previewFieldNotes)}
          >
            {(fields as any).dictionary}
          </FlashcardDisplayField>
        )}
      </section>

      <section className={css.secondaryMenu}>
        <div className={css.actionsRow}>
          {secondaryMenuItems}
          <span className={css.menuDivider} />
          {menuItems}
        </div>
      </section>
    </section>
  )
}

export default FlashcardSectionDisplay
