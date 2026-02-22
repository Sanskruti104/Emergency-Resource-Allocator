"use client"

import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, AlertCircle, MessageSquare } from "lucide-react"
import { VoiceRecorder } from "@/components/treatment/voice-recorder"

const categories = [
  { value: "Orthopedic", label: "Orthopedics" },
  { value: "Cardiac", label: "Cardiology" },
  { value: "Neuro", label: "Neurology" },
  { value: "General Surgery", label: "General Surgery" },
  { value: "Oncology", label: "Oncology" },
  { value: "Maternity", label: "Maternity" },
  { value: "Pediatrics", label: "Pediatrics" },
]

interface StepDiagnosisProps {
  value: string
  onChange: (value: string) => void
}

export function StepDiagnosis({ value, onChange }: StepDiagnosisProps) {
  const [symptoms, setSymptoms] = useState("")
  const [isDetecting, setIsDetecting] = useState(false)
  const [detection, setDetection] = useState<{ specialty: string; confidence: number } | null>(null)
  const [showManual, setShowManual] = useState(false)

  // Auto-detection logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (symptoms.length > 5) {
        setIsDetecting(true)
        try {
          const res = await fetch("http://localhost:8001/analyze-symptoms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symptom_text: symptoms }),
          })
          const data = await res.json()
          if (data.detected_specialty) {
            setDetection({
              specialty: data.detected_specialty,
              confidence: data.confidence
            })
            onChange(data.detected_specialty)
          } else {
            setDetection(null)
          }
        } catch (error) {
          console.error("Detection failed:", error)
        } finally {
          setIsDetecting(false)
        }
      }
    }, 1000)

    return () => clearTimeout(delayDebounceFn)
  }, [symptoms, onChange])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Describe Your Symptoms</h2>
        <p className="mt-2 text-muted-foreground font-medium">
          Our AI will automatically detect the relevant medical specialty to find the best hospitals for you.
        </p>
      </div>

      <div className="bg-slate-50/80 rounded-3xl p-8 border border-slate-100 space-y-6 shadow-sm">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-12 w-12 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Clinical Voice Assistant</h3>
            <p className="text-sm text-slate-500 font-medium">Listening and Analyzing Symptoms</p>
          </div>
        </div>

        <div className="relative">
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-[90%] animate-in slide-in-from-left-2 duration-500">
              <p className="text-base font-bold text-slate-700 leading-relaxed italic">
                "Welcome! I am your clinical assistant. You can speak your symptoms by clicking the microphone or type them directly. I'll automatically find the right medical specialty for you."
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <Label htmlFor="symptoms" className="text-lg font-bold text-slate-800">Your Symptoms</Label>
              <VoiceRecorder onTranscription={(text) => setSymptoms(text)} />
            </div>
            <div className="relative group">
              <Textarea
                id="symptoms"
                placeholder="e.g. Sharp pain in the knee while walking, chest tightness after climbing stairs, persistent headache..."
                className="min-h-[160px] rounded-2xl text-lg p-6 border-slate-200 focus:ring-2 focus:ring-primary/20 transition-all bg-white shadow-sm outline-none"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
              {isDetecting && (
                <div className="absolute top-4 right-4 animate-spin">
                  <Loader2 className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>

        {detection && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500">
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 py-2.5 px-6 rounded-full text-sm font-bold flex gap-3 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Detected Specialty: {detection.specialty} ({Math.round(detection.confidence * 100)}%)
            </Badge>
            <button
              onClick={() => setShowManual(!showManual)}
              className="text-xs font-bold text-slate-400 hover:text-primary transition-colors underline decoration-dotted"
            >
              {showManual ? "Hide manual selection" : "Change Category Manually"}
            </button>
          </div>
        )}

        {!detection && symptoms.length > 5 && !isDetecting && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-2xl border border-amber-100 animate-in fade-in">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-bold">Unable to confidently detect category. Please provide more detail or select manually.</p>
            {!showManual && (
              <button
                onClick={() => setShowManual(true)}
                className="ml-auto text-sm font-bold underline"
              >
                Select Manually
              </button>
            )}
          </div>
        )}

        {(showManual || !detection) && (
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
            <Label htmlFor="diagnosis-category" className="font-bold">Manual Category Override</Label>
            <Select value={value} onValueChange={(val) => { onChange(val); setShowManual(false); }}>
              <SelectTrigger id="diagnosis-category" className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm font-medium">
                <SelectValue placeholder="Choose a diagnosis category" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="rounded-xl">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
