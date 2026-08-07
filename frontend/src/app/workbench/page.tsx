'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

interface Tool {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  href: string
}

// Workbench-only tools — modules that already have their own sidebar entry
// (Dashboard, AI Policies, AI Insights) aren't duplicated here.
const tools: Tool[] = [
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Chat with your AI assistant for help with tasks',
    icon: Icons.sparkles,
    color: 'bg-gradient-to-br from-brand-navy to-brand-purple',
    href: '/workbench/ai-assistant',
  },
  {
    id: 'user-forms',
    title: 'User Forms',
    description: 'Review and action human-input steps paused on workflows',
    icon: Icons.inbox,
    color: 'bg-gradient-to-br from-sky-500 to-blue-600',
    href: '/workbench/forms',
  },
  {
    id: 'orchestrator',
    title: 'Invoice Orchestrator',
    description: 'Run the master orchestrator to validate parked invoices',
    icon: Icons.zap,
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
    href: '/workbench/orchestrator',
  },
]

function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: (tool: Tool) => void }) {
  const Icon = tool.icon

  return (
    <motion.div variants={itemVariants}>
      <Card className='h-full cursor-pointer transition-all duration-300'>
        <CardHeader>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${tool.color}`}
          >
            <Icon className='h-6 w-6' strokeWidth={1.5} />
          </div>
          <CardTitle className='mt-4'>{tool.title}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className='w-full' onClick={() => onOpen(tool)}>
            Open
            <Icons.arrowRight className='ml-2 h-4 w-4' />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function WorkbenchPage() {
  const router = useRouter()

  const handleOpenTool = (tool: Tool) => {
    router.push(tool.href)
  }

  return (
    <motion.div
      className='space-y-8'
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className='text-display-3 font-bold tracking-tight text-brand-navy'>
          Workbench
        </h1>
        <p className='mt-2 text-lg text-muted-foreground'>
          Jump into your AI tools and dashboards.
        </p>
      </motion.div>

      {/* Tools Grid */}
      <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onOpen={handleOpenTool} />
        ))}
      </div>
    </motion.div>
  )
}
