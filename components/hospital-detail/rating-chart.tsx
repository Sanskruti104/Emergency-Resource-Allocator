"use client";

import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer
} from "recharts";

interface RatingChartProps {
    data: {
        subject: string;
        A: number;
        fullMark: number;
    }[];
}

export default function RatingChart({ data }: RatingChartProps) {
    return (
        <div className="h-[300px] w-full bg-white/5 rounded-3xl p-4">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                    <Radar
                        name="Hospital"
                        dataKey="A"
                        stroke="#0ea5e9"
                        fill="#0ea5e9"
                        fillOpacity={0.5}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
