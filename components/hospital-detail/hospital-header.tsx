import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Clock, BadgeCheck, CheckCircle2, Video } from "lucide-react";
import { Hospital } from "./types";

interface HospitalHeaderProps {
    hospital: Hospital;
}

export function HospitalHeader({ hospital }: HospitalHeaderProps) {
    return (
        <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden mb-6">
            <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-4">
                        {/* Title and Verification */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {hospital.hospitalName}
                                </h1>
                                {hospital.isVerified && (
                                    <BadgeCheck className="w-6 h-6 text-primary fill-blue-50" />
                                )}
                            </div>
                            {hospital.address && (
                                <div className="flex items-center text-muted-foreground text-sm">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    {hospital.address}
                                </div>
                            )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                            {hospital.specialties?.slice(0, 3).map((spec, index) => (
                                <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 text-sm font-medium border-0">
                                    {spec}
                                </Badge>
                            ))}
                            {hospital.achievements?.slice(0, 2).map((achievement, index) => (
                                <Badge key={index} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 px-3 py-1 text-sm font-medium">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {achievement}
                                </Badge>
                            ))}
                        </div>

                        {/* Info Grid */}
                        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <Phone className="w-4 h-4 text-primary" />
                                <span className="font-semibold text-gray-900">{hospital.helplineNumber || "Contact Hospital"}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>OPD: <span className="font-medium text-gray-900">{hospital.opdTiming || "9:00 AM - 5:00 PM"}</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 min-w-[200px] justify-center">
                        <Button size="lg" className="w-full bg-primary hover:bg-blue-700 shadow-md transition-all font-semibold rounded-xl text-base h-12">
                            <Phone className="w-4 h-4 mr-2" />
                            Call Network
                        </Button>
                        {hospital.media?.virtualTourLink && (
                            <Button variant="outline" size="lg" className="w-full border-2 border-primary/10 text-primary hover:bg-primary/5 hover:border-primary/20 rounded-xl font-semibold h-12">
                                <Video className="w-4 h-4 mr-2" />
                                View 360° Tour
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
