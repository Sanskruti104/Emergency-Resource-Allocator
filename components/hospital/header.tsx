"use client"

import { BadgeCheck, Bell, Search, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface HeaderProps {
    hospitalName?: string;
    isVerified?: boolean;
}

export function Header({ hospitalName = "Hospital Admin", isVerified = true }: HeaderProps) {
    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white/80 px-8 backdrop-blur-md">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-96 max-w-full hidden md:block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search records, treatments..."
                        className="pl-9 rounded-xl border-border/60 bg-muted/30 focus-visible:ring-primary/20"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-white"></span>
                </Button>

                <div className="flex items-center gap-3 pr-2">
                    <div className="flex flex-col items-end hidden sm:flex">
                        <div className="flex items-center gap-1.5 leading-none">
                            <span className="text-sm font-semibold">{hospitalName}</span>
                            {isVerified && (
                                <BadgeCheck className="h-4 w-4 text-primary fill-primary/10" />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">Hospital Account</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                                <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
                                    <AvatarImage src="" alt={hospitalName} />
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                        {hospitalName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{hospitalName}</p>
                                    <p className="text-xs leading-none text-muted-foreground italic">Verified Institution</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="rounded-lg">
                                <User className="mr-2 h-4 w-4" />
                                <span>Profile Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg text-destructive focus:text-destructive">
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
