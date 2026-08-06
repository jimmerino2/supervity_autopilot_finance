'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface GlAccountRecord {
  gl_account_code: number
  description: string
  account_category: string
  allowed_cost_centers: string[]
}

const defaultForm = {
  gl_account_code: '',
  description: '',
  account_category: '',
  allowed_cost_centers: '',
}

const columns: DataTableColumn<GlAccountRecord>[] = [
  { key: 'gl_account_code', label: 'GL Account Code', sortValue: (r) => r.gl_account_code, render: (r) => r.gl_account_code },
  { key: 'description', label: 'Description', sortValue: (r) => r.description, render: (r) => r.description },
  { key: 'account_category', label: 'Category', sortValue: (r) => r.account_category, render: (r) => r.account_category },
  {
    key: 'allowed_cost_centers',
    label: 'Allowed Cost Centers',
    render: (r) => (r.allowed_cost_centers || []).join(', ') || '—',
  },
]

export default function AdminGlAccountsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<GlAccountRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selected, setSelected] = useState<GlAccountRecord | null>(null)
  const [formValues, setFormValues] = useState(defaultForm)

  const isAdmin = session?.roles?.includes('admin')

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (!isAdmin) {
      router.push('/')
      return
    }

    fetchRows()
  }, [status, isAdmin, router])

  const fetchRows = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<GlAccountRecord[]>('/api/gl_account')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load GL accounts')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormValues(defaultForm)
    setSelected(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setCreateDialogOpen(true)
  }

  const openEditDialog = (row: GlAccountRecord) => {
    setSelected(row)
    setFormValues({
      gl_account_code: String(row.gl_account_code),
      description: row.description,
      account_category: row.account_category,
      allowed_cost_centers: (row.allowed_cost_centers || []).join(', '),
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (row: GlAccountRecord) => {
    setSelected(row)
    setDeleteDialogOpen(true)
  }

  const buildPayload = () => ({
    description: formValues.description,
    account_category: formValues.account_category,
    allowed_cost_centers: formValues.allowed_cost_centers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  })

  const handleCreate = async () => {
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.post('/api/gl_account', {
        gl_account_code: Number(formValues.gl_account_code),
        ...buildPayload(),
      })
      setCreateDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create GL account')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selected) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.put(`/api/gl_account/${selected.gl_account_code}`, buildPayload())
      setEditDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update GL account')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.delete(`/api/gl_account/${selected.gl_account_code}`)
      setDeleteDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete GL account')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Master Data</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>GL Accounts</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.table2 className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Chart-of-accounts entries and their allowed cost centers.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Create, update, and delete GL accounts. <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>allowed_cost_centers</code>{' '}
          overlaps with Approvers&apos; <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>cost_center</code> values by
          convention only — there is no database foreign key between them.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>GL Accounts</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/gl_account</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between gap-4 pb-4'>
            <p className='text-sm text-muted-foreground'>Manage the chart of accounts used for invoice coding.</p>
            <Button onClick={openCreateDialog} className='gap-2'>
              <Icons.plus className='h-4 w-4' />
              Add GL Account
            </Button>
          </div>

          {status === 'loading' || isLoading ? (
            <div className='flex h-72 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : error ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(r) => String(r.gl_account_code)}
              searchPlaceholder='Search by code, description, or category'
              searchableText={(r) => [String(r.gl_account_code), r.description, r.account_category].join(' ')}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              emptyMessage='No GL accounts found.'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Create GL Account</DialogTitle>
          </DialogHeader>
          <DialogDescription>Enter the GL account details below.</DialogDescription>

          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='gl_account_code'>GL Account Code</Label>
              <Input
                id='gl_account_code'
                type='number'
                value={formValues.gl_account_code}
                onChange={(e) => setFormValues({ ...formValues, gl_account_code: e.target.value })}
                placeholder='400100'
              />
            </div>
            <div>
              <Label htmlFor='description'>Description</Label>
              <Input
                id='description'
                value={formValues.description}
                onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                placeholder='Raw Materials'
              />
            </div>
            <div>
              <Label htmlFor='account_category'>Account Category</Label>
              <Input
                id='account_category'
                value={formValues.account_category}
                onChange={(e) => setFormValues({ ...formValues, account_category: e.target.value })}
                placeholder='COGS'
              />
            </div>
            <div>
              <Label htmlFor='allowed_cost_centers'>Allowed Cost Centers (comma-separated)</Label>
              <Input
                id='allowed_cost_centers'
                value={formValues.allowed_cost_centers}
                onChange={(e) => setFormValues({ ...formValues, allowed_cost_centers: e.target.value })}
                placeholder='CC100, CC200, CC300'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={actionLoading}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Edit GL Account</DialogTitle>
          </DialogHeader>
          <DialogDescription>Modify GL account details and save changes.</DialogDescription>

          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='edit_gl_account_code'>GL Account Code</Label>
              <Input id='edit_gl_account_code' value={formValues.gl_account_code} disabled />
            </div>
            <div>
              <Label htmlFor='edit_description'>Description</Label>
              <Input
                id='edit_description'
                value={formValues.description}
                onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor='edit_account_category'>Account Category</Label>
              <Input
                id='edit_account_category'
                value={formValues.account_category}
                onChange={(e) => setFormValues({ ...formValues, account_category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor='edit_allowed_cost_centers'>Allowed Cost Centers (comma-separated)</Label>
              <Input
                id='edit_allowed_cost_centers'
                value={formValues.allowed_cost_centers}
                onChange={(e) => setFormValues({ ...formValues, allowed_cost_centers: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} loading={actionLoading}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GL Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete GL account {selected?.gl_account_code} ({selected?.description})? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className='bg-destructive text-destructive-foreground' onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
