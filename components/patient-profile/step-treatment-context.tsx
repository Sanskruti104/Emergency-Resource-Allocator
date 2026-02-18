"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StepTreatmentContextProps {
    formData: any
    onChange: (field: string, value: any) => void
}

export function StepTreatmentContext({ formData, onChange }: StepTreatmentContextProps) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Treatment Details</h2>
                <p className="text-sm text-muted-foreground">
                    Tell us about the medical condition to suggest specialized hospitals.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Diagnosis Category</Label>
                    <Select
                        value={formData.diagnosisCategory}
                        onValueChange={(val) => onChange("diagnosisCategory", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cardiology">Cardiology (Heart)</SelectItem>
                            <SelectItem value="Orthopedics">Orthopedics (Bone/Joint)</SelectItem>
                            <SelectItem value="Neurology">Neurology (Brain/Nerve)</SelectItem>
                            <SelectItem value="Oncology">Oncology (Cancer)</SelectItem>
                            <SelectItem value="General Surgery">General Surgery</SelectItem>
                            <SelectItem value="Maternity">Maternity</SelectItem>
                            <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Urgency</Label>
                    <RadioGroup
                        value={formData.urgency}
                        onValueChange={(val) => onChange("urgency", val)}
                        className="grid grid-cols-2 gap-4"
                    >
                        <div className="relative">
                            <RadioGroupItem value="Emergency" id="urgency-emergency" className="peer sr-only" />
                            <Label
                                htmlFor="urgency-emergency"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:text-red-600 cursor-pointer"
                            >
                                <span className="font-semibold">Emergency</span>
                                <span className="text-xs text-muted-foreground mt-1 text-center">Immediate attention required</span>
                            </Label>
                        </div>
                        <div className="relative">
                            <RadioGroupItem value="Planned" id="urgency-planned" className="peer sr-only" />
                            <Label
                                htmlFor="urgency-planned"
                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer"
                            >
                                <span className="font-semibold">Planned</span>
                                <span className="text-xs text-muted-foreground mt-1 text-center">Scheduled procedure</span>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="space-y-2">
                    <Label>Preferred Timeline</Label>
                    <Select
                        value={formData.timeline}
                        onValueChange={(val) => onChange("timeline", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="When do you need treatment?" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Within 24 hours">Within 24 hours</SelectItem>
                            <SelectItem value="Within 1 week">Within 1 week</SelectItem>
                            <SelectItem value="Within 1 month">Within 1 month</SelectItem>
                            <SelectItem value="Flexible">Flexible</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
