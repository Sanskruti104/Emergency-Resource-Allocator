import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart2 } from "lucide-react";
import { Hospital } from "./types";

interface ActionBarProps {
    hospital: Hospital;
}

export function ActionBar({ hospital }: ActionBarProps) {
    return (
        <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-4 justify-end items-center">
            <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-xl h-12 border-2">
                <BarChart2 className="w-4 h-4 mr-2" />
                Compare with others
            </Button>
            <Button size="lg" className="w-full sm:w-auto rounded-xl h-12 shadow-lg bg-blue-600 hover:bg-blue-700 text-white">
                Proceed to Cost Breakdown
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    );
}
