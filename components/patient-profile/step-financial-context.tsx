"use client"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StepFinancialContextProps {
    formData: any
    onChange: (field: string, value: any) => void
}

export function StepFinancialContext({ formData, onChange }: StepFinancialContextProps) {
    const handleBudgetChange = (value: number[]) => {
        onChange("budgetMin", value[0]);
        onChange("budgetMax", value[1]);
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Financial Overview</h2>
                <p className="text-sm text-muted-foreground">
                    Define your budget and insurance coverage for transparency.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Estimated Budget Range</Label>
                        <span className="text-sm font-medium text-primary">
                            ₹{formData.budgetMin.toLocaleString()} - ₹{formData.budgetMax.toLocaleString()}
                        </span>
                    </div>
                    <Slider
                        defaultValue={[formData.budgetMin, formData.budgetMax]}
                        min={0}
                        max={5000000}
                        step={5000}
                        value={[formData.budgetMin, formData.budgetMax]}
                        onValueChange={handleBudgetChange}
                        className="py-4"
                    />
                    <div className="text-xs text-muted-foreground flex justify-between">
                        <span>₹0</span>
                        <span>₹50L+</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Insurance Type</Label>
                    <Select
                        value={formData.insuranceType}
                        onValueChange={(val) => onChange("insuranceType", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select insurance type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="None">None / Self-Pay</SelectItem>
                            <SelectItem value="Private">Private Health Insurance</SelectItem>
                            <SelectItem value="Corporate">Corporate / Employer Cover</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Government Scheme (Optional)</Label>
                    <Select
                        value={formData.governmentScheme}
                        onValueChange={(val) => onChange("governmentScheme", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select scheme if applicable" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="PMJAY">Ayushman Bharat (PM-JAY)</SelectItem>
                            <SelectItem value="CGHS">CGHS</SelectItem>
                            <SelectItem value="MJPJAY">MJPJAY (Maharashtra)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
