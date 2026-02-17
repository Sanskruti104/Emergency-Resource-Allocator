"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Building2, Phone, Clock, FileText, Award, Image as ImageIcon, X, Plus } from "lucide-react"
import { toast } from "sonner"
import { MediaGallery } from "@/components/hospital/media-gallery"

interface HospitalPublicProfile {
    helplineNumber?: string
    emergencyNumber?: string
    description?: string
    specialties?: string[]
    achievements?: string[]
    opdTiming?: {
        mondayToFriday?: string
        saturday?: string
        sunday?: string
    }
    media?: {
        exteriorImages?: string[]
        wardImages?: string[]
        icuImages?: string[]
        galleryImages?: string[]
        virtualTourLink?: string
    }
}

export default function HospitalPublicProfilePage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [profile, setProfile] = useState<HospitalPublicProfile>({})
    const [newSpecialty, setNewSpecialty] = useState("")
    const [newAchievement, setNewAchievement] = useState("")
    const [charCount, setCharCount] = useState(0)

    useEffect(() => {
        fetchProfile()
    }, [])

    async function fetchProfile() {
        try {
            const response = await fetch("/api/hospital/profile")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setProfile({
                helplineNumber: data.helplineNumber || "",
                emergencyNumber: data.emergencyNumber || "",
                description: data.description || "",
                specialties: data.specialties || [],
                achievements: data.achievements || [],
                opdTiming: data.opdTiming || {
                    mondayToFriday: "",
                    saturday: "",
                    sunday: ""
                },
                media: data.media || {
                    exteriorImages: [],
                    wardImages: [],
                    icuImages: [],
                    galleryImages: [],
                    virtualTourLink: ""
                }
            })
            setCharCount(data.description?.length || 0)
        } catch (error) {
            toast.error("Failed to load profile")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSaveGeneral() {
        setIsSaving(true)
        try {
            const response = await fetch("/api/hospital/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    helplineNumber: profile.helplineNumber,
                    emergencyNumber: profile.emergencyNumber,
                    description: profile.description,
                    specialties: profile.specialties,
                    achievements: profile.achievements,
                    opdTiming: profile.opdTiming,
                }),
            })

            if (!response.ok) throw new Error("Failed to save")
            toast.success("Profile updated successfully")
            fetchProfile()
        } catch (error) {
            toast.error("Failed to save profile")
        } finally {
            setIsSaving(false)
        }
    }

    function addSpecialty() {
        if (!newSpecialty.trim()) return
        setProfile({
            ...profile,
            specialties: [...(profile.specialties || []), newSpecialty.trim()]
        })
        setNewSpecialty("")
    }

    function removeSpecialty(index: number) {
        setProfile({
            ...profile,
            specialties: profile.specialties?.filter((_, i) => i !== index)
        })
    }

    function addAchievement() {
        if (!newAchievement.trim()) return
        setProfile({
            ...profile,
            achievements: [...(profile.achievements || []), newAchievement.trim()]
        })
        setNewAchievement("")
    }

    function removeAchievement(index: number) {
        setProfile({
            ...profile,
            achievements: profile.achievements?.filter((_, i) => i !== index)
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Hospital Public Profile</h1>
                    <p className="text-muted-foreground">
                        Manage your hospital's public-facing information
                    </p>
                </div>
            </div>

            {/* Contact Details Section */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Phone className="h-5 w-5 text-primary" />
                        <CardTitle>Contact Details</CardTitle>
                    </div>
                    <CardDescription>Hospital helpline and emergency contact numbers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hospital Helpline Number *</Label>
                            <Input
                                value={profile.helplineNumber || ""}
                                onChange={(e) => setProfile({ ...profile, helplineNumber: e.target.value })}
                                placeholder="+91 1234567890"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Emergency Number (Optional)</Label>
                            <Input
                                value={profile.emergencyNumber || ""}
                                onChange={(e) => setProfile({ ...profile, emergencyNumber: e.target.value })}
                                placeholder="+91 9876543210"
                                className="rounded-xl"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* OPD Timings Section */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <CardTitle>OPD Timings</CardTitle>
                    </div>
                    <CardDescription>Configure outpatient department operating hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Monday – Friday</Label>
                            <Input
                                type="text"
                                value={profile.opdTiming?.mondayToFriday || ""}
                                onChange={(e) => setProfile({
                                    ...profile,
                                    opdTiming: { ...profile.opdTiming, mondayToFriday: e.target.value }
                                })}
                                placeholder="e.g., 9:00 AM - 5:00 PM"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Saturday</Label>
                            <Input
                                type="text"
                                value={profile.opdTiming?.saturday || ""}
                                onChange={(e) => setProfile({
                                    ...profile,
                                    opdTiming: { ...profile.opdTiming, saturday: e.target.value }
                                })}
                                placeholder="e.g., 9:00 AM - 1:00 PM"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sunday</Label>
                            <Input
                                type="text"
                                value={profile.opdTiming?.sunday || ""}
                                onChange={(e) => setProfile({
                                    ...profile,
                                    opdTiming: { ...profile.opdTiming, sunday: e.target.value }
                                })}
                                placeholder="e.g., Closed or 10:00 AM - 2:00 PM"
                                className="rounded-xl"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Description & Specialties Section */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle>Hospital Description & Specialties</CardTitle>
                    </div>
                    <CardDescription>Describe your hospital and list medical specialties</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Hospital Description</Label>
                            <span className={`text-sm ${charCount > 1000 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {charCount}/1000 characters
                            </span>
                        </div>
                        <Textarea
                            value={profile.description || ""}
                            onChange={(e) => {
                                setProfile({ ...profile, description: e.target.value })
                                setCharCount(e.target.value.length)
                            }}
                            placeholder="Provide a comprehensive description of your hospital, facilities, and services..."
                            className="rounded-xl min-h-32"
                            maxLength={1000}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Specialties</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                                placeholder="e.g., Cardiology"
                                className="rounded-xl"
                            />
                            <Button onClick={addSpecialty} className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {profile.specialties?.map((specialty, index) => (
                                <Badge key={index} variant="secondary" className="rounded-lg gap-1 px-3 py-1">
                                    {specialty}
                                    <button onClick={() => removeSpecialty(index)} className="ml-1">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Achievements Section */}
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        <CardTitle>Achievements & Accreditations</CardTitle>
                    </div>
                    <CardDescription>Highlight your hospital's achievements and certifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            value={newAchievement}
                            onChange={(e) => setNewAchievement(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                            placeholder="e.g., NABH Accredited"
                            className="rounded-xl"
                        />
                        <Button onClick={addAchievement} className="rounded-xl gap-2">
                            <Plus className="h-4 w-4" />
                            Add
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {profile.achievements?.map((achievement, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                                <span className="text-sm">{achievement}</span>
                                <button onClick={() => removeAchievement(index)}>
                                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Media Gallery Section */}
            <MediaGallery
                media={profile.media || {
                    exteriorImages: [],
                    wardImages: [],
                    icuImages: [],
                    galleryImages: [],
                    virtualTourLink: ""
                }}
                onUpdate={(updatedMedia) => setProfile({ ...profile, media: updatedMedia })}
            />

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSaveGeneral}
                    disabled={isSaving}
                    className="rounded-xl px-8"
                    size="lg"
                >
                    {isSaving ? "Saving..." : "Save Profile"}
                </Button>
            </div>
        </div>
    )
}
