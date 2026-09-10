import { Button, Card } from '@/components/primitives'

export interface ProcessingProps {
  proc: number
  error?: string | null
  onRetry?: () => void
}

function mark(index: number, current: number): [string, string] {
  if (current > index) return ['✓', '#17795E']
  if (current === index) return ['●', '#16171A']
  return ['○', '#B4B6BC']
}

const STEPS = [
  'Extracting document data',
  'Matching face to document',
  'Encrypting credential',
  'Binding credential to wallet',
]

export function Processing({ proc, error, onRetry }: ProcessingProps) {
  return (
    <Card
      elevated
      className="w-full max-w-[560px] text-center"
      style={{ borderRadius: 26, padding: '52px 44px', boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="relative w-[130px] h-[130px] mx-auto mb-[30px]">
        <div className="absolute inset-0 rounded-full border border-line" />
        {!error && (
          <>
            <div className="absolute inset-3.5 rounded-full border border-line-2 animate-[pulseRing_2.4s_ease-out_infinite]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-ink animate-[spin_1.4s_linear_infinite]" />
          </>
        )}
        <div
          className="absolute inset-[34px] rounded-2xl"
          style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
        />
      </div>
      {error ? (
        <>
          <div className="text-[25px] font-medium tracking-[-0.025em]">Couldn't secure your identity</div>
          <div className="text-sm mt-2.5" style={{ color: '#B4763A' }}>
            {error}
          </div>
          {onRetry && (
            <Button variant="secondary" className="mt-6" onClick={onRetry}>
              Try again
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="text-[25px] font-medium tracking-[-0.025em]">Securing your identity</div>
          <div className="text-sm text-ink-3 mt-2.5">We're securely processing your identity information.</div>
          <div className="mt-7 flex flex-col gap-2.5 text-left">
            {STEPS.map((label, i) => {
              const [icon, color] = mark(i + 1, proc)
              return (
                <div key={label} className="flex items-center gap-2.5 text-sm" style={{ color }}>
                  {icon} {label}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
