import { Card, CardContent } from "@/components/ui/card"
import { ClipboardList, GitCompareArrows, Hospital } from "lucide-react"

const steps = [
  {
    step: 1,
    icon: ClipboardList,
    title: "Enter Your Treatment Constraints",
    description:
      "Provide your budget, preferred location, insurance plan, and recovery timeline to narrow down your options.",
  },
  {
    step: 2,
    icon: GitCompareArrows,
    title: "Compare Treatment Paths",
    description:
      "Review side-by-side comparisons of treatment options with transparent cost breakdowns, recovery estimates, and outcome data.",
  },
  {
    step: 3,
    icon: Hospital,
    title: "View Contextual Hospital Suitability",
    description:
      "See which facilities best match your treatment needs based on specialization, infrastructure, and patient outcomes.",
  },
] as const

export function HowItWorks() {
  return (
    <section
      className="border-t border-border/40 bg-muted/30 px-4 py-24 sm:px-6 sm:py-28 lg:px-8"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            How It Works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three simple steps to a more informed treatment decision.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <Card
              key={item.step}
              className="rounded-2xl border-border/60 bg-background shadow-sm"
            >
              <CardContent className="flex flex-col items-center px-6 pb-8 pt-8 text-center">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
