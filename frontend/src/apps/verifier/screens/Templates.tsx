import { motion } from 'framer-motion'
import { TEMPLATES, type Template } from '../types'

export interface TemplatesProps {
  onUse: (template: Template) => void
}

export function Templates({ onUse }: TemplatesProps) {
  return (
    <motion.div
      className="bg-bg-surface border border-line rounded-[24px] p-9"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="text-[26px] font-medium tracking-[-0.03em]">Request templates</div>
      <div className="text-sm text-ink-3 mt-2.5">Pre-configured proof requests built around minimal disclosure.</div>
      <div className="flex flex-col gap-3 mt-[26px]">
        {TEMPLATES.map((t) => (
          <div
            key={t.name}
            role="button"
            tabIndex={0}
            onClick={() => onUse(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onUse(t)
            }}
            className="border border-line rounded-2xl px-[22px] py-5 cursor-pointer flex gap-[18px] items-center transition-[border-color,transform] duration-150 ease-out hover:border-ink hover:-translate-y-0.5"
          >
            <div className="flex-1">
              <div className="text-[15px] font-medium">{t.name}</div>
              <div className="text-[13px] text-ink-3 mt-1">{t.desc}</div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <div className="font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 rounded-full bg-blue-bg text-blue">
                {t.proveTag}
              </div>
              <div className="font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 rounded-full bg-bg-muted text-ink-3">
                {t.revealTag}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
