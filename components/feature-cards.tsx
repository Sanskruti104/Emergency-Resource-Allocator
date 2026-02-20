import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { SlidersHorizontal, Scale, Building2 } from "lucide-react"

const features = [
  {
    icon: SlidersHorizontal,
    title: "Personalized Constraints-Based Planning",
    description:
      "Set your preferences for budget, location, recovery timeline, and insurance coverage. Our system tailors recommendations to match your unique constraints.",
    highlight: "Tailored to your needs",
  },
  {
    icon: Scale,
    title: "Cost & Outcome Trade-offs",
    description:
      "Visualize the relationship between treatment costs and expected outcomes. Make informed decisions with transparent data on pricing and recovery rates.",
    highlight: "Data-driven insights",
  },
  {
    icon: Building2,
    title: "Contextual Hospital Suitability",
    description:
      "Evaluate hospitals based on infrastructure, specialization, patient volume, and equipment availability relevant to your specific treatment needs.",
    highlight: "Right facility, right care",
  },
] as const

export function FeatureCards() {
  return (
    <section className="px-4 pb-28 sm:px-6 lg:px-8" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 id="features-heading" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Core Capabilities
          </h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need to make informed treatment decisions.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
            >
              <CardHeader className="pb-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg font-semibold text-card-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </CardDescription>
                <div className="mt-4">
                  <span
                    className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-medium"
                    style={{ color: "hsl(152, 60%, 38%)" }}
                  >
                    {feature.highlight}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
