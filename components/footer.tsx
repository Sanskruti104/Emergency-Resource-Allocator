import { Activity } from "lucide-react"

const footerLinks = [
  { label: "About", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Disclaimer", href: "#" },
  { label: "Contact", href: "#" },
] as const

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Activity className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-foreground">MedDecision</span>
        </div>
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
          This platform is a decision-support tool, not medical advice.
          Always consult your healthcare provider before making treatment decisions.
        </p>
      </div>
    </footer>
  )
}
