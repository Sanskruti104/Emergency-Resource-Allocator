import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:px-8 lg:pt-40 lg:pb-40">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <Badge
          variant="secondary"
          className="mb-8 rounded-full border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary"
        >
          Treatment Decision Support Platform
        </Badge>

        <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Smart Treatment{" "}
          <span className="text-primary">Decision Support</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Compare hospitals based on cost, recovery time, insurance
          compatibility, and infrastructure. Make informed treatment decisions
          with data-driven insights.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-full px-10 text-base shadow-lg shadow-primary/25">
            <Link href="/profile">
              Plan My Treatment
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="h-12 rounded-full px-10 text-base text-muted-foreground hover:text-foreground"
          >
            <Link href="#how-it-works">Learn How It Works</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
