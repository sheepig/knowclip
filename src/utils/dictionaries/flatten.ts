export function flattenMeanings(input: any): string[] {
  const out: string[] = []
  const push = (s: any) => {
    if (typeof s === 'string') {
      const t = s.trim()
      if (t) out.push(t)
    }
  }
  const walk = (v: any) => {
    if (v == null) return
    if (typeof v === 'string') {
      push(v)
      return
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x)
      return
    }
    if (typeof v === 'object') {
      if (Array.isArray((v as any).glossary)) {
        for (const g of (v as any).glossary) walk(g)
        return
      }
      if ((v as any).text) {
        walk((v as any).text)
        return
      }
      if ((v as any).gloss) {
        walk((v as any).gloss)
        return
      }
      if ((v as any).definition) {
        walk((v as any).definition)
        return
      }
      if ((v as any).content) {
        walk((v as any).content)
        return
      }
      push(String(v))
    }
  }
  walk(input)
  const dedup: string[] = []
  const seen = new Set<string>()
  for (const s of out) {
    const k = s
    if (!seen.has(k)) {
      seen.add(k)
      dedup.push(s)
    }
  }
  return dedup
}