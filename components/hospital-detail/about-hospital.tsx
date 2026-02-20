import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Hospital } from "./types";

interface AboutHospitalProps {
    hospital: Hospital;
}

export function AboutHospital({ hospital }: AboutHospitalProps) {
    return (
        <Card className="rounded-2xl border-0 shadow-none">
            <CardHeader className="px-0 pb-3">
                <CardTitle className="text-xl font-bold text-gray-900">About {hospital.hospitalName}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                <p className="text-gray-600 leading-relaxed">
                    {hospital.description}
                </p>

                <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Core Specialties</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 ml-4 md:grid-cols-3 gap-3">
                        {hospital.specialties.map((spec, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <div className="mt-1 min-w-4 min-h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                </div>
                                <span>{spec}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
