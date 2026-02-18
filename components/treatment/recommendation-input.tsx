"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"

interface RecommendationInputProps {
    onSearch: (query: string) => void
    isLoading: boolean
}

export function RecommendationInput({ onSearch, isLoading }: RecommendationInputProps) {
    const [query, setQuery] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            onSearch(query)
        }
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                What treatment are you looking for?
            </h1>

            <form onSubmit={handleSubmit} className="relative flex items-center">
                <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Example: Knee pain, Heart blockage, Gallstones, Spine surgery"
                    className="h-14 pl-12 pr-4 rounded-2xl text-lg shadow-sm border-gray-200 focus-visible:ring-primary/20"
                />
            </form>

            <Button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                size="lg"
                className="rounded-xl h-12 px-8 font-medium text-base shadow-md hover:shadow-lg transition-all"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    "Get Treatment Options"
                )}
            </Button>
        </div>
    )
}
