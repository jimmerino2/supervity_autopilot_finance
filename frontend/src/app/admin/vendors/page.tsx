'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'
import { VendorRecord, VendorsTable } from '@/components/vendors/VendorsTable'
import { Icons } from '@/components/ui/icons'

const countryOptions = [
  { value: 'MY', label: 'Malaysia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'TH', label: 'Thailand' },
]

const defaultVendorForm = {
  vendor_name: '',
  tax_id: '',
  bank_country: 'MY',
  bank_key: '',
  bank_account_number: '',
  currency_code: 'MYR',
  payment_terms: 'Z045',
  account_group: 'KRED',
  is_blocked: false,
  is_deleted: false,
  country_code: 'MY',
  email: '',
}

export default function AdminVendorsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null)

  const [formValues, setFormValues] = useState(defaultVendorForm)

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

    fetchVendors()
  }, [status, isAdmin, router])

  const fetchVendors = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<VendorRecord[]>('/api/vendor')
      setVendors(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vendors')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormValues(defaultVendorForm)
    setSelectedVendor(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setCreateDialogOpen(true)
  }

  const openViewDialog = (vendor: VendorRecord) => {
    setSelectedVendor(vendor)
    setViewDialogOpen(true)
  }

  const openEditDialog = (vendor: VendorRecord) => {
    setSelectedVendor(vendor)
    setFormValues({
      vendor_name: vendor.vendor_name,
      tax_id: vendor.tax_id,
      bank_country: vendor.bank_country,
      bank_key: vendor.bank_key,
      bank_account_number: vendor.bank_account_number,
      currency_code: vendor.currency_code,
      payment_terms: vendor.payment_terms,
      account_group: vendor.account_group,
      is_blocked: vendor.is_blocked,
      is_deleted: vendor.is_deleted,
      country_code: vendor.country_code,
      email: vendor.email,
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (vendor: VendorRecord) => {
    setSelectedVendor(vendor)
    setDeleteDialogOpen(true)
  }

  const handleCreate = async () => {
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.post('/api/vendor', formValues)
      setCreateDialogOpen(false)
      resetForm()
      await fetchVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedVendor) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.put(`/api/vendor/${selectedVendor.vendor_id}`, formValues)
      setEditDialogOpen(false)
      resetForm()
      await fetchVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedVendor) return
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.delete(`/api/vendor/${selectedVendor.vendor_id}`)
      setDeleteDialogOpen(false)
      resetForm()
      await fetchVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete vendor')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Vendors</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Vendor Directory</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.table className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Manage vendors and payment details.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Create, update, and delete vendors. Only MY, SG, and TH country codes are allowed.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/vendor</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between gap-4 pb-4'>
            <div>
              <p className='text-sm text-muted-foreground'>Manage vendor records and payment metadata.</p>
            </div>
            <Button onClick={openCreateDialog} className='gap-2'>
              <Icons.plus className='h-4 w-4' />
              Add Vendor
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
            <VendorsTable rows={vendors} onView={openViewDialog} onEdit={openEditDialog} onDelete={openDeleteDialog} />
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>View vendor master data and the complete bank account history.</DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className='space-y-5 py-2'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Vendor Name</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.vendor_name}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Tax ID</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.tax_id || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Email</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.email || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Last Bank Change</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.last_bank_change_at || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Current Bank Key</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.bank_key || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Current Account</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.bank_account_number || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Country / Currency</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.country_code} / {selectedVendor.currency_code}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Payment Terms</Label>
                  <p className='mt-1 text-sm'>{selectedVendor.payment_terms || '—'}</p>
                </div>
              </div>

              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Bank Account History</Label>
                <div className='mt-2 overflow-hidden rounded-2xl border border-border'>
                  <table className='min-w-full divide-y divide-border text-sm'>
                    <thead className='bg-slate-50'>
                      <tr>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Bank Key</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Account</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Valid From</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Valid To</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Changed By</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Source</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-white'>
                      {(selectedVendor.bank_account_history || []).length > 0 ? (
                        selectedVendor.bank_account_history!.map((entry, index) => (
                          <tr key={`${entry.bank_key}-${index}`}>
                            <td className='px-3 py-2'>{entry.bank_key || '—'}</td>
                            <td className='px-3 py-2'>{entry.account_number || '—'}</td>
                            <td className='px-3 py-2'>{entry.valid_from || '—'}</td>
                            <td className='px-3 py-2'>{entry.valid_to || '—'}</td>
                            <td className='px-3 py-2'>{entry.changed_by || '—'}</td>
                            <td className='px-3 py-2'>{entry.change_source || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className='px-3 py-4 text-center text-muted-foreground'>No bank history available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Create Vendor</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Enter vendor details below. The ID is generated automatically by the database.
          </DialogDescription>

          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='vendor_name'>Vendor Name</Label>
              <Input
                id='vendor_name'
                value={formValues.vendor_name}
                onChange={(e) => setFormValues({ ...formValues, vendor_name: e.target.value })}
                placeholder='Kirana Traders Pte Ltd'
              />
            </div>
            <div>
              <Label htmlFor='tax_id'>Tax ID</Label>
              <Input
                id='tax_id'
                value={formValues.tax_id}
                onChange={(e) => setFormValues({ ...formValues, tax_id: e.target.value })}
                placeholder='MY39188066'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='bank_country'>Bank Country</Label>
                <Select
                  value={formValues.bank_country}
                  onValueChange={(value) => setFormValues({ ...formValues, bank_country: value })}
                >
                  <SelectTrigger id='bank_country'>
                    <SelectValue placeholder='Select bank country' />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor='country_code'>Country Code</Label>
                <Select
                  value={formValues.country_code}
                  onValueChange={(value) => setFormValues({ ...formValues, country_code: value })}
                >
                  <SelectTrigger id='country_code'>
                    <SelectValue placeholder='Select country' />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor='bank_key'>Bank Key</Label>
              <Input
                id='bank_key'
                value={formValues.bank_key}
                onChange={(e) => setFormValues({ ...formValues, bank_key: e.target.value })}
                placeholder='PBBEMYKL'
              />
            </div>
            <div>
              <Label htmlFor='bank_account_number'>Bank Account Number</Label>
              <Input
                id='bank_account_number'
                value={formValues.bank_account_number}
                onChange={(e) => setFormValues({ ...formValues, bank_account_number: e.target.value })}
                placeholder='4952-8503-1572'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='currency_code'>Currency Code</Label>
                <Input
                  id='currency_code'
                  value={formValues.currency_code}
                  onChange={(e) => setFormValues({ ...formValues, currency_code: e.target.value.toUpperCase() })}
                  placeholder='MYR'
                />
              </div>
              <div>
                <Label htmlFor='payment_terms'>Payment Terms</Label>
                <Input
                  id='payment_terms'
                  value={formValues.payment_terms}
                  onChange={(e) => setFormValues({ ...formValues, payment_terms: e.target.value })}
                  placeholder='Z045'
                />
              </div>
            </div>
            <div>
              <Label htmlFor='account_group'>Account Group</Label>
              <Input
                id='account_group'
                value={formValues.account_group}
                onChange={(e) => setFormValues({ ...formValues, account_group: e.target.value })}
                placeholder='KRED'
              />
            </div>
            <div>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={formValues.email}
                onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                placeholder='ap@kirana.com'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  checked={formValues.is_blocked}
                  onCheckedChange={(checked) =>
                    setFormValues({
                      ...formValues,
                      is_blocked: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor='is_blocked'>Blocked</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Checkbox
                  checked={formValues.is_deleted}
                  onCheckedChange={(checked) =>
                    setFormValues({
                      ...formValues,
                      is_deleted: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor='is_deleted'>Deleted</Label>
              </div>
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
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Modify vendor settings and save changes. Country values are restricted to MY, SG, or TH.
          </DialogDescription>

          <div className='space-y-4 py-4'>
            <div>
              <Label htmlFor='vendor_name'>Vendor Name</Label>
              <Input
                id='vendor_name'
                value={formValues.vendor_name}
                onChange={(e) => setFormValues({ ...formValues, vendor_name: e.target.value })}
                placeholder='Kirana Traders Pte Ltd'
              />
            </div>
            <div>
              <Label htmlFor='tax_id'>Tax ID</Label>
              <Input
                id='tax_id'
                value={formValues.tax_id}
                onChange={(e) => setFormValues({ ...formValues, tax_id: e.target.value })}
                placeholder='MY39188066'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='bank_country'>Bank Country</Label>
                <Select
                  value={formValues.bank_country}
                  onValueChange={(value) => setFormValues({ ...formValues, bank_country: value })}
                >
                  <SelectTrigger id='bank_country'>
                    <SelectValue placeholder='Select bank country' />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor='country_code'>Country Code</Label>
                <Select
                  value={formValues.country_code}
                  onValueChange={(value) => setFormValues({ ...formValues, country_code: value })}
                >
                  <SelectTrigger id='country_code'>
                    <SelectValue placeholder='Select country' />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor='bank_key'>Bank Key</Label>
              <Input
                id='bank_key'
                value={formValues.bank_key}
                onChange={(e) => setFormValues({ ...formValues, bank_key: e.target.value })}
                placeholder='PBBEMYKL'
              />
            </div>
            <div>
              <Label htmlFor='bank_account_number'>Bank Account Number</Label>
              <Input
                id='bank_account_number'
                value={formValues.bank_account_number}
                onChange={(e) => setFormValues({ ...formValues, bank_account_number: e.target.value })}
                placeholder='4952-8503-1572'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <Label htmlFor='currency_code'>Currency Code</Label>
                <Input
                  id='currency_code'
                  value={formValues.currency_code}
                  onChange={(e) => setFormValues({ ...formValues, currency_code: e.target.value.toUpperCase() })}
                  placeholder='MYR'
                />
              </div>
              <div>
                <Label htmlFor='payment_terms'>Payment Terms</Label>
                <Input
                  id='payment_terms'
                  value={formValues.payment_terms}
                  onChange={(e) => setFormValues({ ...formValues, payment_terms: e.target.value })}
                  placeholder='Z045'
                />
              </div>
            </div>
            <div>
              <Label htmlFor='account_group'>Account Group</Label>
              <Input
                id='account_group'
                value={formValues.account_group}
                onChange={(e) => setFormValues({ ...formValues, account_group: e.target.value })}
                placeholder='KRED'
              />
            </div>
            <div>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={formValues.email}
                onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                placeholder='ap@kirana.com'
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  checked={formValues.is_blocked}
                  onCheckedChange={(checked) =>
                    setFormValues({
                      ...formValues,
                      is_blocked: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor='is_blocked'>Blocked</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Checkbox
                  checked={formValues.is_deleted}
                  onCheckedChange={(checked) =>
                    setFormValues({
                      ...formValues,
                      is_deleted: Boolean(checked),
                    })
                  }
                />
                <Label htmlFor='is_deleted'>Deleted</Label>
              </div>
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
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedVendor?.vendor_name}? This action cannot be undone.
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
