// better to keep this lenient
// as strict changes will force
// migrations in redux-persist.

declare type SettingsState = {
  mediaFolderLocation: string | null
  assetsDirectories: string[]
  checkForUpdatesAutomatically: boolean
  viewMode: ViewMode
  activeDictionaries?: { id: FileId; type: DictionaryFileType }[]
  youmitan2AnkiTemplate?: {
    templateName: string
    modelNames: string
    templateParams: string
  }
  youmitan2AnkiTemplateEnabled?: boolean
}

declare type ViewMode = 'HORIZONTAL' | 'VERTICAL'
