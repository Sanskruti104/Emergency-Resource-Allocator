"use client"

import * as React from "react"
import {
    Plus,
    Search,
    MoreVertical,
    Clock,
    Calendar,
    GraduationCap,
    Award,
    User,
    Loader2,
    Trash2,
    Edit2,
    CheckCircle2,
    Stethoscope
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const DAYS = [
    { id: "Mon", label: "Monday" },
    { id: "Tue", label: "Tuesday" },
    { id: "Wed", label: "Wednesday" },
    { id: "Thu", label: "Thursday" },
    { id: "Fri", label: "Friday" },
    { id: "Sat", label: "Saturday" },
    { id: "Sun", label: "Sunday" },
]

const doctorSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    specialization: z.string().min(2, "Specialization is required"),
    qualification: z.string().min(2, "Qualification is required"),
    experience: z.string().min(1, "Experience is required"),
    registrationNumber: z.string().min(3, "Registration number is required"),
    profilePhoto: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    schedule: z.object({
        days: z.array(z.string()).min(1, "Select at least one day"),
        startTime: z.string().min(1, "Start time is required"),
        endTime: z.string().min(1, "End time is required"),
    })
})

type DoctorFormValues = z.infer<typeof doctorSchema>

export function DoctorManager() {
    const [doctors, setDoctors] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isDialogOpen, setIsDialogOpen] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState("")

    const form = useForm<DoctorFormValues>({
        resolver: zodResolver(doctorSchema),
        defaultValues: {
            name: "",
            specialization: "",
            qualification: "",
            experience: "",
            registrationNumber: "",
            profilePhoto: "",
            schedule: {
                days: [],
                startTime: "09:00",
                endTime: "17:00",
            }
        }
    })

    const fetchDoctors = React.useCallback(async () => {
        try {
            const res = await fetch("/api/hospital/doctors")
            if (res.ok) {
                const data = await res.json()
                setDoctors(data)
            }
        } catch (error) {
            console.error("Failed to fetch doctors:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        fetchDoctors()
    }, [fetchDoctors])

    async function onSubmit(values: DoctorFormValues) {
        setIsSaving(true)
        try {
            const res = await fetch("/api/hospital/doctors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })

            if (res.ok) {
                toast.success("Doctor added successfully")
                setIsDialogOpen(false)
                form.reset()
                fetchDoctors()
            } else {
                toast.error("Failed to add doctor")
            }
        } catch (error) {
            toast.error("An error occurred while saving")
        } finally {
            setIsSaving(false)
        }
    }

    const filteredDoctors = doctors.filter(doctor =>
        doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or specialization..."
                        className="pl-10 h-12 rounded-2xl bg-background shadow-sm border-border/60"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-12 px-6 rounded-2xl gap-2 font-bold shadow-lg shadow-primary/20">
                            <Plus className="w-5 h-5" />
                            Add Visiting Doctor
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
                        <DialogHeader className="p-8 pb-0">
                            <DialogTitle className="text-2xl font-bold">Add New Visiting Doctor</DialogTitle>
                            <DialogDescription>
                                Enter professional details and visiting schedule for the consultant.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Full Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Dr. Jane Smith" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="specialization"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Specialization</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Cardiology" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="qualification"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Qualification</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="MD, DM (Cardiology)" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="experience"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Experience (Years)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="12" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="registrationNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Registration Number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="MCI-12345" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="profilePhoto"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Profile Photo URL</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="https://example.com/photo.jpg" {...field} className="rounded-xl h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4 pt-4 border-t border-border/40">
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Visiting Schedule
                                    </h3>

                                    <FormField
                                        control={form.control}
                                        name="schedule.days"
                                        render={() => (
                                            <FormItem>
                                                <div className="mb-4">
                                                    <FormLabel className="text-base">Consultation Days</FormLabel>
                                                </div>
                                                <div className="flex flex-wrap gap-4">
                                                    {DAYS.map((day) => (
                                                        <FormField
                                                            key={day.id}
                                                            control={form.control}
                                                            name="schedule.days"
                                                            render={({ field }) => {
                                                                return (
                                                                    <FormItem
                                                                        key={day.id}
                                                                        className="flex flex-row items-start space-x-3 space-y-0"
                                                                    >
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value?.includes(day.id)}
                                                                                onCheckedChange={(checked) => {
                                                                                    return checked
                                                                                        ? field.onChange([...field.value, day.id])
                                                                                        : field.onChange(
                                                                                            field.value?.filter(
                                                                                                (value) => value !== day.id
                                                                                            )
                                                                                        )
                                                                                }}
                                                                            />
                                                                        </FormControl>
                                                                        <FormLabel className="font-normal">
                                                                            {day.id}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                )
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="schedule.startTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Start Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} className="rounded-xl h-11" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="schedule.endTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>End Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} className="rounded-xl h-11" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <DialogFooter className="pt-6">
                                    <Button
                                        type="submit"
                                        className="w-full md:w-auto h-12 px-8 rounded-2xl font-bold shadow-lg shadow-primary/10"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Add Doctor Profile
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-border/60">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                            <Stethoscope className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold">No visiting doctors found</h3>
                        <p className="text-muted-foreground mt-2">Start by adding your first consultant profile.</p>
                    </div>
                ) : (
                    filteredDoctors.map((doctor) => (
                        <Card key={doctor._id} className="group relative overflow-hidden rounded-3xl border-border/60 shadow-sm hover:shadow-xl transition-all duration-300 bg-card hover:-translate-y-1">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent opacity-50" />

                            <CardHeader className="flex flex-row items-start gap-4 p-6">
                                <Avatar className="h-16 w-16 border-2 border-primary/20 p-0.5 rounded-2xl">
                                    <AvatarImage src={doctor.profilePhoto} className="object-cover rounded-xl" />
                                    <AvatarFallback className="rounded-xl bg-primary/5 text-primary text-xl font-bold">
                                        {doctor.name.split(' ').map((n: string) => n[0]).join('')}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{doctor.name}</h3>
                                    <p className="text-sm font-semibold text-primary/80">{doctor.specialization}</p>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Award className="w-3.5 h-3.5" />
                                        <span>{doctor.experience} Years Exp.</span>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full -mt-2 -mr-2 text-muted-foreground hover:bg-primary/5">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg">
                                            <Edit2 className="h-4 w-4" /> Edit Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg text-red-600 focus:text-red-600">
                                            <Trash2 className="h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>

                            <CardContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{doctor.qualification}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        <span>Reg: {doctor.registrationNumber}</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-muted/30 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Schedule
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                            <Clock className="w-3.5 h-3.5" />
                                            {doctor.schedule.startTime} - {doctor.schedule.endTime}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {doctor.schedule.days.map((day: string) => (
                                            <Badge key={day} variant="secondary" className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-background/80">
                                                {day}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
