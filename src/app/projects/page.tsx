import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getUserAndProfile, hasName } from "@/lib/supabase-server";

// Gated route: only signed-in users with a finished profile get here.
export default async function ProjectsPage() {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { data, error } = await supabase.from("projects").select("*");

    return (
        <>
            <NavBar />
            <main className="content-page">
                <h1 className="pixel-heading" style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>
                    Projects
                </h1>
                {error ? (
                    <p style={{ color: "var(--text)" }}>Something went wrong loading projects.</p>
                ) : !data || data.length === 0 ? (
                    <p style={{ color: "var(--text)" }}>No projects yet.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {data.map((project) => (
                            <div key={project.id} className="retro-card" style={{ padding: "1.5rem" }}>
                                <span className="retro-badge">[ACTIVE]</span>
                                <h2 style={{ fontSize: "1.1rem", margin: "0.75rem 0 0.5rem", color: "var(--text)" }}>
                                    {project.name}
                                </h2>
                                <p style={{ color: "var(--text-dim)", margin: 0 }}>{project.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
