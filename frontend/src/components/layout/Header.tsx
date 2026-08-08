'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Icons } from '@/components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Breadcrumb helper
function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return [{ label: 'Dashboard', href: '/' }]
  }

  const breadcrumbs = [{ label: 'Dashboard', href: '/' }]

  let currentPath = ''
  segments.forEach((segment) => {
    currentPath += `/${segment}`
    const label =
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    breadcrumbs.push({ label, href: currentPath })
  })

  return breadcrumbs
}

// User menu with dropdown
function UserMenu() {
  const { data: session } = useSession()
  const user = {
    name: session?.user?.name || 'Signed out',
    email: session?.user?.email || '',
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'group flex items-center gap-1 rounded-full',
            'focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50 focus:ring-offset-2',
            'transition-transform duration-200'
          )}
        >
          <div className='flex items-center gap-3'>
            <div className='hidden flex-col text-right lg:flex'>
              <span className='text-sm font-medium text-foreground'>
                {user.name}
              </span>
              <span className='text-xs text-muted-foreground'>
                {user.email}
              </span>
            </div>
            <Avatar
              fallback={user.name}
              size='md'
              showRing
            />
            <Icons.chevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                'group-data-[state=open]:rotate-180 group-hover:translate-y-0.5'
              )}
            />
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align='end' className='w-64'>
        <div className='border-b border-border/50 px-3 py-3'>
          <div className='flex items-center gap-3'>
            <Avatar
              fallback={user.name}
              size='md'
            />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-foreground'>
                {user.name}
              </p>
              <p className='truncate text-xs text-muted-foreground'>
                {user.email}
              </p>
              {session?.user?.role && (
                <p className='truncate text-xs text-muted-foreground'>
                  {session.user.role}
                  {session.user.minAmount != null && session.user.maxAmount != null && (
                    <>
                      {' '}
                      · Approves {session.user.minAmount.toLocaleString()}–{session.user.maxAmount.toLocaleString()}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className='py-1'>
          <DropdownMenuItem className='gap-3 rounded-lg px-3 py-2.5'>
            <Icons.user className='h-4 w-4 text-muted-foreground' strokeWidth={1.5} />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className='gap-3 rounded-lg px-3 py-2.5'>
            <Icons.settings className='h-4 w-4 text-muted-foreground' strokeWidth={1.5} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className='gap-3 rounded-lg px-3 py-2.5'
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          >
            <Icons.logout className='h-4 w-4 text-muted-foreground' strokeWidth={1.5} />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface HeaderProps {
  onOpenMobileMenu?: () => void
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)

  return (
    <header
      role='banner'
      className={cn(
        // Floating pill positioning
        'fixed right-4 top-4 z-sticky',
        // Adjust left position based on sidebar (hidden on mobile)
        'left-4 md:left-[calc(16rem+1rem)]',
        // Glass pill styling
        'rounded-2xl bg-white/70 backdrop-blur-xl',
        'border border-white/60 ring-1 ring-black/[0.03]',
        'shadow-float',
        // Layout
        'flex items-center justify-between',
        'h-14 px-4 lg:px-6'
      )}
    >
      {/* Left: Mobile menu + Breadcrumb */}
      <div className='flex items-center gap-2'>
        {/* Mobile menu button */}
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={onOpenMobileMenu}
          className='-ml-1 text-muted-foreground hover:text-foreground md:hidden'
          aria-label='Open navigation menu'
        >
          <Icons.menu className='h-5 w-5' strokeWidth={1.5} />
        </Button>

        <Icons.home
          className='hidden h-4 w-4 text-muted-foreground md:block'
          strokeWidth={1.5}
        />
        <nav
          aria-label='Breadcrumb'
          className='hidden items-center gap-1 text-sm sm:flex'
        >
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.href}>
              {index > 0 && (
                <Icons.chevronRight
                  className='h-4 w-4 text-muted-foreground/50'
                  aria-hidden='true'
                />
              )}
              <span
                className={cn(
                  index === breadcrumbs.length - 1
                    ? 'font-medium text-foreground'
                    : 'cursor-pointer text-muted-foreground hover:text-foreground'
                )}
                aria-current={
                  index === breadcrumbs.length - 1 ? 'page' : undefined
                }
              >
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
        {/* Mobile: Just show current page */}
        <span className='text-sm font-medium text-foreground sm:hidden'>
          {breadcrumbs[breadcrumbs.length - 1].label}
        </span>
      </div>

      {/* Right: Actions */}
      <div className='flex items-center gap-1 sm:gap-2'>
        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  )
}
