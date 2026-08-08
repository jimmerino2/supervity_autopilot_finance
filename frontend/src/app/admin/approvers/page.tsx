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
import { ApproverRecord, ApproversTable } from '@/components/approvers/ApproversTable'
import { Icons } from '@/components/ui/icons'

export default function AdminApproversPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [approvers, setApprovers] = useState<ApproverRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApprover, setSelectedApprover] = useState<ApproverRecord | null>(null)

  const [formValues, setFormValues] = useState({
    approver_name: '',
    approver_email: '',
    role: '',
    min_amount: 0,
    max_amount: 0,
    cost_center: 'CC100',
  })

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

    fetchApprovers()
  }, [status, isAdmin, router])

  const fetchApprovers = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<ApproverRecord[]>('/api/approval_matrix')
      setApprovers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load approvers')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormValues({
      approver_name: '',
      approver_email: '',
      role: '',
      min_amount: 0,
      max_amount: 0,
      cost_center: 'CC100',
    })
    setSelectedApprover(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setCreateDialogOpen(true)
  }

  const openEditDialog = (approver: ApproverRecord) => {
    setSelectedApprover(approver)
    setFormValues({
      approver_name: approver.approver_name,
      approver_email: approver.approver_email,
      role: approver.role,
      min_amount: approver.min_amount,
      max_amount: approver.max_amount,
      cost_center: approver.cost_center || 'CC100',
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (approver: ApproverRecord) => {
    setSelectedApprover(approver)
    setDeleteDialogOpen(true)
  }

  const handleCreate = async () => {
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.post('/api/approval_matrix', formValues)
      setCreateDialogOpen(false)
      resetForm()
      await fetchApprovers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create approver')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedApprover) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.put(`/api/approval_matrix/${selectedApprover.approval_matrix_id}`, formValues)
      setEditDialogOpen(false)
      resetForm()
      await fetchApprovers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update approver')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedApprover) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.delete(`/api/approval_matrix/${selectedApprover.approval_matrix_id}`)
      setDeleteDialogOpen(false)
      resetForm()
      await fetchApprovers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete approver')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Approvers</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Approval Matrix</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.table className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Review approval assignments for equipment, maintenance, and subscription invoices</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Use the table below to search, sort, and review approval role assignments for each cost center.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Approvers</CardTitle>
          <CardDescription>
            Who is authorized to approve invoices for each cost center.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between gap-4 pb-4'>
            <div>
              <p className='text-sm text-muted-foreground'>Manage approval matrix entries</p>
            </div>
            <Button onClick={openCreateDialog} className='gap-2'>
              <Icons.plus className='h-4 w-4' />
              Add Approver
            </Button>
          </div>

          {status === 'loading' || isLoading ? (
            <div className='flex h-72 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : error ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>
              {error}
            </div>
          ) : (
            <ApproversTable rows={approvers} onEdit={openEditDialog} onDelete={openDeleteDialog} />
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Create Approval Matrix Entry</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='approver_name'>Name</Label>
              <Input
                id='approver_name'
                value={formValues.approver_name}
                onChange={(e) => setFormValues({ ...formValues, approver_name: e.target.value })}
                placeholder='Approver name'
              />
            </div>
            <div>
              <Label htmlFor='approver_email'>Email</Label>
              <Input
                id='approver_email'
                type='email'
                value={formValues.approver_email}
                onChange={(e) => setFormValues({ ...formValues, approver_email: e.target.value })}
                placeholder='approver@example.com'
              />
            </div>
            <div>
              <Label htmlFor='role'>Role</Label>
              <Input
                id='role'
                value={formValues.role}
                onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                placeholder='Analyst'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='min_amount'>Min Amount</Label>
                <Input
                  id='min_amount'
                  type='number'
                  value={formValues.min_amount}
                  onChange={(e) => setFormValues({ ...formValues, min_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor='max_amount'>Max Amount</Label>
                <Input
                  id='max_amount'
                  type='number'
                  value={formValues.max_amount}
                  onChange={(e) => setFormValues({ ...formValues, max_amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor='cost_center'>Cost Center</Label>
              <Input
                id='cost_center'
                value={formValues.cost_center}
                onChange={(e) => setFormValues({ ...formValues, cost_center: e.target.value })}
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
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Approval Matrix Entry</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='approver_name'>Name</Label>
              <Input
                id='approver_name'
                value={formValues.approver_name}
                onChange={(e) => setFormValues({ ...formValues, approver_name: e.target.value })}
                placeholder='Approver name'
              />
            </div>
            <div>
              <Label htmlFor='approver_email'>Email</Label>
              <Input
                id='approver_email'
                type='email'
                value={formValues.approver_email}
                onChange={(e) => setFormValues({ ...formValues, approver_email: e.target.value })}
                placeholder='approver@example.com'
              />
            </div>
            <div>
              <Label htmlFor='role'>Role</Label>
              <Input
                id='role'
                value={formValues.role}
                onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                placeholder='Analyst'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='min_amount'>Min Amount</Label>
                <Input
                  id='min_amount'
                  type='number'
                  value={formValues.min_amount}
                  onChange={(e) => setFormValues({ ...formValues, min_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor='max_amount'>Max Amount</Label>
                <Input
                  id='max_amount'
                  type='number'
                  value={formValues.max_amount}
                  onChange={(e) => setFormValues({ ...formValues, max_amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor='cost_center'>Cost Center</Label>
              <Input
                id='cost_center'
                value={formValues.cost_center}
                onChange={(e) => setFormValues({ ...formValues, cost_center: e.target.value })}
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
            <AlertDialogTitle>Delete Approver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedApprover?.approver_name}? This action cannot be undone.
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
