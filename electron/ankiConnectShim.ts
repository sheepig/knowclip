import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { BrowserWindow } from 'electron'

type AnkiRequest = {
  action: string
  version?: number
  params?: any
  key?: string
}

const ok = (result: any) => ({ result, error: null })
const err = (message: string) => ({ result: null, error: message })

export async function startAnkiConnectShim(mainWindow: BrowserWindow) {
  const app = new Koa()
  const router = new Router()
  app.use(bodyParser())

  app.use(async (ctx, next) => {
    const origin = ctx.get('Origin') || ctx.get('origin')
    if (origin) {
      ctx.set('Access-Control-Allow-Origin', origin)
      ctx.set('Vary', 'Origin')
      ctx.set('Access-Control-Allow-Credentials', 'true')
    } else {
      ctx.set('Access-Control-Allow-Origin', '*')
    }
    ctx.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, HEAD')
    ctx.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, X-Requested-With, Authorization'
    )
    ctx.set('Access-Control-Max-Age', '600')
    if (ctx.method === 'OPTIONS') {
      ctx.status = 204
      return
    }
    await next()
  })

  router.post('/', async (ctx) => {
    ctx.type = 'application/json'
    const req = ctx.request.body as AnkiRequest
    if (!req || !req.action) {
      ctx.body = err('unsupported action')
      return
    }
    const v = req.version ?? 6
    if (v !== 6) {
      // respond in compatible shape
    }
    const p = req.params || {}
    switch (req.action) {
      case 'version':
        ctx.body = ok(6)
        break
      case 'deckNames':
        ctx.body = ok(['Knowclip'])
        break
      case 'modelNames':
        ctx.body = ok(['KnowclipNote'])
        break
      case 'modelFieldNames':
        ctx.body = ok(['transcription', 'pronunciation', 'meaning', 'notes', 'dictionary'])
        break
      case 'addNote': {
        const note = p.note
        if (!note || !note.fields) {
          ctx.body = err('note or fields missing')
          break
        }
        try {
          // forward to renderer to map into current card
          mainWindow.webContents.send('message', 'anki-add-note', JSON.stringify({ note }))
          ctx.body = ok(Date.now())
        } catch (e: any) {
          ctx.body = err(String(e?.message || e))
        }
        break
      }
      case 'addNotes': {
        const notes = Array.isArray(p.notes) ? p.notes : []
        const ids = notes.map((_n: any, i: number) => Date.now() + i)
        try {
          mainWindow.webContents.send('message', 'anki-add-note', JSON.stringify({ notes }))
        } catch {}
        ctx.body = ok(ids)
        break
      }
      case 'storeMediaFile':
        ctx.body = ok(true)
        break
      case 'requestPermission':
        ctx.body = ok({ permission: 'granted', requireApiKey: false })
        break
      default:
        ctx.body = err('unsupported action')
    }
  })

  router.get('/', async (ctx) => {
    ctx.status = 200
    ctx.type = 'application/json'
    ctx.body = { apiVersion: 'AnkiConnect v.6' }
  })

  router.head('/', async (ctx) => {
    ctx.status = 200
  })

  router.get('/version', async (ctx) => {
    ctx.type = 'application/json'
    ctx.body = ok(6)
  })

  app.use(router.routes())
  app.use(router.allowedMethods())
  await new Promise<void>((resolve) => {
    app.listen(8765, '127.0.0.1', () => resolve())
  })
}