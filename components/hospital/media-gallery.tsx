"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"

interface MediaGalleryProps {
    media: {
        exteriorImages?: string[]
        wardImages?: string[]
        icuImages?: string[]
        galleryImages?: string[]
        virtualTourLink?: string
    }
    onUpdate: (media: any) => void
}

export function MediaGallery({ media, onUpdate }: MediaGalleryProps) {
    const [uploading, setUploading] = useState<string | null>(null)
    const [virtualTourUrl, setVirtualTourUrl] = useState(media.virtualTourLink || "")

    // Sync virtual tour URL when media prop changes
    useEffect(() => {
        if (media.virtualTourLink !== undefined) {
            setVirtualTourUrl(media.virtualTourLink)
        }
    }, [media.virtualTourLink])

    async function handleImageUpload(category: string, file: File) {
        if (!storage) {
            toast.error("Firebase Storage not configured")
            return
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be less than 5MB")
            return
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            toast.error("Only image files are allowed")
            return
        }

        setUploading(category)
        try {
            const timestamp = Date.now()
            const storageRef = ref(storage, `hospital-media/${category}/${timestamp}_${file.name}`)
            await uploadBytes(storageRef, file)
            const downloadURL = await getDownloadURL(storageRef)

            const categoryKey = `${category}Images` as keyof typeof media
            const currentImages = media[categoryKey] || []

            if (currentImages.length >= 5) {
                toast.error("Maximum 5 images per category")
                return
            }

            const updatedMedia = {
                ...media,
                [categoryKey]: [...currentImages, downloadURL]
            }

            await saveMedia(updatedMedia)
            toast.success("Image uploaded successfully")
        } catch (error) {
            console.error("Upload error:", error)
            toast.error("Failed to upload image")
        } finally {
            setUploading(null)
        }
    }

    async function handleImageDelete(category: string, imageUrl: string, index: number) {
        try {
            const categoryKey = `${category}Images` as keyof typeof media
            const currentImages = media[categoryKey] as string[] || []
            const updatedImages = currentImages.filter((_: string, i: number) => i !== index)

            const updatedMedia = {
                ...media,
                [categoryKey]: updatedImages
            }

            await saveMedia(updatedMedia)
            toast.success("Image deleted")
        } catch (error) {
            toast.error("Failed to delete image")
        }
    }

    async function handleVirtualTourSave() {
        if (virtualTourUrl && !isValidUrl(virtualTourUrl)) {
            toast.error("Please enter a valid URL")
            return
        }

        try {
            await saveMedia({
                ...media,
                virtualTourLink: virtualTourUrl
            })
            toast.success("Virtual tour link saved")
        } catch (error) {
            toast.error("Failed to save virtual tour link")
        }
    }

    async function saveMedia(updatedMedia: any) {
        const response = await fetch("/api/hospital/media", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedMedia),
        })

        if (!response.ok) throw new Error("Failed to save")
        onUpdate(updatedMedia)
    }

    function isValidUrl(url: string): boolean {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    function renderImageCategory(category: string, title: string) {
        const categoryKey = `${category}Images` as keyof typeof media
        const images = (media[categoryKey] as string[]) || []

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{title}</Label>
                    <span className="text-sm text-muted-foreground">{images.length}/5</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {images.map((imageUrl: string, index: number) => (
                        <div key={index} className="relative group aspect-video rounded-xl overflow-hidden border">
                            <img src={imageUrl} alt={`${title} ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                                onClick={() => handleImageDelete(category, imageUrl, index)}
                                className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}

                    {images.length < 5 && (
                        <label className="aspect-video rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleImageUpload(category, file)
                                }}
                                disabled={uploading === category}
                            />
                            {uploading === category ? (
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            ) : (
                                <>
                                    <Upload className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Upload</span>
                                </>
                            )}
                        </label>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <CardTitle>Hospital Media Gallery</CardTitle>
                    </div>
                    <CardDescription>Upload images of your hospital facilities (max 5 per category, 5MB each)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {renderImageCategory("exterior", "Exterior Views")}
                    {renderImageCategory("ward", "Ward Images")}
                    {renderImageCategory("icu", "ICU Images")}
                    {renderImageCategory("gallery", "General Gallery")}
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <CardTitle>360° Virtual Tour</CardTitle>
                    <CardDescription>Add a link to your hospital's virtual tour (YouTube 360, Matterport, etc.)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Virtual Tour URL</Label>
                        <div className="flex gap-2">
                            <Input
                                value={virtualTourUrl}
                                onChange={(e) => setVirtualTourUrl(e.target.value)}
                                placeholder="https://..."
                                className="rounded-xl"
                            />
                            <Button onClick={handleVirtualTourSave} className="rounded-xl">
                                Save
                            </Button>
                        </div>
                    </div>
                    {virtualTourUrl && isValidUrl(virtualTourUrl) && (
                        <div className="aspect-video rounded-xl overflow-hidden border">
                            <iframe
                                src={virtualTourUrl}
                                className="w-full h-full"
                                allowFullScreen
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
