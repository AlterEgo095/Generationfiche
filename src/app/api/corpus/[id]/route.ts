import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { requireApiUser, ApiAuthError } from '@/lib/auth'

// P0-1 : schéma Zod pour le PATCH corpus (statut en enum)
const patchCorpusSchema = z.object({
  statut: z.enum(['brouillon', 'validee']).optional(),
  exemplaire: z.boolean().optional(),
  contenu: z.string().min(10).max(10000).optional(),
})

// PATCH /api/corpus/[id] — R-01/S1-b : écriture editor+ ; sur une
// fiche_reference (contenu ou promotion validee) → validator+ et
// metadata.validatedBy mis à jour (source de vérité serveur).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser(req, { minRole: 'editor' })
    const { id } = await params

    const existing = await db.corpusVectoriel.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()

    // P0-1 : validation Zod du body
    const parsed = patchCorpusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'body invalide', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }

    // Règle fine : toucher une fiche de référence requiert validator+
    const touchesReference = existing.type === 'fiche_reference' && (parsed.data.contenu !== undefined || parsed.data.statut === 'validee' || parsed.data.exemplaire === true)
    if (touchesReference) {
      try {
        await requireApiUser(req, { minRole: 'validator' })
      } catch (e) {
        if (e instanceof ApiAuthError) {
          return NextResponse.json(
            { error: `fiche_reference : ${e.message} (rôle validator requis — vecteur d'injection de prompt)` },
            { status: e.status },
          )
        }
        throw e
      }
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.statut !== undefined) data.statut = parsed.data.statut
    if (parsed.data.exemplaire !== undefined) data.exemplaire = parsed.data.exemplaire
    if (parsed.data.contenu !== undefined) data.contenu = parsed.data.contenu

    // metadata : traçabilité de validation (forcée serveur)
    if (existing.type === 'fiche_reference' && touchesReference) {
      let meta: Record<string, unknown> = {}
      try {
        meta = existing.metadata ? (JSON.parse(existing.metadata) as Record<string, unknown>) : {}
      } catch {
        meta = {}
      }
      meta.validatedBy = user.username
      meta.validatedAt = new Date().toISOString()
      data.metadata = JSON.stringify(meta)
    }

    const updated = await db.corpusVectoriel.update({
      where: { id },
      data,
    })
    return NextResponse.json({
      id: updated.id,
      contenu: updated.contenu,
      type: updated.type,
      niveau: updated.niveau,
      chapitre: updated.chapitre,
      statut: updated.statut,
      exemplaire: updated.exemplaire,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const c = await db.corpusVectoriel.findUnique({
      where: { id },
      include: { notion: { select: { id: true, nom: true } } },
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      id: c.id,
      contenu: c.contenu,
      type: c.type,
      niveau: c.niveau,
      chapitre: c.chapitre,
      statut: c.statut,
      exemplaire: c.exemplaire,
      notionId: c.notionId,
      notion: c.notion,
      metadata: c.metadata ? safeParse(c.metadata) : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/corpus/[id] — R-01/S1-b : suppression réservée au rôle admin
// (route inexistante avant R-01 : F-01/Phase 9 constatait un 405).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser(req, { minRole: 'admin' })
    const { id } = await params
    const existing = await db.corpusVectoriel.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.corpusVectoriel.delete({ where: { id } })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
