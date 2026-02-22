"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Square, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface VoiceRecorderProps {
    onTranscription: (text: string, specialty?: string) => void
}

export function VoiceRecorder({ onTranscription }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })
                await handleVoiceUpload(audioBlob)
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
            toast.info("Recording started... Speak your symptoms clearly.")
        } catch (err) {
            console.error("Mic access denied", err)
            toast.error("Microphone access denied. Please enable permissions.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }

    const handleVoiceUpload = async (blob: Blob) => {
        setIsProcessing(true)
        try {
            const formData = new FormData()
            formData.append("file", blob)

            const res = await fetch("/api/voice/analyze", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) throw new Error("Voice processing failed")

            const data = await res.json()
            if (data.transcript) {
                onTranscription(data.transcript, data.detected_specialty)
                toast.success("Voice transcribed successfully!")
            } else {
                toast.error("Could not understand the audio. Please try again.")
            }
        } catch (err) {
            console.error("Voice upload error", err)
            toast.error("Failed to process voice input.")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            {!isRecording ? (
                <Button
                    onClick={startRecording}
                    disabled={isProcessing}
                    variant="outline"
                    className="h-12 w-12 rounded-full border-primary/20 hover:border-primary hover:bg-primary/5 transition-all text-primary shadow-sm"
                    title="Speak Symptoms"
                >
                    {isProcessing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Mic className="h-5 w-5" />
                    )}
                </Button>
            ) : (
                <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="h-12 w-12 rounded-full animate-pulse shadow-lg shadow-rose-500/20"
                    title="Stop Recording"
                >
                    <Square className="h-5 w-5 fill-current" />
                </Button>
            )}

            {isRecording && (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-sm font-bold animate-in fade-in slide-in-from-left-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    Listening...
                </div>
            )}

            {isProcessing && (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-full text-sm font-bold animate-in fade-in">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    AI Processing...
                </div>
            )}
        </div>
    )
}
