'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Info, Plus, Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createCorpus, fetchCorpus, patchCorpus } from '@/lib/api'
import { useQuery as useQueryReferentiel } from '@tanstack/react-query'
import { fetchReferentiel } from '@/lib/api'
import { NiveauBadge } from '@/components/ui/status-badge'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { CorpusItem } from '@/lib/types'

export function CorpusSection() {
  const [type, setType] = useState<string>('')
  const [niveau, setNiveau] = useState<string>('')
  const [chapitre, setChapitre] = useState<string>('')
  const [statut, setStatut] = useState<string>('')
  const [exemplaire, setExemplaire] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['corpus', { type, niveau, chapitre, statut, exemplaire }],
    queryFn: () =>
      fetchCorpus({
        type: type || undefined,
        niveau: niveau || undefined,
        chapitre: chapitre || undefined,
        statut: statut || undefined,
        exemplaire: exemplaire === 'true' ? true : exemplaire === 'false' ? false : undefined,
      }),
    staleTime: 30_000,
  })

  const filtered = (data?.items ?? []).filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return c.contenu.toLowerCase().includes(q) || (c.notion?.nom.toLowerCase().includes(q) ?? false)
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Bannière d'info */}
      <div className="flex items-start gap-2.5 rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-sm dark:border-teal-900/40 dark:bg-teal-950/20">
        <Info className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
        <div className="text-foreground/80">
          Seules les fiches marquées <strong className="text-teal-700 dark:text-teal-300">exemplaires</strong> nourrissent le style.
          <code className="mx-1 rounded bg-teal-100 px-1 py-0.5 font-mono text-xs text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">retrieve_style_reference()</code>
          filtre strictement.
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Select value={type} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[180px]" aria-label="Type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="exemple_pedagogique">Exemple pédagogique</SelectItem>
            <SelectItem value="fiche_reference">Fiche de référence</SelectItem>
          </SelectContent>
        </Select>
        <Select value={niveau} onValueChange={(v) => setNiveau(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[110px]" aria-label="Niveau">
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            {['6e', '5e', '4e', '3e'].map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={chapitre}
          onChange={(e) => setChapitre(e.target.value)}
          placeholder="Chapitre…"
          className="h-9 w-[180px]"
        />
        <Select value={statut} onValueChange={(v) => setStatut(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="validee">Validée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exemplaire} onValueChange={setExemplaire}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Exemplaire">
            <SelectValue placeholder="Exemplaire" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Indifférent</SelectItem>
            <SelectItem value="true">Exemplaire only</SelectItem>
            <SelectItem value="false">Non-exemplaire</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans le contenu…"
          className="h-9 max-w-xs flex-1"
          aria-label="Recherche"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} entrée(s)</span>
          <AddCorpusDialog />
        </div>
      </div>

      {isLoading && <LoadingState message="Chargement du corpus…" />}
      {isError && (
        <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={Database}
          title="Corpus vide"
          description="Aucune entrée ne correspond aux filtres. Ajoutez une fiche de référence ou un exemple pédagogique."
        />
      )}
      {!isLoading && !isError && filtered.length > 0 && (
        <Card>
          <CardContent className="py-0">
            <div className="max-h-[600px] overflow-auto scroll-elite">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-[40%]">Contenu</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Chapitre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Exemplaire</TableHead>
                    <TableHead>Notion</TableHead>
                    <TableHead>Créé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <CorpusRow key={item.id} item={item} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

function CorpusRow({ item }: { item: CorpusItem }) {
  const queryClient = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: () =>
      patchCorpus(item.id, { exemplaire: !item.exemplaire }),
    onSuccess: () => {
      toast.success(
        item.exemplaire
          ? 'Fiche retirée des exemplaires.'
          : 'Fiche marquée comme exemplaire — elle nourrira le style.',
      )
      queryClient.invalidateQueries({ queryKey: ['corpus'] })
    },
    onError: (e) => toast.error(`Erreur: ${e instanceof Error ? e.message : 'inconnue'}`),
  })
  const statutMutation = useMutation({
    mutationFn: (newStatut: string) => patchCorpus(item.id, { statut: newStatut }),
    onSuccess: (_, newStatut) => {
      toast.success(`Statut changé en "${newStatut}".`)
      queryClient.invalidateQueries({ queryKey: ['corpus'] })
    },
    onError: (e) => toast.error(`Erreur: ${e instanceof Error ? e.message : 'inconnue'}`),
  })

  const isExemple = item.type === 'exemple_pedagogique'

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="max-w-md">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="line-clamp-2 text-xs text-foreground/85">{item.contenu}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-md">
              <p className="text-xs">{item.contenu}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            isExemple
              ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
              : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          }
        >
          {isExemple ? 'Exemple' : 'Référence'}
        </Badge>
      </TableCell>
      <TableCell><NiveauBadge value={item.niveau} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{item.chapitre}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted"
              aria-label="Changer le statut"
            >
              <span className={`size-1.5 rounded-full ${item.statut === 'validee' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {item.statut === 'validee' ? 'Validée' : 'Brouillon'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => statutMutation.mutate('validee')}>
              Marquer comme validée
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => statutMutation.mutate('brouillon')}>
              Marquer comme brouillon
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={item.exemplaire}
          onCheckedChange={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          aria-label="Basculer exemplaire"
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{item.notion?.nom ?? '—'}</TableCell>
      <TableCell className="text-[11px] text-muted-foreground">
        {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
      </TableCell>
    </TableRow>
  )
}

function AddCorpusDialog() {
  const [open, setOpen] = useState(false)
  const [contenu, setContenu] = useState('')
  const [type, setType] = useState<'exemple_pedagogique' | 'fiche_reference'>('exemple_pedagogique')
  const [niveau, setNiveau] = useState('4e')
  const [chapitre, setChapitre] = useState('')
  const [notionId, setNotionId] = useState<string>('')
  const [exemplaire, setExemplaire] = useState(false)
  const queryClient = useQueryClient()
  const { data: ref } = useQueryReferentiel({ queryKey: ['referentiel'], queryFn: fetchReferentiel, staleTime: 60_000 })

  const mutation = useMutation({
    mutationFn: () =>
      createCorpus({
        contenu,
        type,
        niveau,
        chapitre,
        notionId: notionId || undefined,
        exemplaire,
      }),
    onSuccess: () => {
      toast.success('Entrée de corpus créée.')
      queryClient.invalidateQueries({ queryKey: ['corpus'] })
      setOpen(false)
      setContenu('')
      setChapitre('')
      setNotionId('')
      setExemplaire(false)
    },
    onError: (e) => toast.error(`Erreur: ${e instanceof Error ? e.message : 'inconnue'}`),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Plus className="size-4" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle entrée de corpus</DialogTitle>
          <DialogDescription>Ajoutez un exemple pédagogique ou une fiche de référence au corpus vectoriel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="contenu" className="mb-1.5 block text-xs">Contenu</Label>
            <Textarea
              id="contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={4}
              placeholder="Texte indexé pour la recherche TF-IDF…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'exemple_pedagogique' | 'fiche_reference')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exemple_pedagogique">Exemple pédagogique</SelectItem>
                  <SelectItem value="fiche_reference">Fiche de référence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Niveau</Label>
              <Select value={niveau} onValueChange={setNiveau}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['6e', '5e', '4e', '3e'].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="chapitre" className="mb-1.5 block text-xs">Chapitre</Label>
              <Input id="chapitre" value={chapitre} onChange={(e) => setChapitre(e.target.value)} placeholder="Géométrie…" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Notion (optionnel)</Label>
              <Select value={notionId} onValueChange={setNotionId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {ref?.notions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.nom} ({n.niveau})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded border border-border p-2.5">
            <Switch id="exemplaire" checked={exemplaire} onCheckedChange={setExemplaire} />
            <Label htmlFor="exemplaire" className="text-xs">
              Marquer comme <strong className="text-emerald-700 dark:text-emerald-300">exemplaire</strong> — nourrira le style
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!contenu.trim() || !chapitre.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Création…' : 'Créer l\'entrée'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
