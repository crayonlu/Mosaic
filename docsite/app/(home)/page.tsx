import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 px-4">
      <h1 className="text-4xl font-bold mb-4">Mosaic📔</h1>
      <p className="text-lg text-muted-foreground max-w-lg mb-8">
        A digital second brain for notes, moods, and memories.
      </p>
      <div className="flex gap-4">
        <Link
          href="/docs/getting-started"
          className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Get Started
        </Link>
        <a
          href="https://github.com/crayonlu/Mosaic"
          className="inline-flex items-center rounded-lg border px-6 py-3 font-medium hover:bg-secondary"
        >
          GitHub
        </a>
      </div>
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
        <FeatureCard title="Smart Notes" desc="Rich text editor with Markdown and HTML, AI auto-tagging" />
        <FeatureCard title="Mood Diary" desc="Daily mood tracking with visualized emotional patterns" />
        <FeatureCard title="Self-hosted" desc="Rust backend — your data stays under your control" />
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-left">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
