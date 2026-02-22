import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        // Forward the file to the Python backend
        const pythonFormData = new FormData();
        pythonFormData.append("file", file, "voice_input.wav");

        const pyRes = await fetch("http://localhost:8001/analyze-voice", {
            method: "POST",
            body: pythonFormData,
        });

        if (!pyRes.ok) {
            const errorText = await pyRes.text();
            throw new Error(`Python Backend Error: ${pyRes.status} - ${errorText}`);
        }

        const data = await pyRes.json();

        return NextResponse.json({
            transcript: data.transcript,
            detected_specialty: data.detected_specialty,
            confidence: data.confidence,
            stt_confidence: data.stt_confidence
        });

    } catch (error: any) {
        console.error("Voice Analysis API Error:", error.message);
        return NextResponse.json({
            error: "Internal server error",
            message: error.message
        }, { status: 500 });
    }
}
