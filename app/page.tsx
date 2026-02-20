import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { FeatureCards } from "@/components/feature-cards"
import { HowItWorks } from "@/components/how-it-works"
import { TrustBar } from "@/components/trust-bar"
import { Footer } from "@/components/footer"
import { InteractiveHospitalMap } from "@/components/map"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <InteractiveHospitalMap />
        <FeatureCards />
        <HowItWorks />
      </main>
      <TrustBar />
      <Footer />
    </div>
  )
}
