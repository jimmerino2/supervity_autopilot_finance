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

export interface PriceConditionRecord {
  condition_record_no: number
  condition_line: number
  application: string
  condition_type: string
  calc_type: string
  amount: number
  currency_code: string
  price_unit: number
  unit_of_measure: string | null
  valid_from: string
  valid_to: string
}

const defaultForm = {
  condition_record_no: '',
  condition_line: '',
  application: 'M',
  condition_type: '',
  calc_type: 'C',
  amount: '',
  currency_code: 'MYR',
  price_unit: '1',
  unit_of_measure: '',
  valid_from: '',
  valid_to: '9999-12-31',
}

const columns: DataTableColumn<PriceConditionRecord>[] = [
  { key: 'condition_record_no', label: 'Record No', sortValue: (r) => r.condition_record_no, render: (r) => r.condition_record_no },
  { key: 'condition_line', label: 'Line', numeric: true, sortValue: (r) => r.condition_line, render: (r) => r.condition_line },
  { key: 'condition_type', label: 'Condition Type', sortValue: (r) => r.condition_type, render: (r) => r.condition_type },
  { key: 'calc_type', label: 'Calc Type', sortValue: (r) => r.calc_type, render: (r) => r.calc_type },
  {
    key: 'amount',
    label: 'Amount',
    numeric: true,
    sortValue: (r) => r.amount,
    render: (r) => `${r.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${r.currency_code}`,
  },
  { key: 'unit_of_measure', label: 'UoM', sortValue: (r) => r.unit_of_measure ?? undefined, render: (r) => r.unit_of_measure ?? '—' },
  {
    key: 'valid_from',
    label: 'Valid From',
    sortValue: (r) => r.valid_from,
    render: (r) => new Date(r.valid_from).toLocaleDateString(),
  },
  {
    key: 'valid_to',
    label: 'Valid To',
    sortValue: (r) => r.valid_to,
    render: (r) => (r.valid_to?.startsWith('9999') ? 'Open' : new Date(r.valid_to).toLocaleDateString()),
  },
]

export default function AdminPriceConditionsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<PriceConditionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selected, setSelected] = useState<PriceConditionRecord | null>(null)
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
      const data = await apiClient.get<PriceConditionRecord[]>('/api/price_condition')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load price conditions')
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

  const openEditDialog = (row: PriceConditionRecord) => {
    setSelected(row)
    setFormValues({
      condition_record_no: String(row.condition_record_no),
      condition_line: String(row.condition_line),
      application: row.application,
      condition_type: row.condition_type,
      calc_type: row.calc_type,
      amount: String(row.amount),
      currency_code: row.currency_code,
      price_unit: String(row.price_unit),
      unit_of_measure: row.unit_of_measure ?? '',
      valid_from: row.valid_from?.slice(0, 10) ?? '',
      valid_to: row.valid_to?.slice(0, 10) ?? '',
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (row: PriceConditionRecord) => {
    setSelected(row)
    setDeleteDialogOpen(true)
  }

  const buildPayload = () => ({
    application: formValues.application,
    condition_type: formValues.condition_type,
    calc_type: formValues.calc_type,
    amount: Number(formValues.amount),
    currency_code: formValues.currency_code,
    price_unit: Number(formValues.price_unit),
    unit_of_measure: formValues.unit_of_measure || null,
    valid_from: formValues.valid_from,
    valid_to: formValues.valid_to,
  })

  const handleCreate = async () => {
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.post('/api/price_condition', {
        condition_record_no: Number(formValues.condition_record_no),
        condition_line: Number(formValues.condition_line),
        ...buildPayload(),
      })
      setCreateDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create price condition')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selected) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.put(
        `/api/price_condition/${selected.condition_record_no}/${selected.condition_line}`,
        buildPayload()
      )
      setEditDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update price condition')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.delete(`/api/price_condition/${selected.condition_record_no}/${selected.condition_line}`)
      setDeleteDialogOpen(false)
      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete price condition')
    } finally {
      setActionLoading(false)
    }
  }

  const conditionFields = (idPrefix: string, lockKeys: boolean) => (
    <div className='space-y-4 py-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor={`${idPrefix}_condition_record_no`}>Condition Record No</Label>
          <Input
            id={`${idPrefix}_condition_record_no`}
            type='number'
            disabled={lockKeys}
            value={formValues.condition_record_no}
            onChange={(e) => setFormValues({ ...formValues, condition_record_no: e.target.value })}
            placeholder='78700000'
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_condition_line`}>Condition Line</Label>
          <Input
            id={`${idPrefix}_condition_line`}
            type='number'
            disabled={lockKeys}
            value={formValues.condition_line}
            onChange={(e) => setFormValues({ ...formValues, condition_line: e.target.value })}
            placeholder='1'
          />
        </div>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor={`${idPrefix}_condition_type`}>Condition Type</Label>
          <Input
            id={`${idPrefix}_condition_type`}
            value={formValues.condition_type}
            onChange={(e) => setFormValues({ ...formValues, condition_type: e.target.value })}
            placeholder='PB00'
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_calc_type`}>Calc Type</Label>
          <Input
            id={`${idPrefix}_calc_type`}
            value={formValues.calc_type}
            onChange={(e) => setFormValues({ ...formValues, calc_type: e.target.value })}
            placeholder='C'
          />
        </div>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor={`${idPrefix}_amount`}>Amount</Label>
          <Input
            id={`${idPrefix}_amount`}
            type='number'
            step='0.01'
            value={formValues.amount}
            onChange={(e) => setFormValues({ ...formValues, amount: e.target.value })}
            placeholder='51.88'
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_currency_code`}>Currency</Label>
          <Input
            id={`${idPrefix}_currency_code`}
            value={formValues.currency_code}
            onChange={(e) => setFormValues({ ...formValues, currency_code: e.target.value.toUpperCase() })}
            placeholder='MYR'
          />
        </div>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor={`${idPrefix}_price_unit`}>Price Unit</Label>
          <Input
            id={`${idPrefix}_price_unit`}
            type='number'
            value={formValues.price_unit}
            onChange={(e) => setFormValues({ ...formValues, price_unit: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_unit_of_measure`}>Unit of Measure</Label>
          <Input
            id={`${idPrefix}_unit_of_measure`}
            value={formValues.unit_of_measure}
            onChange={(e) => setFormValues({ ...formValues, unit_of_measure: e.target.value })}
            placeholder='TON'
          />
        </div>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor={`${idPrefix}_valid_from`}>Valid From</Label>
          <Input
            id={`${idPrefix}_valid_from`}
            type='date'
            value={formValues.valid_from}
            onChange={(e) => setFormValues({ ...formValues, valid_from: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}_valid_to`}>Valid To</Label>
          <Input
            id={`${idPrefix}_valid_to`}
            type='date'
            value={formValues.valid_to}
            onChange={(e) => setFormValues({ ...formValues, valid_to: e.target.value })}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Master Data</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Price Conditions</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.flag className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Equipment pricing conditions (base price, freight, surcharges) by distributor.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Create, update, and delete price conditions. Note: this table has no column linking it back to Purchase Orders or
          materials — <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>condition_record_no</code> is not
          referenced anywhere else in the schema.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
          <CardDescription>
            Negotiated pricing terms — base price, freight, surcharges — for each distributor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between gap-4 pb-4'>
            <p className='text-sm text-muted-foreground'>Manage pricing condition records.</p>
            <Button onClick={openCreateDialog} className='gap-2'>
              <Icons.plus className='h-4 w-4' />
              Add Condition
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
              getRowId={(r) => `${r.condition_record_no}-${r.condition_line}`}
              searchPlaceholder='Search by record no or condition type'
              searchableText={(r) => [String(r.condition_record_no), r.condition_type, r.calc_type].join(' ')}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              emptyMessage='No price conditions found.'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Create Price Condition</DialogTitle>
          </DialogHeader>
          <DialogDescription>The primary key is (condition_record_no, condition_line).</DialogDescription>
          {conditionFields('create', false)}
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
            <DialogTitle>Edit Price Condition</DialogTitle>
          </DialogHeader>
          <DialogDescription>Modify condition details and save changes.</DialogDescription>
          {conditionFields('edit', true)}
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
            <AlertDialogTitle>Delete Price Condition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete condition {selected?.condition_record_no} / line {selected?.condition_line}?
              This action cannot be undone.
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
