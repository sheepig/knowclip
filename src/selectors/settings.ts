export const getMediaFolderLocation = (state: AppState): string | null =>
  state.settings.mediaFolderLocation

export const getAssetsDirectories = (state: AppState): string[] =>
  state.settings.assetsDirectories

export const getYomitan2AnkiTemplate = (state: AppState) =>
  state.settings.youmitan2AnkiTemplate || {
    templateName: 'Knowclip',
    modelNames: 'Knowclip-Default',
    templateParams: '{}',
  }

export const isYomitan2AnkiTemplateEnabled = (state: AppState) =>
  Boolean(state.settings.youmitan2AnkiTemplateEnabled)
