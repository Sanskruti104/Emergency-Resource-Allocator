"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StepPreferencesProps {
    formData: any
    onChange: (field: string, value: any) => void
}

export function StepPreferences({ formData, onChange }: StepPreferencesProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Preferences & Requirements</h2>
                <p className="text-sm text-muted-foreground">
                    Customize your stay and communication preferences.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>Preferred Room Type</Label>
                    <RadioGroup
                        value={formData.roomPreference}
                        onValueChange={(val) => onChange("roomPreference", val)}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                    >
                        {["General Ward", "Semi-Private", "Private"].map((room) => (
                            <div key={room}>
                                <RadioGroupItem value={room} id={`room-${room}`} className="peer sr-only" />
                                <Label
                                    htmlFor={`room-${room}`}
                                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer text-center font-medium h-full"
                                >
                                    {room}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">ICU Support Required</Label>
                        <p className="text-xs text-muted-foreground">Does the patient need critical care?</p>
                    </div>
                    <Switch
                        checked={formData.icuRequirement}
                        onCheckedChange={(val) => onChange("icuRequirement", val)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Preferred Language (Optional)</Label>
                    <Select
                        value={formData.languagePreference}
                        onValueChange={(val) => onChange("languagePreference", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Communication language" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Hindi">Hindi</SelectItem>
                            <SelectItem value="Marathi">Marathi</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
