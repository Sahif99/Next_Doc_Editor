export function Footer() {
  const name = process.env.NEXT_PUBLIC_PROFILE_NAME || "Your Name";
  const github = process.env.NEXT_PUBLIC_PROFILE_GITHUB || "https://github.com/your-username";
  const linkedin =
    process.env.NEXT_PUBLIC_PROFILE_LINKEDIN || "https://www.linkedin.com/in/your-username";

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <p>
          Built by <span className="font-bold text-slate-900">{name}</span>
        </p>
        <div className="flex gap-4">
          <a href={github} target="_blank" rel="noreferrer" className="font-bold text-blue-600">
            GitHub
          </a>
          <a href={linkedin} target="_blank" rel="noreferrer" className="font-bold text-blue-600">
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
