import React, { useCallback, useEffect, useReducer } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  FormControl,
  List,
  ListItem,
  ListItemText,
  DialogTitle,
  ListItemSecondaryAction,
  Paper,
  MenuItem,
  ListItemIcon,
  FormControlLabel,
  Checkbox,
  TextField,
} from '@mui/material'
import { actions } from '../../actions'
import * as selectors from '../../selectors'
import { DialogProps } from './DialogProps'
import reducer from '../../reducers/settings'
import FilePathTextField from '../FilePathTextField'
import {
  openInBrowser,
  showOpenDirectoriesDialog,
} from '../../mockable/electron'
import css from './SettingsDialog.module.css'
import { Delete, Add } from '@mui/icons-material'
import truncate from '../../utils/truncate'
import { displayDictionaryType } from '../../selectors'
import { ImportInterruptedListIcon } from './DictionariesDialog'

import { settingsDialog$ as $ } from './SettingsDialog.testLabels'

const SettingsDialog = ({ open }: DialogProps<SettingsDialogData>) => {
  const dispatch = useDispatch()

  const { dictionaryFiles } = useSelector((state: AppState) => ({
    dictionaryFiles: selectors.getOpenDictionaryFiles(state),
  }))

  const { settings, dispatchLocal } = useLocalSettingsReducer({
    listenToUpstreamUpdates: false,
  })
  const addAssetsDirectories = useCallback(async () => {
    const paths = await showOpenDirectoriesDialog()
    if (!paths) return

    dispatchLocal(actions.addAssetsDirectories(paths))
  }, [dispatchLocal])

  const close = useCallback(() => dispatch(actions.closeDialog()), [dispatch])
  const saveSettings = useCallback(() => {
    dispatch(actions.overrideSettings(settings))
    close()
  }, [close, dispatch, settings])

  return (
    <Dialog open={open} fullScreen className={$.container}>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent className={css.container}>
        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Media import folders</h3>
            <List>
              {settings.assetsDirectories.map((path) => {
                return (
                  <ListItem key={path} dense>
                    <ListItemText primary={truncate(path, 100)} title={path} />
                    <ListItemSecondaryAction>
                      <RemoveAssetsDirectoryButton
                        path={path}
                        removeAssetsDirectory={(path) =>
                          dispatchLocal(actions.removeAssetsDirectories([path]))
                        }
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                )
              })}
              <MenuItem onClick={addAssetsDirectories}>
                <ListItemIcon>
                  <Add />
                </ListItemIcon>
                <ListItemText>Add folder</ListItemText>
              </MenuItem>
            </List>
          </Paper>

          <section className={css.settingsGroupDescription}>
            <p>
              Next time you try opening a file that was recently moved, Knowclip
              will search in these folders automatically for it.
            </p>

            <p>
              Only the contents of folders list here will be searched. Any
              subfolders within them won't be included.
            </p>
          </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Media export folder</h3>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <FilePathTextField
                value={settings.mediaFolderLocation || ''}
                onSetFilePath={useCallback(
                  (filePath) =>
                    dispatchLocal(actions.setMediaFolderLocation(filePath)),
                  [dispatchLocal]
                )}
                placeholderText="Click to set location"
              />
            </FormControl>
          </Paper>

          <section className={css.settingsGroupDescription}>
            <p>
              This should be the location of your{' '}
              <a
                href="https://apps.ankiweb.net/docs/manual.html#files"
                onClick={openInBrowser}
              >
                Anki collection.media folder
              </a>
              , or wherever you'd like your exported mp3 and image files to be
              saved.
            </p>
            <p>(Does not apply to Anki deck .apkg exports.)</p>
          </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Mediaconversion</h3>
            <FormControl className={css.formControl} fullWidth margin="normal">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.warnBeforeConvertingMedia}
                    onChange={(e) =>
                      dispatchLocal(
                        actions.setWarnBeforeConvertingMedia(e.target.checked)
                      )
                    }
                    color="primary"
                  />
                }
                label="Ask before converting media files for compatibility with Knowclip"
              />
            </FormControl>
          </Paper>
          <section className={css.settingsGroupDescription}>
            <p>
              Check this box if you want to be asked before Knowclip converts
              media files to a format that it can read. Knowclip will NOT modify
              your original files! However, this processing can slow down
              playback inside Knowclip.
            </p>
            <p>
              To avoid having to convert files, it is recommended to use files
              with the video codec H.264 and the audio codec AAC. If your media
              files are in a different format, it may be possible convert them
              to a compatible format using external tools.
            </p>
          </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Software updates</h3>
            <FormControl className={css.formControl} fullWidth margin="normal">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.checkForUpdatesAutomatically}
                    onChange={(e) =>
                      dispatchLocal(
                        actions.setCheckForUpdatesAutomatically(
                          e.target.checked
                        )
                      )
                    }
                    color="primary"
                  />
                }
                label="Check for updates on automatically on startup"
              />
            </FormControl>
          </Paper>

          <section className={css.settingsGroupDescription}>
            <p>
              Check this box if you want to be notified when you're running
              outdated software. Knowclip will check for updates over the
              network each time you open the app.
            </p>
          </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Pop-up dictionary</h3>
            <List>
              {!dictionaryFiles.length && (
                <ListItem value={undefined}>
                  You haven't imported any dictionaries yet.
                </ListItem>
              )}
              {dictionaryFiles.map(({ file }) => {
                const activeDictionaries = settings.activeDictionaries || []
                console.log({ activeDictionaries, settings })
                const selected =
                  Boolean(activeDictionaries) &&
                  activeDictionaries.some(
                    (f) => f.id === file.id && f.type === file.dictionaryType
                  )
                return (
                  <ListItem value={file.id} selected={selected} key={file.id}>
                    {!file.importComplete && <ImportInterruptedListIcon />}
                    <ListItemIcon>
                      <Checkbox
                        checked={selected}
                        tabIndex={-1}
                        onChange={() =>
                          dispatchLocal(
                            selected
                              ? actions.removeActiveDictionary(file.id)
                              : actions.addActiveDictionary(
                                  file.id,
                                  file.dictionaryType
                                )
                          )
                        }
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${displayDictionaryType(file.dictionaryType)}`}
                      secondary={file.name}
                    />
                  </ListItem>
                )
              })}
            </List>
            <p style={{ margin: '1em' }}>
              <Button onClick={() => dispatch(actions.dictionariesDialog())}>
                Manage dictionaries
              </Button>
            </p>
          </Paper>

        <section className={css.settingsGroupDescription}>
          <p>
            Import a free dictionary so you can look up words quickly inside
            the Knowclip app.
          </p>
          <p>
            Dictionaries aren't bundled with Knowclip automatically because
            they take up lots of disk space. You may import a free dictionary
            of your choice, according to your needs.
          </p>
          <p style={{ color: 'red', fontSize: '0.85em' }}>
            build-in dictionaries are not working
          </p>
        </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Yomichan → Anki template</h3>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                value={settings.youmitan2AnkiTemplate?.templateName || ''}
                onChange={useCallback(
                  (e) =>
                    dispatchLocal(
                      actions.overrideSettings({
                        youmitan2AnkiTemplate: {
                          ...settings.youmitan2AnkiTemplate,
                          templateName: e.target.value,
                        },
                      })
                    ),
                  [dispatchLocal, settings.youmitan2AnkiTemplate]
                )}
                placeholder="Template deck name (deckNames)"
              />
            </FormControl>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                value={settings.youmitan2AnkiTemplate?.templateParams || ''}
                onChange={useCallback(
                  (e) =>
                    dispatchLocal(
                      actions.overrideSettings({
                        youmitan2AnkiTemplate: {
                          ...settings.youmitan2AnkiTemplate,
                          templateParams: e.target.value,
                        },
                      })
                    ),
                  [dispatchLocal, settings.youmitan2AnkiTemplate]
                )}
                placeholder="Template fields (comma-separated)"
              />
            </FormControl>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                value={settings.youmitan2AnkiTemplate?.modelNames || ''}
                onChange={useCallback(
                  (e) =>
                    dispatchLocal(
                      actions.overrideSettings({
                        youmitan2AnkiTemplate: {
                          ...settings.youmitan2AnkiTemplate,
                          modelNames: e.target.value,
                        },
                      })
                    ),
                  [dispatchLocal, settings.youmitan2AnkiTemplate]
                )}
                placeholder="Enter local Anki model name"
              />
            </FormControl>
          </Paper>
          <section className={css.settingsGroupDescription}>
            <p>
              Configure the template name and fields used by the local AnkiConnect simulation. If both fields are empty, the simulation will be disabled.
            </p>
            <p>
              After configuring and mapping Yomichan deck and Anki note fields, the local AnkiConnect simulation can intercept dictionary content and add it to your created cards. This feature requires app restart, and Anki must not be running.
            </p>
          </section>
        </section>
      </DialogContent>

      <DialogActions>
        <Button onClick={close} id={$.cancelButton} color="primary">
          Cancel
        </Button>
        <Button
          onClick={saveSettings}
          id={$.saveButton}
          type="submit"
          color="primary"
        >
          Save settings
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function useLocalSettingsReducer({
  listenToUpstreamUpdates,
}: {
  listenToUpstreamUpdates: boolean
}) {
  const { originalSettingsState } = useSelector((state: AppState) => ({
    originalSettingsState: state.settings,
  }))

  const [settings, dispatchLocal] = useReducer(reducer, originalSettingsState)

  useEffect(() => {
    if (listenToUpstreamUpdates) {
      dispatchLocal(actions.overrideSettings(originalSettingsState))
    }
  }, [originalSettingsState, listenToUpstreamUpdates])

  return {
    settings,
    dispatchLocal,
  }
}

const RemoveAssetsDirectoryButton = ({
  path,
  removeAssetsDirectory,
}: {
  path: string
  removeAssetsDirectory: (path: string) => void
}) => (
  <IconButton onClick={() => removeAssetsDirectory(path)}>
    <Delete />
  </IconButton>
)

export default SettingsDialog
