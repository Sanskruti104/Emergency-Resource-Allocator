"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from "recharts"
import {
    Users,
    Search,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Target
} from "lucide-react"

const queriedTreatments = [
    { name: "General Consultation", value: 450 },
    { name: "Laparoscopic Surgery", value: 300 },
    { name: "Cardiac Checkup", value: 250 },
    { name: "Dental Root Canal", value: 200 },
    { name: "Orthopedic MRI", value: 150 },
]

const recommendationTrend = [
    { month: "Sep", count: 80 },
    { month: "Oct", count: 120 },
    { month: "Nov", count: 190 },
    { month: "Dec", count: 160 },
    { month: "Jan", count: 210 },
    { month: "Feb", count: 280 },
]

const suitabilityMetrics = [
    { name: "Matched", value: 75 },
    { name: "Partially Matched", value: 15 },
    { name: "Not Matched", value: 10 },
]

const COLORS = ["#2563EB", "#7DD3FC", "#E0F2FE", "#F1F5F9"]

export default function AnalyticsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Advanced Analytics</h1>
                <p className="text-muted-foreground mt-1">Data-driven insights into hospital performance and user reach.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Reach</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12,450</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-emerald-500 font-medium flex items-center">
                                <ArrowUpRight className="h-3 w-3" /> +12%
                            </span>
                            increase from last month
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Recommendation Rate</CardTitle>
                        <Target className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">84.2%</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-emerald-500 font-medium flex items-center">
                                <ArrowUpRight className="h-3 w-3" /> +5.4%
                            </span>
                            above network average
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Search Visibility</CardTitle>
                        <Search className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Top 5</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-amber-500 font-medium flex items-center">
                                <Activity className="h-3 w-3" /> Stable
                            </span>
                            position in Mumbai region
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Suitability Score</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">4.8/5.0</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-emerald-500 font-medium flex items-center">
                                <ArrowUpRight className="h-3 w-3" /> +0.2
                            </span>
                            based on user preferences
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4 rounded-2xl border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Recommendation Trends</CardTitle>
                        <CardDescription>Number of times this hospital was recommended to patients over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={recommendationTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#2563EB"
                                    strokeWidth={3}
                                    dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 rounded-2xl border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Most Queried Treatments</CardTitle>
                        <CardDescription>Service demand based on user search queries.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={queriedTreatments} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 rounded-2xl border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Suitability Average</CardTitle>
                        <CardDescription>Patient preference match distribution.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={suitabilityMetrics}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {suitabilityMetrics.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 text-xs font-medium text-muted-foreground mt-4">
                            <div className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-[#2563EB]"></div>
                                Matched
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-[#7DD3FC]"></div>
                                Partial
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-[#E0F2FE]"></div>
                                None
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 rounded-2xl border-border/60 shadow-sm bg-primary/5 border-primary/10">
                    <CardHeader>
                        <CardTitle className="text-primary italic">AI Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-xl bg-white/80 border border-primary/10 shadow-sm">
                            <p className="text-sm font-semibold text-primary mb-1">High Demand Alert</p>
                            <p className="text-xs text-muted-foreground">
                                Queries for <strong>"Laparoscopic Surgery"</strong> in your region have increased by 28% this week. Consider updating your capacity or active specialists.
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/80 border border-primary/10 shadow-sm">
                            <p className="text-sm font-semibold text-primary mb-1">Pricing Opportunity</p>
                            <p className="text-xs text-muted-foreground">
                                Your pricing for <strong>"Cardiac Checkup"</strong> is 15% lower than the regional average, contributing to higher suitability scores.
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/80 border border-primary/10 shadow-sm opacity-60 grayscale cursor-not-allowed">
                            <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                                Competitive Benchmarking
                                <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Pro</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Upgrade to compare your reach with top-performing hospitals in the MedDecision network.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
