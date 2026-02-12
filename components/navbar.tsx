import { Button } from "@/components/ui/button"
import { Activity, Info } from "lucide-react"

export function Navbar() {
  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
          aria-label="Main navigation"
        >
          <a href="/" className="flex items-center gap-2" aria-label="MedDecision home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              MedDecision
            </span>
          </a>
          <Button className="rounded-full px-6" size="sm">
            Sign In
          </Button>
        </nav>
      </header>
      <div className="border-b border-border/40 bg-muted/40 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-center text-xs text-muted-foreground sm:text-sm">
          <Info className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" />
          Decision support platform — No medical advice. Transparent assumptions.
        </p>
      </div>
    </>
  )
}
