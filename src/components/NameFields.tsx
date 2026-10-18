export default function NameFields({
    firstName,
    lastName,
}: {
    firstName?: string | null;
    lastName?: string | null;
}) {
    return (
        <>
            <label className="field-label mono" htmlFor="first_name">
                First name
            </label>
            <input
                className="field"
                id="first_name"
                name="first_name"
                defaultValue={firstName ?? ""}
                autoComplete="given-name"
                maxLength={80}
                required
            />
            <label className="field-label mono" htmlFor="last_name">
                Last name
            </label>
            <input
                className="field"
                id="last_name"
                name="last_name"
                defaultValue={lastName ?? ""}
                autoComplete="family-name"
                maxLength={80}
                required
            />
        </>
    );
}
