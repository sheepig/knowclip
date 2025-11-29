import Koa, { type Context } from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { BrowserWindow } from 'electron'
import { Conf } from 'electron-conf/main'
import { join, extname } from 'path'
import { writeFile, mkdir } from 'fs/promises'

type AnkiRequest = {
  action: string
  version?: number
  params?: any
  key?: string
}

const ok = (result: any) => ({ result, error: null })
const err = (message: string) => ({ result: null, error: message })

let server: import('http').Server | null = null

export async function startAnkiConnectShim(mainWindow: BrowserWindow) {
  const app = new Koa()
  const router = new Router()
  app.use(bodyParser())

  app.use(async (ctx: Context, next: () => Promise<any>) => {
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


  router.post('/', async (ctx: Context) => {
    ctx.type = 'application/json'
    const req = ctx.request.body as AnkiRequest
    if (!req || !req.action) {
      ctx.body = err('unsupported action')
      return
    }
    try {
      // console.log('anki-connect shim received:', JSON.stringify(req))
    } catch { }
    const p = req.params || {}
    const readSettings = () => {
      try {
        const conf = new Conf()
        const persistedRoot = (conf.get('persist:root') as any) || (conf.get('root') as any) || null
        let settings: any = null
        if (persistedRoot && typeof persistedRoot === 'string') {
          const parsed = JSON.parse(persistedRoot)
          settings = parsed?.settings || null
        } else if (persistedRoot && typeof persistedRoot === 'object') {
          settings = persistedRoot?.settings || null
        }
        if (settings && typeof settings === 'string') {
          try { settings = JSON.parse(settings) } catch { }
        }
        const tmpl = settings?.youmitan2AnkiTemplate || null
        const templateName = (tmpl?.templateName || '').trim()
        const modelNames = (tmpl?.modelNames || '').trim()
        const templateParams = (tmpl?.templateParams || '').trim()
        const mediaFolderLocation = (settings?.mediaFolderLocation || '').trim()
        return { settings, templateName, modelNames, templateParams, mediaFolderLocation }
      } catch {
        return { settings: null, templateName: '', modelNames: '', templateParams: '', mediaFolderLocation: '' }
      }
    }
    const isV6 = typeof req.version === 'number' && req.version === 6
    switch (req.action) {
      case 'version':
        ctx.body = 6
        break
      case 'deckNames':
        try {
          const { templateName } = readSettings()
          console.log('config.templateName =', templateName)
          const decks = templateName ? [templateName] : []
          ctx.body = isV6 ? ok(decks) : decks
        } catch {
          ctx.body = isV6 ? ok([]) : []
        }
        break
      case 'modelNames':
        try {
          const { modelNames } = readSettings()
          console.log('config.modelNames =', modelNames)
          const models = modelNames ? [modelNames] : []
          ctx.body = isV6 ? ok(models) : models
        } catch {
          ctx.body = isV6 ? ok([]) : []
        }
        break
      case 'modelFieldNames': {
        let fields: string[]
        try {
          const { modelNames, templateParams } = readSettings()
          console.log('config.modelNames =', modelNames)
          console.log('config.templateParams =', templateParams)
          fields = templateParams ? templateParams.split(',').map((s: string) => s.trim()).filter(Boolean) : []
        } catch {
          fields = []
        }
        ctx.body = isV6 ? ok(fields) : fields
        break
      }
      case 'addNote': {
        const note = p.note
        if (!note || !note.fields) {
          ctx.body = err('note or fields missing')
          break
        }
        try {
          try {
            // console.log('anki addNote payload:', JSON.stringify(note))
            const audioField = String(note?.fields?.audio || '')
            const m = audioField.match(/^\[sound:([^\]]+)\]$/)
            if (m && m[1]) console.log('anki addNote audio filename:', m[1])
          } catch { }
          // forward to renderer to map into current card
          const { templateParams } = readSettings()
          const configuredFields = templateParams ? templateParams.split(',').map((s: string) => s.trim()).filter(Boolean) : []
          mainWindow.webContents.send('message', 'anki-add-note', JSON.stringify({ note, configuredFields }))
          const ts = Date.now()
          ctx.body = isV6 ? ok(ts) : ts
        } catch (e: any) {
          ctx.body = err(String(e?.message || e))
        }
        break
      }
      case 'addNotes': {
        const notes = Array.isArray(p.notes) ? p.notes : []
        const ids = notes.map((_n: any, i: number) => Date.now() + i)
        try {
          try {
            // console.log('anki addNotes payload count:', notes.length)
            // console.log('anki addNotes first payload:', JSON.stringify(notes[0] || null))
          } catch { }
          const { templateParams } = readSettings()
          const configuredFields = templateParams ? templateParams.split(',').map((s: string) => s.trim()).filter(Boolean) : []
          mainWindow.webContents.send('message', 'anki-add-note', JSON.stringify({ notes, configuredFields }))
        } catch { }
        ctx.body = ok(ids)
        break
      }
      case 'canAddNotesWithErrorDetail': {
        try {
          const notes = Array.isArray(p.notes) ? p.notes : []
          const { modelNames } = readSettings()
          const results = notes.map((note: any) => {
            const modelName = (note?.modelName || '').trim()
            if (modelNames && modelName && modelName !== modelNames)
              return { canAdd: false, error: 'model was not found: ' }
            return { canAdd: true, error: null }
          })
          ctx.body = isV6 ? ok(results) : results
        } catch (e: any) {
          const errArray = [{ canAdd: false, error: String(e?.message || e) }]
          ctx.body = isV6 ? ok(errArray) : errArray
        }
        break
      }
      case 'storeMediaFile':
        try {
          const filename = String(p.filename || '').trim()
          const dataStr = String(p.data || '')
          if (!filename) {
            ctx.body = err('filename missing')
            break
          }
          const ext = extname(filename).toLowerCase()
          const audioExts = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'])
          const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
          const isSupported = audioExts.has(ext) || imageExts.has(ext)
          if (!isSupported) {
            // Still accept and store unknown extensions
          }

          const { mediaFolderLocation } = readSettings()
          if (!mediaFolderLocation) {
            ctx.body = err('media folder not configured')
            break
          }
          const safeName = filename.replace(/\\/g, '/').split('/').pop() || filename
          const outPath = join(mediaFolderLocation, safeName)
          const isDataUrl = dataStr.startsWith('data:')
          const base64Payload = isDataUrl ? dataStr.split(',')[1] || '' : dataStr
          const buf = Buffer.from(base64Payload, 'base64')
          await mkdir(mediaFolderLocation, { recursive: true })
          await writeFile(outPath, buf)
          if (audioExts.has(ext)) {
            try {
              const sound = `[sound:${safeName}]`
              mainWindow.webContents.send('message', 'anki-store-media', JSON.stringify({ sound }))
            } catch { }
          }
          ctx.body = `"${safeName}"`;
        } catch (e: any) {
          ctx.body = err(String(e?.message || e))
        }
        break
      case 'requestPermission':
        ctx.body = ok({ permission: 'granted', requireApiKey: false })
        break
      default:
        ctx.body = err('unsupported action')
    }
  })

  router.get('/', async (ctx: Context) => {
    ctx.status = 200
    ctx.type = 'application/json'
    ctx.body = { apiVersion: 'AnkiConnect v.6' }
  })

  router.head('/', async (ctx: Context) => {
    ctx.status = 200
  })

  router.get('/version', async (ctx: Context) => {
    ctx.type = 'application/json'
    ctx.body = ok(6)
  })

  app.use(router.routes())
  app.use(router.allowedMethods())
  await new Promise<void>((resolve) => {
    server = app.listen(8765, '127.0.0.1', () => resolve())
  })
}

export function stopAnkiConnectShim() {
  if (server) {
    server.close()
    server = null
  }
}