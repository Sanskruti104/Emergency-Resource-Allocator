"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StepBasicContextProps {
    formData: any
    onChange: (field: string, value: any) => void
}

export function StepBasicContext({ formData, onChange }: StepBasicContextProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Basic Information</h2>
                <p className="text-sm text-muted-foreground">
                    Help us find hospitals that are accessible and relevant to you.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Age Group</Label>
                    <RadioGroup
                        value={formData.ageGroup}
                        onValueChange={(val) => onChange("ageGroup", val)}
                        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                    >
                        {["0-18", "19-40", "41-60", "60+"].map((age) => (
                            <div key={age}>
                                <RadioGroupItem value={age} id={`age-${age}`} className="peer sr-only" />
                                <Label
                                    htmlFor={`age-${age}`}
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer text-center font-medium"
                                >
                                    {age}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="city">City / Location</Label>
                        <Input
                            id="city"
                            placeholder="e.g. Pune"
                            value={formData.city}
                            onChange={(e) => onChange("city", e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Travel Capability</Label>
                        <Select
                            value={formData.travelCapability}
                            onValueChange={(val) => onChange("travelCapability", val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select capability" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Local Only">Local Only</SelectItem>
                                <SelectItem value="Within State">Within State</SelectItem>
                                <SelectItem value="Anywhere">Anywhere in India</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    )
}
