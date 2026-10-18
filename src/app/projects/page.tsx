import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getUserAndProfile, hasName, navProps } from "@/lib/supabase-server";

// Gated route from Assignment 3: only signed-in users with a finished profile get here.
export default async function ProjectsPage() {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { data, error } = await supabase.from("projects").select("*");

    return (
        <>
            <NavBar {...navProps(supabase, profile)} />
            <main className="shell" style={{ paddingBottom: 96 }}>
                <div className="page-top">
                    <p className="mono" style={{ color: "var(--paper-faint)" }}>
                        Classified archive
                    </p>
                    <h1 className="display wide page-title">Projects</h1>
                </div>
                {error ? (
                    <p className="form-error">Error: projects didn&apos;t load.</p>
                ) : !data || data.length === 0 ? (
                    <p className="page-lede">No projects yet.</p>
                ) : (
                    <div>
                        {data.map((project) => (
                            <div key={project.id} className="project-row">
                                <h2 className="display" style={{ fontSize: "1.6rem" }}>
                                    {project.name}
                                </h2>
                                <p>{project.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
