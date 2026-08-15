import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface ProgressTimelineProps {
  steps: string[]
}

export default function ProgressTimeline({ steps }: ProgressTimelineProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex items-start gap-3"
            >
              <span
                className={`mt-1.5 flex h-2.5 w-2.5 shrink-0 rounded-full ${
                  step.startsWith('Error') ? 'bg-red-500/80' : 'bg-emerald-500/80'
                }`}
              />
              <p className={`flex-1 text-sm ${step.startsWith('Error') ? 'text-red-300' : 'text-foreground'}`}>{step}</p>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
