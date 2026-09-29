"use client"

import React, { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    error?: string
    helperText?: string
    icon?: React.ReactNode
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
    ({ id, label, error, helperText, icon, className, ...props }, ref) => {
        const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`

        return (
            <div className="space-y-1.5 text-left">
                <label
                    htmlFor={inputId}
                    className="text-xs font-semibold tracking-wide uppercase text-slate-700 select-none block"
                >
                    {label}
                </label>

                <div className="relative rounded-lg shadow-sm">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            {icon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        id={inputId}
                        className={cn(
                            "w-full h-11 px-3.5 rounded-lg text-sm bg-white text-slate-900",
                            "border border-slate-300 placeholder:text-slate-400",
                            "transition-all duration-150 ease-in-out",
                            "focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10",
                            icon && "pl-10",
                            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10",
                            className
                        )}
                        {...props}
                    />
                </div>

                {error && (
                    <p className="text-xs font-medium text-rose-600 flex items-center gap-1 pt-0.5" role="alert">
                        <span className="inline-block h-1 w-1 rounded-full bg-rose-600" />
                        {error}
                    </p>
                )}

                {!error && helperText && (
                    <p className="text-[11px] text-slate-500 pt-0.5">{helperText}</p>
                )}
            </div>
        )
    }
)

AuthInput.displayName = "AuthInput"
