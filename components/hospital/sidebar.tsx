"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    UserRound,
    Stethoscope,
    Activity,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    LogOut,
    ShieldCheck,
    Building2,
    Microscope,
    Users
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const menuItems = [
    { title: "Dashboard Overview", icon: LayoutDashboard, href: "/hospital/dashboard" },
    { title: "Hospital Profile", icon: UserRound, href: "/hospital/profile" },
    { title: "Visiting Doctors", icon: Users, href: "/hospital/doctors" },
    { title: "Capacity Management", icon: Activity, href: "/hospital/capacity" },
    { title: "Instruments & Equipment", icon: Microscope, href: "/hospital/instruments" },
    { title: "Treatments & Pricing", icon: Stethoscope, href: "/hospital/treatments" },
    { title: "Insurance Intelligence", icon: ShieldCheck, href: "/hospital/insurance" },
    { title: "Hospital Public Profile", icon: Building2, href: "/hospital/about" },
    { title: "Analytics", icon: BarChart3, href: "/hospital/analytics" },
]

export function Sidebar() {
    const pathname = usePathname()
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleLogout = async () => {
        await fetch('/api/auth/session', { method: 'DELETE' })
        window.location.href = '/login/hospital'
    }

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className="flex h-16 items-center justify-between border-b px-4 transition-all overflow-hidden whitespace-nowrap">
                {!isCollapsed && (
                    <span className="text-xl font-bold text-primary">MedDecision</span>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="ml-auto"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            <nav className="flex flex-col gap-2 p-4">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
                                isCollapsed && "justify-center px-0"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", !isCollapsed && "shrink-0")} />
                            {!isCollapsed && <span>{item.title}</span>}
                        </Link>
                    )
                })}
            </nav>

            <div className="absolute bottom-4 left-0 w-full px-4">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                        isCollapsed && "justify-center px-0"
                    )}
                    onClick={handleLogout}
                >
                    <LogOut className="h-5 w-5" />
                    {!isCollapsed && <span>Logout</span>}
                </Button>
            </div>
        </aside>
    )
}
