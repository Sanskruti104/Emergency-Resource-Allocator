import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Condition {
    key: string;
    category: string;
    name: string;
}

interface StepTreatmentContextProps {
    formData: any
    onChange: (field: string, value: any) => void
}

export function StepTreatmentContext({ formData, onChange }: StepTreatmentContextProps) {
    const [allConditions, setAllConditions] = useState<Condition[]>([]);
    const [conditions, setConditions] = useState<Condition[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Updates the condition dropdown based on the selected category.
     * Implements the core logic requested for filtering and UI feedback.
     */
    const updateConditionDropdown = useCallback((selectedCategory: string, masterData?: Condition[]) => {
        const dataToFilter = masterData || allConditions;

        if (!dataToFilter || dataToFilter.length === 0) {
            console.warn("Conditions not loaded yet");
            return;
        }

        const filtered = dataToFilter.filter(c =>
            c.category.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
        );

        // Debugging logs as previously requested
        console.log("Updating Condition Dropdown for Category:", selectedCategory);
        console.log("Filtered Results:", filtered);

        setConditions(filtered);
    }, []); // Empty dependency array for stability

    // 1. Fetch all conditions once on mount
    useEffect(() => {
        async function fetchAllConditions() {
            if (allConditions.length > 0) return; // Prevent double fetch if any

            setIsLoading(true);
            try {
                const res = await fetch("/api/treatment/conditions");
                console.log("Response status:", res.status);

                if (!res.ok) {
                    throw new Error("Network response was not ok");
                }

                const data = await res.json();
                console.log("Fetched conditions:", data);
                setAllConditions(data);

            } catch (error) {
                console.error("Error fetching conditions:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAllConditions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array means this runs ONLY once on mount

    // 2. Filter conditions whenever the category or the master list changes
    useEffect(() => {
        if (allConditions.length > 0 && formData.diagnosisCategory) {
            updateConditionDropdown(formData.diagnosisCategory, allConditions);
        } else if (!formData.diagnosisCategory) {
            setConditions([]);
        }
    }, [formData.diagnosisCategory, allConditions, updateConditionDropdown]);

    // Reset condition key if category changes and current key is not in new list
    useEffect(() => {
        if (formData.conditionKey && conditions.length > 0) {
            const exists = conditions.some(c => c.key === formData.conditionKey);
            if (!exists) {
                onChange("conditionKey", "");
            }
        }
    }, [conditions, formData.conditionKey, onChange]);

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
                        onValueChange={(val) => {
                            // Implements the event listener behavior requested
                            console.log("Selected Category:", val);
                            console.log("Available categories:", [...new Set(allConditions.map(c => c.category))]);

                            onChange("diagnosisCategory", val);
                            onChange("conditionKey", "");
                            updateConditionDropdown(val);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cardiac">Cardiology (Heart)</SelectItem>
                            <SelectItem value="Orthopedic">Orthopedics (Bone/Joint)</SelectItem>
                            <SelectItem value="Neuro">Neurology (Brain/Nerve)</SelectItem>
                            <SelectItem value="General Surgery">General Surgery</SelectItem>
                            <SelectItem value="Oncology">Oncology (Cancer)</SelectItem>
                            <SelectItem value="Maternity">Maternity</SelectItem>
                            <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Select Condition</Label>
                    <div className="relative">
                        <Select
                            value={formData.conditionKey}
                            onValueChange={(val) => onChange("conditionKey", val)}
                            disabled={!formData.diagnosisCategory || isLoading}
                        >
                            <SelectTrigger className={isLoading ? "pr-10" : ""}>
                                <SelectValue placeholder={
                                    isLoading ? "Loading..." :
                                        !formData.diagnosisCategory ? "Select a category first" :
                                            "Select specific condition (optional)"
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {conditions.map((condition) => (
                                    <SelectItem key={condition.key} value={condition.key}>
                                        {condition.name}
                                    </SelectItem>
                                ))}
                                {conditions.length === 0 && !isLoading && formData.diagnosisCategory && (
                                    <SelectItem value="none" disabled>No specific conditions found</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {isLoading && (
                            <div className="absolute right-3 top-3">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
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
