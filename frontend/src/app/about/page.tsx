'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const SERVED = [
  {
    icon: Icons.building,
    title: 'Gym & Fitness Chains',
    body: 'Multi-branch fitness operators across Southeast Asia — including AnytimeFitness, Chi Fitness, and X Fitness — each with their own vendors, cost centers, and approval chains per branch.',
  },
  {
    icon: Icons.users,
    title: 'Equipment Distributors',
    body: 'Equipment suppliers and regional distributors such as DO!T, whose invoices cover everything from a single treadmill to a full strength-training buildout.',
  },
]

const INVOICE_TYPES = [
  {
    icon: Icons.zap,
    title: 'Equipment',
    body: 'Cardio machines, free weights, racks, and studio fit-outs — typically high-value, PO-matched purchases from distributors.',
  },
  {
    icon: Icons.settings,
    title: 'Maintenance',
    body: 'Recurring servicing and repair contracts that keep treadmills, bikes, and rigs safe and running — often smaller amounts, higher frequency.',
  },
  {
    icon: Icons.repeat,
    title: 'Subscription',
    body: 'Software, facility-management platforms, and other recurring membership-adjacent billing that renews on a fixed cadence.',
  },
]

const CAPABILITIES = [
  {
    icon: Icons.workbench,
    title: 'Invoice Orchestrators',
    body: 'Scans inboxes for incoming gym and vendor invoices, validates them against policy, and routes anything that needs a human decision.',
  },
  {
    icon: Icons.brain,
    title: 'AI Policies',
    body: 'Plain-language rules — e.g. auto-approve equipment invoices under a threshold from an approved distributor — checked for conflicts before they go live.',
  },
  {
    icon: Icons.fileText,
    title: 'Manual Approval Requests',
    body: 'Blocked invoices (missing PO, price mismatch, unrecognized branch) are packaged into a review form with the specific thing to check called out.',
  },
  {
    icon: Icons.lightbulb,
    title: 'AI Insights',
    body: 'Surfaces patterns across branches and vendors — spend concentration, recurring maintenance costs, distributor pricing drift.',
  },
]

export default function AboutPage() {
  return (
    <motion.div className='space-y-6' variants={containerVariants} initial='hidden' animate='visible'>
      <motion.div variants={itemVariants}>
        <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
          About This Workspace
        </h1>
        <p className='mt-2 text-lg text-muted-foreground'>
          A purpose-built invoice operation for the gym and fitness equipment industry.
        </p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className='relative overflow-hidden'>
          <CardWatermark opacity={2} scale={1.1} />
          <CardHeader className='relative z-10'>
            <CardTitle className='flex items-center gap-2'>
              <Icons.info className='h-5 w-5 text-brand-cornflower' strokeWidth={1.5} />
              Gym Facilities Invoice Processor
            </CardTitle>
            <CardDescription>What this system is built to handle</CardDescription>
          </CardHeader>
          <CardContent className='relative z-10 space-y-3 text-sm leading-relaxed text-foreground/90'>
            <p>
              This workspace is not a general-purpose invoice tool — it&apos;s tuned specifically for major fitness
              gym chains operating across Southeast Asia (AnytimeFitness, Chi Fitness, X Fitness) and the equipment
              providers and distributors that supply them, such as DO!T.
            </p>
            <p>
              The invoices flowing through it fall into three recurring shapes: large one-off{' '}
              <span className='font-medium text-brand-navy'>equipment</span> purchases, ongoing{' '}
              <span className='font-medium text-brand-navy'>maintenance</span> contracts for gym floor equipment,
              and recurring <span className='font-medium text-brand-navy'>subscription</span>-style billing. Every
              orchestrator, policy, and review form in this app is designed around that mix, rather than generic
              accounts-payable processing.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>Who We Serve</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2'>
          {SERVED.map((item) => (
            <Card key={item.title} className='relative overflow-hidden'>
              <CardContent className='flex items-start gap-4 pt-6'>
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-cornflower/10'>
                  <item.icon className='h-5 w-5 text-brand-cornflower' strokeWidth={1.5} />
                </div>
                <div>
                  <p className='font-semibold text-brand-navy'>{item.title}</p>
                  <p className='mt-1 text-sm text-muted-foreground'>{item.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>Invoice Types</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-3'>
          {INVOICE_TYPES.map((item) => (
            <Card key={item.title} className='relative overflow-hidden'>
              <CardContent className='pt-6'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/10'>
                  <item.icon className='h-5 w-5 text-brand-purple' strokeWidth={1.5} />
                </div>
                <p className='mt-3 font-semibold text-brand-navy'>{item.title}</p>
                <p className='mt-1 text-sm text-muted-foreground'>{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>How This Workspace Helps</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2'>
          {CAPABILITIES.map((item) => (
            <Card key={item.title} className='relative overflow-hidden'>
              <CardContent className='flex items-start gap-4 pt-6'>
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-navy/10'>
                  <item.icon className='h-5 w-5 text-brand-navy' strokeWidth={1.5} />
                </div>
                <div>
                  <p className='font-semibold text-brand-navy'>{item.title}</p>
                  <p className='mt-1 text-sm text-muted-foreground'>{item.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
