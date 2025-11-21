import 'rxjs' // eslint-disable-line no-unused-vars
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { Conf } from 'electron-conf/renderer'
import App from '../components/App'
import getStore from '../store'
import '../index.css'
import * as Sentry from '@sentry/electron/renderer'
import { init as reactInit } from '@sentry/react'
import ErrorMessage from '../components/ErrorMessage'
import { PersistGate } from 'redux-persist/integration/react'
import { IpcRendererEvent } from '../preload/IpcRendererEvent'
import { actions } from '../actions'
import { compositeSnackbarActions } from '../actions/snackbar'
import { getHighlightedFlashcard } from '../selectors/session'

window.electronApi.listenToIpcRendererMessages(
  (electronIpcRendererEvent, message, payload) => {
    const event = new IpcRendererEvent(
      electronIpcRendererEvent,
      message,
      payload
    )
    window.dispatchEvent(event)
  }
)


const sentryDsn = 'https://bbdc0ddd503c41eea9ad656b5481202c@sentry.io/1881735'
const RESIZE_OBSERVER_ERROR_MESSAGE = 'ResizeObserver loop limit exceeded'
Sentry.init(
  {
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    ignoreErrors: [RESIZE_OBSERVER_ERROR_MESSAGE],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,

    // Capture Replay for 10% of all sessions,
    // plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  },
  reactInit
)

window.document.addEventListener('DOMContentLoaded', () => {
  window.electronApi.listenToTestIpcEvents(
    (moduleId, functionName, newReturnValue, deserializedReturnValue) => {
      const { returnValues } = window.mockedModules[moduleId]

      returnValues[functionName].push(deserializedReturnValue)
      if (window.electronApi.env.VITE_INTEGRATION_DEV)
        window.electronApi.sendToMainProcess({
          type: 'log',
          args: [
            `\n\n\nFunction ${functionName} mocked with: ${JSON.stringify(
              newReturnValue
            )}\n\n\n`,
          ],
        })
    }
  )
})

window.addEventListener('error', (e) => {
  if (e && e.message && e.message.includes(RESIZE_OBSERVER_ERROR_MESSAGE))
    return
  const errorRoot = document.getElementById('errorRoot') as HTMLDivElement
  errorRoot.style.display = 'block'
  const root = createRoot(errorRoot)
  root.render(<ErrorMessage reactError={e} />)
})

render()

async function render() {
  const initialTestStatePromise = window.electronApi.env.VITEST
    ? window.electronApi.sendToMainProcess({
        type: 'getPersistedTestState',
        args: [],
      })
    : undefined

  const initialTestStateResult = await initialTestStatePromise

  if (initialTestStateResult?.error) {
    console.error(initialTestStateResult.error)
    throw new Error('Problem getting persisted test state.')
  } else console.log('initial test state', initialTestStateResult?.value)
  const initialTestState = initialTestStateResult?.value
  const conf = window.electronApi.env.VITEST ? undefined : new Conf()
  const { store, persistor } = getStore(
    initialTestState,
    conf
      ? {
          getItem: async (key: string) => conf.get(key),
          setItem: async (key: string, item: any) => conf.set(key, item),
          removeItem: async (key: string) => conf.delete(key),
        }
      : undefined
  )
  const root = createRoot(document.getElementById('root')!)

  // if (Boolean(store.getState().settings?.youmitan2AnkiTemplateEnabled)) {
  //   window.electronApi.invokeMessage({ type: 'startAnkiConnectShim', args: [] })
  // }

  window.addEventListener('ipc:anki-add-note', (e: Event) => {
    try {
      const payload = (e as any).payload as string
      const data = JSON.parse(payload)
      console.log('ipc:anki-add-note data', data)
      const configuredFields: string[] = Array.isArray(data?.configuredFields)
        ? data.configuredFields
        : []
      const fieldsObj = (data?.note?.fields && typeof data.note.fields === 'object')
        ? data.note.fields
        : {}

      const state = store.getState()
      const editing = state.session.editingCards
      const flashcard = getHighlightedFlashcard(state)
      
      console.log('flashcard', flashcard)
      if (editing && flashcard) {
        const keys = Array.from(new Set([...Object.keys(fieldsObj), ...configuredFields]))
        keys.forEach((k: string) => {
          const v = fieldsObj?.[k]
          if (typeof v === 'undefined') return
          const newValue = String(v)
          if (newValue.trim().length === 0) return
          store.dispatch(actions.setFlashcardField(flashcard.id, k, newValue, 0))
        })
        store.dispatch(
          compositeSnackbarActions.simpleMessageSnackbar(
            `Mapped ${keys.length} fields into current card.`,
            2500
          )
        )
      } else {
        // store for preview to read
        store.dispatch(actions.setYomitanPreviewFields(fieldsObj))
        store.dispatch(compositeSnackbarActions.simpleMessageSnackbar('Received Yomitan add-card, but no card is being edited.', 3000))
      }
    } catch {}
  })

  window.addEventListener('ipc:anki-store-media', (e: Event) => {
    try {
      const payload = (e as any).payload as string
      const data = JSON.parse(payload)
      const sound = String(data?.sound || '')
      const state = store.getState()
      const editing = state.session.editingCards
      const flashcard = getHighlightedFlashcard(state)
      if (editing && flashcard && sound) {
        store.dispatch(actions.setFlashcardField(flashcard.id, 'audio', sound, 0))
        store.dispatch(compositeSnackbarActions.simpleMessageSnackbar('Audio attached to current card.', 2000))
      }
    } catch {}
  })

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        {persistor ? (
          <PersistGate loading={null} persistor={persistor}>
            <App sentryDsn={sentryDsn} />
          </PersistGate>
        ) : (
          <App sentryDsn={sentryDsn} />
        )}
      </Provider>
    </React.StrictMode>
  )
}
