"use client"

import React, { useState, forwardRef } from "react"
import { Eye, EyeOff, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    error?: string
    showStrength?: boolean
    matchStatus?: "idle" | "match" | "mismatch"
    helperText?: string
}

export function calculatePasswordStrength(password: string): {
    score: number // 0 to 4
    label: string
    color: string
} {
    if (!password) {
        return { score: 0, label: "None", color: "bg-slate-200" }
    }

    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++

    switch (score) {
        case 1:
            return { score: 1, label: "Weak", color: "bg-rose-500" }
        case 2:
            return { score: 2, label: "Fair", color: "bg-amber-500" }
        case 3:
            return { score: 3, label: "Good", color: "bg-blue-500" }
        case 4:
            return { score: 4, label: "Strong", color: "bg-emerald-500" }
        default:
            return { score: 0, label: "Weak", color: "bg-rose-500" }
    }
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
    (
        {
            id,
            label,
            error,
            showStrength = false,
            matchStatus = "idle",
            helperText,
            className,
            value,
            onChange,
            ...props
        },
        ref
    ) => {
        const [isVisible, setIsVisible] = useState(false)
        const [internalValue, setInternalValue] = useState("")

        const currentValue = typeof value === "string" ? value : internalValue
        const strength = showStrength ? calculatePasswordStrength(currentValue) : null

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setInternalValue(e.target.value)
            if (onChange) {
                onChange(e)
            }
        }

        const inputId = id || `password-field-${Math.random().toString(36).substring(2, 9)}`

        return (
            <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                    <label
                        htmlFor={inputId}
                        className="text-xs font-semibold tracking-wide uppercase text-slate-700 select-none"
                    >
                        {label}
                    </label>

                    {matchStatus === "match" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <Check className="h-3 w-3" /> Passwords match
                        </span>
                    )}
                    {matchStatus === "mismatch" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                            <X className="h-3 w-3" /> Passwords do not match
                        </span>
                    )}
                </div>

                <div className="relative rounded-lg shadow-sm">
                    <input
                        ref={ref}
                        id={inputId}
                        type={isVisible ? "text" : "password"}
                        value={value}
                        onChange={handleInputChange}
                        autoComplete={props.autoComplete || "current-password"}
                        className={cn(
                            "w-full h-11 px-3.5 pr-10 rounded-lg text-sm bg-white text-slate-900",
                            "border border-slate-300 placeholder:text-slate-400",
                            "transition-all duration-150 ease-in-out",
                            "focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10",
                            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10",
                            className
                        )}
                        {...props}
                    />

                    <button
                        type="button"
                        onClick={() => setIsVisible(!isVisible)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-teal-600 transition-colors"
                        aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                        tabIndex={0}
                    >
                        {isVisible ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>
                </div>

                {/* Password Strength Indicator */}
                {showStrength && currentValue.length > 0 && strength && (
                    <div className="pt-1.5 space-y-1" aria-live="polite">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Security Strength:</span>
                            <span
                                className={cn(
                                    "font-semibold",
                                    strength.score === 1 && "text-rose-600",
                                    strength.score === 2 && "text-amber-600",
                                    strength.score === 3 && "text-blue-600",
                                    strength.score === 4 && "text-emerald-600"
                                )}
                            >
                                {strength.label}
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 h-1.5">
                            {[1, 2, 3, 4].map((step) => (
                                <div
                                    key={step}
                                    className={cn(
                                        "h-full rounded-full transition-colors duration-200",
                                        step <= strength.score ? strength.color : "bg-slate-200"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Field-level error */}
                {error && (
                    <p className="text-xs font-medium text-rose-600 flex items-center gap-1 pt-0.5" role="alert">
                        <span className="inline-block h-1 w-1 rounded-full bg-rose-600" />
                        {error}
                    </p>
                )}

                {/* Helper text */}
                {!error && helperText && (
                    <p className="text-[11px] text-slate-500 pt-0.5">{helperText}</p>
                )}
            </div>
        )
    }
)

PasswordInput.displayName = "PasswordInput"
