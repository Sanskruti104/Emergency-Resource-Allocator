import { ShieldCheck, Lock, HeartPulse } from "lucide-react"

const trustItems = [
  {
    icon: ShieldCheck,
    label: "HIPAA Compliant",
  },
  {
    icon: Lock,
    label: "Data Encrypted",
  },
  {
    icon: HeartPulse,
    label: "Evidence-Based",
  },
] as const

export function TrustBar() {
  return (
    <section className="border-t border-border/60 bg-muted/50 px-4 py-10 sm:px-6 lg:px-8" aria-label="Trust indicators">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 sm:gap-12">
        {trustItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
