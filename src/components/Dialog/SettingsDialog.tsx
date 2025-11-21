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
    // if (settings.youmitan2AnkiTemplateEnabled)
    //   window.electronApi.invokeMessage({ type: 'startAnkiConnectShim', args: [] })
    // else window.electronApi.invokeMessage({ type: 'stopAnkiConnectShim', args: [] })
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
              <TextField
                fullWidth
                label={'Media folder location'}
                value={settings.mediaFolderLocation || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatchLocal(actions.setMediaFolderLocation(e.target.value))
                }
                placeholder={
                  'The absolute path of anki media folder'
                }
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
          </section>
        </section>

        <section className={css.settingsGroup}>
          <Paper className={css.settingsGroupBody}>
            <h3 className={css.heading}>Yomitan ↔︎ Custom created card</h3>
            <FormControl className={css.formControl} fullWidth margin="normal">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(settings.youmitan2AnkiTemplateEnabled)}
                    onChange={(e) =>
                      {
                        dispatchLocal(
                          actions.overrideSettings({
                            youmitan2AnkiTemplateEnabled: e.target.checked,
                          })
                        )
                      }
                    }
                    color="primary"
                  />
                }
                label="Receive dictionary data from Youmitan (Restart required)"
              />
            </FormControl>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                label="Template name"
                type="text"
                value={settings.youmitan2AnkiTemplate?.templateName || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatchLocal(
                    actions.overrideSettings({
                      youmitan2AnkiTemplate: {
                        ...settings.youmitan2AnkiTemplate,
                        templateName: e.target.value,
                      } as any,
                    })
                  )
                }
                helperText="Anki deckName"
              />
            </FormControl>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                label="Model names (comma-separated)"
                type="text"
                value={settings.youmitan2AnkiTemplate?.modelNames || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatchLocal(
                    actions.overrideSettings({
                      youmitan2AnkiTemplate: {
                        ...settings.youmitan2AnkiTemplate,
                        modelNames: e.target.value,
                      } as any,
                    })
                  )
                }
                helperText="Anki modelNames"
              />
            </FormControl>
            <FormControl className={css.formControl} margin="normal" fullWidth>
              <TextField
                label="Template params (comma-separated)"
                type="text"
                value={settings.youmitan2AnkiTemplate?.templateParams || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatchLocal(
                    actions.overrideSettings({
                      youmitan2AnkiTemplate: {
                        ...settings.youmitan2AnkiTemplate,
                        templateParams: e.target.value,
                      } as any,
                    })
                  )
                }
                helperText="The param key of you input model"
              />
            </FormControl>
          </Paper>
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
