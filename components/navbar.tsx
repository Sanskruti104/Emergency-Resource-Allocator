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
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" className="text-xs h-9 rounded-full px-3.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100 flex items-center gap-1.5 font-semibold" size="sm" asChild>
              <a href="/dashboards">
                <Activity className="h-3.5 w-3.5" />
                <span>Dashboards Hub</span>
              </a>
            </Button>
            <Button variant="ghost" className="hidden sm:inline-flex text-xs" size="sm" asChild>
              <a href="/login">Sign In</a>
            </Button>
            <Button className="rounded-full px-5 text-xs" size="sm" asChild>
              <a href="/signup-selection">Sign Up</a>
            </Button>
          </div>
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
