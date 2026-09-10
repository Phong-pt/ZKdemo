import { Button, Card, MonoLabel } from '@/components/primitives'

export interface LandingProps {
  onStartGoogle: () => void
}

export function Landing({ onStartGoogle }: LandingProps) {
  return (
    <Card
      elevated
      className="w-full max-w-[1000px] flex gap-14 items-center flex-wrap"
      style={{ borderRadius: 28, padding: '72px 56px', boxShadow: '0 30px 60px -40px rgba(20,22,28,.28)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex-1 basis-[340px] min-w-0">
        <div className="inline-flex items-center gap-2 border border-line rounded-full px-3 py-1.5 text-xs text-ink-3 mb-[26px]">
          <span className="w-1.5 h-1.5 rounded-full bg-green" />
          Self-custodial · Verified identity
        </div>
        <div
          className="text-[46px] leading-[1.05] tracking-[-0.035em] font-medium mb-[18px]"
          style={{ textWrap: 'pretty' }}
        >
          One wallet for your money and your identity.
        </div>
        <div className="text-[17px] leading-[1.55] text-ink-3 max-w-[440px] mb-9" style={{ textWrap: 'pretty' }}>
          Create a secure crypto wallet, verify your identity once, and carry a tamper-proof credential you
          control.
        </div>
        <Button onClick={onStartGoogle}>
          <span className="w-5 h-5 rounded-full bg-white text-ink font-semibold text-xs flex items-center justify-center">
            G
          </span>
          Continue with Google
        </Button>
        <div className="text-xs text-ink-5 mt-4">By continuing you agree to the Terms and Privacy Notice.</div>
      </div>

      <div className="flex-none basis-[320px] flex justify-center">
        <div
          className="w-[300px] h-[190px] text-white flex flex-col justify-between animate-[floaty_6s_ease-in-out_infinite]"
          style={{
            borderRadius: 22,
            padding: 22,
            background: 'linear-gradient(145deg,#26282F,#0D0E11)',
            boxShadow: '0 40px 70px -40px rgba(13,14,17,.85)',
          }}
        >
          <div className="flex justify-between items-start">
            <MonoLabel tone="white-dim" size="sm" tracking="0.18em">
              VERIFIED IDENTITY
            </MonoLabel>
            <div
              className="w-[30px] h-[22px] rounded-[5px]"
              style={{ background: 'linear-gradient(140deg,#D9C9A0,#9C8A61)' }}
            />
          </div>
          <div>
            <div className="text-[19px] font-medium tracking-[-0.01em]">Nguyen Minh Anh</div>
            <div className="text-xs text-white/60 mt-1">National ID · Vietnam</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
