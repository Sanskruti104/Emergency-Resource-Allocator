
import { Suspense } from "react";
import { TreatmentPathSelection } from "@/components/treatment/treatment-path-selection";

export const dynamic = "force-dynamic";

export default function TreatmentPathPage() {
    return (
        <Suspense>
            <TreatmentPathSelection />
        </Suspense>
    );
}
