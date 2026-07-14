// Similarité textuelle — alternative légère à pgvector
// TF-IDF + cosine. Suffit pour une démo vivante sans dépendance Postgres.
// Embeddings stockés en JSON dans CorpusVectoriel.embedding.

// Vocabulaire global (construit à la volée par query)
const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','et','ou','mais','donc','or','ni','car','que','qui','quoi','dont','où',
  'dans','sur','sous','par','pour','avec','sans','vers','chez','entre','parmi','the','a','an','of','to','in','on','is','are','be',
  'ce','cet','cette','ces','son','sa','ses','leur','leurs','notre','votre','nos','vos','je','tu','il','elle','on','nous','vous','ils','elles',
  'est','sont','été','être','avoir','avait','fait','faire','plus','moins','très','trop','peu','bien','mal','comme','si','alors','puis','ensuite',
  'ne','pas','ni','non','oui','aussi','encore','déjà','toujours','jamais','souvent','parfois','quand','comment','pourquoi','quel','quelle','quels','quelles',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

export function buildVocab(tokensList: string[][]): Map<string, number> {
  const vocab = new Map<string, number>()
  let idx = 0
  for (const tokens of tokensList) {
    for (const t of tokens) {
      if (!vocab.has(t)) vocab.set(t, idx++)
    }
  }
  return vocab
}

export function tfidf(tokens: string[], vocab: Map<string, number>, dfMap: Map<string, number>, docCount: number): number[] {
  const vec = new Array(vocab.size).fill(0)
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  for (const [t, count] of tf) {
    const idx = vocab.get(t)
    if (idx === undefined) continue
    const df = dfMap.get(t) ?? 1
    const idf = Math.log((docCount + 1) / (df + 1)) + 1
    vec[idx] = (count / tokens.length) * idf
  }
  return vec
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export interface VectorizedDoc {
  id: string
  tokens: string[]
  vector: number[]
  contenu: string
}

// Indexe un corpus de documents et expose la recherche
export function buildIndex(docs: { id: string; contenu: string }[]): {
  query: (text: string, k: number) => { id: string; score: number }[]
} {
  const tokenized = docs.map((d) => ({ id: d.id, tokens: tokenize(d.contenu), contenu: d.contenu }))
  const vocab = buildVocab(tokenized.map((d) => d.tokens))
  const dfMap = new Map<string, number>()
  for (const d of tokenized) {
    const seen = new Set(d.tokens)
    for (const t of seen) dfMap.set(t, (dfMap.get(t) ?? 0) + 1)
  }
  const vectors: VectorizedDoc[] = tokenized.map((d) => ({
    id: d.id,
    tokens: d.tokens,
    contenu: d.contenu,
    vector: tfidf(d.tokens, vocab, dfMap, tokenized.length),
  }))

  return {
    query: (text: string, k: number) => {
      const qTokens = tokenize(text)
      const qVec = tfidf(qTokens, vocab, dfMap, tokenized.length)
      const scored = vectors.map((v) => ({ id: v.id, score: cosine(qVec, v.vector) }))
      scored.sort((a, b) => b.score - a.score)
      return scored.slice(0, k).filter((s) => s.score > 0)
    },
  }
}
