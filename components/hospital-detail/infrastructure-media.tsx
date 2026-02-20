import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Hospital } from "./types";
import { Building2, Video, Image as ImageIcon } from "lucide-react";

interface InfrastructureMediaProps {
    hospital: Hospital;
}

export function InfrastructureMedia({ hospital }: InfrastructureMediaProps) {
    const { media } = hospital;

    // Fallback images if none provided (for demo)
    const exteriorImages = media.exterior.length ? media.exterior : ["/placeholder-hospital.jpg"];
    const interiorImages = [...media.wards, ...media.icu, ...media.gallery];
    const allImages = [...exteriorImages, ...interiorImages];

    return (
        <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-700" />
                    Infrastructure & Facilities
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="photos" className="w-full">
                    <div className="px-6 pb-4">
                        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                            <TabsTrigger value="photos" className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> Photos
                            </TabsTrigger>
                            <TabsTrigger value="360" disabled={!media.virtualTourLink} className="flex items-center gap-2">
                                <Video className="w-4 h-4" /> 360° Tour
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="photos" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                            <div className="md:col-span-2 relative group">
                                <AspectRatio ratio={16 / 9} className="bg-muted">
                                    <img
                                        src={allImages[0] || "/placeholder.jpg"}
                                        alt="Main View"
                                        className="object-cover w-full h-full"
                                    />
                                </AspectRatio>
                            </div>
                            {allImages.slice(1, 3).map((img, i) => (
                                <div key={i} className="relative">
                                    <AspectRatio ratio={4 / 3} className="bg-muted">
                                        <img
                                            src={img}
                                            alt={`Facility ${i + 1}`}
                                            className="object-cover w-full h-full"
                                        />
                                    </AspectRatio>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="360" className="mt-0">
                        <div className="aspect-video bg-black flex items-center justify-center text-white">
                            {media.virtualTourLink ? (
                                <iframe
                                    src={media.virtualTourLink}
                                    className="w-full h-full border-0"
                                    allowFullScreen
                                />
                            ) : (
                                <p>No 360° Tour Available</p>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
