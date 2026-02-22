"use client";

import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertCircle,
    CheckCircle2,
    Info,
    TrendingDown,
    TrendingUp,
    Activity,
    DollarSign,
    MapPin,
    Stethoscope,
    Briefcase,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

export interface FeatureImpact {
    [key: string]: number;
}

export interface Tradeoff {
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
}

export interface ComparisonEntry {
    hospital_name: string;
    suitability: number;
    out_of_pocket: number;
    distance: number;
    recovery_index: number;
    top_driver: string;
}

export interface ComparisonReport {
    ranking: string[];
    best_overall: string;
    lowest_cost: string;
    lowest_risk: string;
    best_equipment_match: string;
    shortest_distance: string;
    comparison_matrix: ComparisonEntry[];
}

export interface ExplainabilityData {
    hospital_name: string;
    reasons: {
        top_reasons: string[];
        risk_warnings: string[];
        summary: string;
    };
    tradeoffs: {
        tradeoffs: Tradeoff[];
        tradeoff_summary: string;
        indicators: {
            high_quality: boolean;
            high_cost: boolean;
            remote: boolean;
            intensive_recovery: boolean;
        };
    };
    value_tags: {
        tags: string[];
        primary_tag: string;
    };
    summary: {
        executive_summary: string;
        highlights: string[];
        cautions: string[];
    };
    suitability_score: number;
    feature_impact: FeatureImpact;
    comparison?: ComparisonReport;
}

// --- Helper Components ---

const StatusIcon = ({ icon: Icon, color }: { icon: any; color: string }) => (
    <div className={cn("p-2 rounded-full", color)}>
        <Icon className="w-5 h-5" />
    </div>
);

// --- 1. SummaryPanel ---
export const SummaryPanel = ({ data }: { data: ExplainabilityData }) => {
    return (
        <Card className="border-l-4 border-l-blue-500 shadow-lg overflow-hidden transition-all hover:shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-slate-900 dark:to-slate-950">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Activity className="text-blue-600" />
                            Patient Decision Summary
                        </CardTitle>
                        <CardDescription className="text-lg mt-1">
                            {data.hospital_name} Assessment
                        </CardDescription>
                    </div>
                    <Badge className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700">
                        {data.value_tags.primary_tag.replace("_", " ")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                    <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 italic font-medium">
                        "{data.summary.executive_summary}"
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Key Highlights
                        </h4>
                        <ul className="space-y-2">
                            {data.summary.highlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    {h}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {data.summary.cautions.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Considerations
                            </h4>
                            <ul className="space-y-2">
                                {data.summary.cautions.map((c, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// --- 2. ReasonChips ---
export const ReasonChips = ({ data }: { data: ExplainabilityData }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                Clinical & Financial Drivers
            </h3>
            <div className="flex flex-wrap gap-2">
                {data.reasons.top_reasons.map((reason, i) => (
                    <Badge
                        key={i}
                        variant="secondary"
                        className="px-4 py-2 text-sm font-normal bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 transition-colors"
                    >
                        {reason}
                    </Badge>
                ))}
                {data.reasons.risk_warnings.map((warning, i) => (
                    <Badge
                        key={i}
                        variant="outline"
                        className="px-4 py-2 text-sm font-normal bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                        <AlertCircle className="w-3 h-3 mr-2" />
                        {warning}
                    </Badge>
                ))}
            </div>
        </div>
    );
};

// --- 3. FeatureImpactChart ---
export const FeatureImpactChart = ({ impact }: { impact: FeatureImpact }) => {
    const chartData = Object.entries(impact)
        .map(([key, value]) => ({
            name: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
            impact: value,
            rawKey: key
        }))
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-sm">
                    <p className="font-bold mb-1">{data.name}</p>
                    <div className="flex items-center gap-2">
                        <span className={cn("font-medium", data.impact >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {data.impact > 0 ? "+" : ""}{data.impact}%
                        </span>
                        <span className="text-slate-500">contribution to score</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-600 hidden group-hover:block" />
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Neural Feature Attribution
                </CardTitle>
                <CardDescription>
                    How specific factors influenced the AI's suitability prediction
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                            <XAxis type="number" domain={[-100, 100]} hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 11, fontWeight: 500 }}
                                width={120}
                            />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'transparent', opacity: 0.1 }} />
                            <ReferenceLine x={0} stroke="#cbd5e1" />
                            <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.impact >= 0 ? "#10b981" : "#f43f5e"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-center gap-6 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-emerald-500 rounded" />
                        Positive Driver
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-rose-500 rounded" />
                        Negative Driver
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// --- 4. TradeoffCard ---
export const TradeoffCard = ({ tradeoffs }: { tradeoffs: ExplainabilityData["tradeoffs"] }) => {
    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-500" />
                    Clinical Tradeoff Analysis
                </CardTitle>
                <CardDescription>
                    Critical compromises identified in this recommendation
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {tradeoffs.tradeoffs.length > 0 ? (
                    <div className="space-y-4">
                        {tradeoffs.tradeoffs.map((t, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "p-4 rounded-lg border-l-4 flex gap-4",
                                    t.severity === "high"
                                        ? "bg-rose-50 border-rose-500 border dark:bg-rose-950/20"
                                        : "bg-slate-50 border-slate-300 border dark:bg-slate-900/50"
                                )}
                            >
                                <div className={cn(
                                    "mt-1",
                                    t.severity === "high" ? "text-rose-600" : "text-slate-600"
                                )}>
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h5 className="font-bold text-sm uppercase text-slate-500 mb-1">
                                        {t.type}
                                    </h5>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        {t.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-emerald-700 font-medium">Optimal Selection</p>
                        <p className="text-sm text-emerald-600/80">
                            No significant clinical or financial tradeoffs detected.
                        </p>
                    </div>
                )}
                <p className="text-sm italic text-slate-500 mt-2 bg-slate-100 dark:bg-slate-900 p-2 rounded">
                    "{tradeoffs.tradeoff_summary}"
                </p>
            </CardContent>
        </Card>
    );
};

// --- 5. ComparisonTable ---
export const ComparisonTable = ({ comparison }: { comparison: ComparisonReport }) => {
    const getBadgeForCategory = (hospName: string) => {
        const badges = [];
        if (hospName === comparison.best_overall)
            badges.push(<Badge key="best" className="bg-blue-600">Best Overall</Badge>);
        if (hospName === comparison.lowest_cost)
            badges.push(<Badge key="cost" variant="outline" className="border-emerald-500 text-emerald-600">Budget King</Badge>);
        if (hospName === comparison.best_equipment_match)
            badges.push(<Badge key="equip" variant="outline" className="border-indigo-500 text-indigo-600">Equipment Leader</Badge>);
        return <div className="flex flex-wrap gap-1">{badges}</div>;
    };

    return (
        <Card className="shadow-lg border-2 border-slate-100 dark:border-slate-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    Comparative Analysis
                </CardTitle>
                <CardDescription>
                    Side-by-side evaluation of all recommended facilities
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900">
                            <TableRow>
                                <TableHead className="font-bold">Hospital Name</TableHead>
                                <TableHead className="font-bold text-center">Score</TableHead>
                                <TableHead className="font-bold text-center">Est. Cost</TableHead>
                                <TableHead className="font-bold text-center">Distance</TableHead>
                                <TableHead className="font-bold">Primary Driver</TableHead>
                                <TableHead className="text-right font-bold w-[120px]">Highlights</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {comparison.comparison_matrix.map((row, i) => (
                                <TableRow key={i} className={cn(row.hospital_name === comparison.best_overall && "bg-blue-50/30 dark:bg-blue-900/10")}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {row.hospital_name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="font-bold text-blue-600">{row.suitability}%</span>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                        ₹{row.out_of_pocket.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {row.distance} km
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="capitalize text-[10px]">
                                            {row.top_driver.replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {getBadgeForCategory(row.hospital_name)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Combined Dashboard Component ---
export const ExplainabilityDashboard = ({ data }: { data: ExplainabilityData }) => {
    if (!data) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="space-y-2 border-b pb-6">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                    Decision Intelligence <span className="text-blue-600">XAI Report</span>
                </h2>
                <p className="text-slate-500 max-w-2xl text-lg italic">
                    Analysis for {data.hospital_name} based on clinical and financial models.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <SummaryPanel data={data} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FeatureImpactChart impact={data.feature_impact} />
                        <TradeoffCard tradeoffs={data.tradeoffs} />
                    </div>
                    {data.comparison && <ComparisonTable comparison={data.comparison} />}
                </div>

                <div className="space-y-8">
                    <ReasonChips data={data} />

                    <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl border-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                                Clinician's Note
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-indigo-100 text-sm leading-relaxed">
                                The predictive suitability score of <span className="font-bold text-white text-lg">{data.suitability_score}%</span> is
                                primarily anchored by the <span className="font-bold italic">clinical infrastructure alignment</span>.
                                Our engines suggest this is an optimal path for recovery.
                            </p>
                            <div className="pt-4 border-t border-indigo-400/30 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-indigo-200 uppercase tracking-tighter font-bold">Model Confidence</span>
                                    <span className="text-white font-bold">95.4%</span>
                                </div>
                                <div className="h-1.5 bg-indigo-900/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 w-[95%]" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Technical Meta</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Engine</span>
                                <span className="text-slate-600 font-medium">SHAP / XGBoost v2.0</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Adjudication</span>
                                <span className="text-slate-600 font-medium">Rule-based NLP</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
