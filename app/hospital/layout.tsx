import { Sidebar } from "@/components/hospital/sidebar";
import { Header } from "@/components/hospital/header";
import { getServerSession } from "@/lib/auth-utils";
import clientPromise from "@/lib/mongodb";
import { redirect } from "next/navigation";

import { headers } from "next/headers";

export default async function HospitalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();
    const headerList = await headers();
    const isEmergencyBoard = headerList.get("x-emergency-board") === "1";

    if (!session) {
        if (isEmergencyBoard) {
            return (
                <div className="min-h-screen bg-slate-50/50">
                    <main className="flex-1">
                        {children}
                    </main>
                </div>
            );
        }
        redirect("/login/hospital");
    }

    // Role check and hospital info (Parallelized for performance)
    const client = await clientPromise;
    const db = client.db();

    const [userRecord, hospital] = await Promise.all([
        db.collection("users").findOne({ uid: session.uid }, { projection: { role: 1 } }),
        db.collection("hospitals").findOne({ uid: session.uid }, { projection: { hospitalName: 1, isVerified: 1 } })
    ]);

    if (userRecord?.role !== "hospital") {
        if (isEmergencyBoard) {
            return (
                <div className="min-h-screen bg-slate-50/50">
                    <main className="flex-1">
                        {children}
                    </main>
                </div>
            );
        }
        redirect("/login/hospital");
    }

    return (
        <div className="min-h-screen bg-slate-50/50">
            <Sidebar />
            <div className="flex flex-col transition-all duration-300 md:pl-64" id="main-content">
                <Header
                    hospitalName={hospital?.hospitalName || "Hospital Admin"}
                    isVerified={hospital?.isVerified ?? true}
                />
                <main className="flex-1 p-8">
                    {children}
                </main>
            </div>

            {/* Custom script to handle sidebar collapse space adjustment */}
            <script dangerouslySetInnerHTML={{
                __html: `
                    const observer = new MutationObserver((mutations) => {
                        const sidebar = document.querySelector('aside');
                        const main = document.querySelector('#main-content');
                        if (sidebar && main) {
                            if (sidebar.classList.contains('w-20')) {
                                main.style.paddingLeft = '5rem';
                            } else {
                                main.style.paddingLeft = '16rem';
                            }
                        }
                    });
                    const sidebar = document.querySelector('aside');
                    if (sidebar) observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
                `
            }} />
        </div>
    );
}
