import React, { useState, useCallback, MouseEventHandler } from 'react'
import { Card, CardContent } from '@mui/material'
import css from './KeyboardShortcuts.module.css'

const getKeyboardShortcuts = (platform: Window['electronApi']['platform']) =>
({
  'Play/pause': `${platform === 'win32' ? 'Ctrl' : 'Shift'} + Space`,
  'Toggle loop': 'Ctrl + L',
  'Stop looping': 'Esc',
  'Select previous': '←',
  'Select next': '→',
  'Select previous (while editing)': 'Alt + ←',
  'Select next (while editing)': 'Alt + →',
  'Look up word at mouse cursor': 'D',
  'Close dictionary popover': 'Esc',
  'Start editing fields': 'E',
  'Delete clip and card': 'Ctrl + Shift + D',
  'Stop editing fields': 'Esc',
  'Start making cloze deletion (fill-in-blank)': `${platform === 'win32' ? 'Ctrl' : 'Cmd'} + F`,
  'Stop making cloze deletion (fill-in-blank)': 'Q',
  'Save project': 'Cmd + S',
  'Toggle subtitle track 1 (video)': '1',
  'Toggle subtitle track 2 (video)': '2',
  'Toggle subtitle track 3 (video)': '3',
  'Toggle subtitle track N (video)': 'N (1-9)',
  'Show all subtitles (waveform)': 'Shift + 1',
  'Hide meaning (waveform)': 'Shift + 2',
  'Hide transcription (waveform)': 'Shift + 3',
  'Hide both (waveform)': 'Shift + 4',
} as const)

type KeyboardShortcuts = ReturnType<typeof getKeyboardShortcuts>

export function getKeyboardShortcut(action: keyof KeyboardShortcuts) {
  const platform = window.electronApi.platform
  const CtrlCmd = platform === 'darwin' ? '⌘' : 'Ctrl'
  return getKeyboardShortcuts(platform)[action].replace('Cmd', CtrlCmd)
}

const Shortcut = ({ action }: { action: keyof KeyboardShortcuts }) => (
  <p className={css.shortcut}>
    <span className={css.keyCombination}>{getKeyboardShortcut(action)}</span>
    <span className={css.action}>{action}</span>
  </p>
)

const KeyboardShortcuts = () => {
  const [open, setOpen] = useState(false)
  const handleMouseDown: MouseEventHandler = useCallback(
    (e) => {
      setOpen((open) => !open)
      if (!open) e.preventDefault()
    },
    [setOpen, open]
  )
  const handleFocus = useCallback(() => setOpen(true), [setOpen])
  const handleBlur = useCallback(() => setOpen(false), [setOpen])
  return (
    <section
      className={css.container}
      onMouseDown={handleMouseDown}
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {open ? (
        <Card>
          <CardContent className={css.card}>
            <h3 className={css.heading}>Media</h3>
            <section className={css.group}>
              <Shortcut action="Play/pause" />
              <Shortcut action="Toggle loop" />
              <Shortcut action="Stop looping" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Navigate between clips/subtitles</h3>
              <Shortcut action="Select previous" />
              <Shortcut action="Select next" />
              <Shortcut action="Select previous (while editing)" />
              <Shortcut action="Select next (while editing)" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Dictionary</h3>
              <Shortcut action="Look up word at mouse cursor" />
              <Shortcut action="Close dictionary popover" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Editing flashcards</h3>
              <Shortcut action="Start editing fields" />
              <Shortcut action="Stop editing fields" />
              <Shortcut action="Start making cloze deletion (fill-in-blank)" />
              <Shortcut action="Stop making cloze deletion (fill-in-blank)" />
              <Shortcut action="Delete clip and card" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Project</h3>
              <Shortcut action="Save project" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Video Subtitle Tracks</h3>
              <Shortcut action="Toggle subtitle track 1 (video)" />
              <Shortcut action="Toggle subtitle track 2 (video)" />
              <Shortcut action="Toggle subtitle track 3 (video)" />
              <Shortcut action="Toggle subtitle track N (video)" />
            </section>

            <section className={css.group}>
              <h3 className={css.heading}>Waveform Subtitle Visibility</h3>
              <Shortcut action="Show all subtitles (waveform)" />
              <Shortcut action="Hide meaning (waveform)" />
              <Shortcut action="Hide transcription (waveform)" />
              <Shortcut action="Hide both (waveform)" />
            </section>
          </CardContent>
        </Card>
      ) : (
        <span className={css.closed}>Keyboard shortcuts</span>
      )}
    </section>
  )
}

export default KeyboardShortcuts
