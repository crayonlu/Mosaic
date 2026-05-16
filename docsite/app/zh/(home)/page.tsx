import Link from 'next/link';
import { Book, Heart, Server, ArrowRight, GitFork } from 'lucide-react';

const features = [
  {
    icon: Book,
    title: '智能笔记',
    desc: '支持 Markdown 和 HTML 的富文本编辑器，AI 自动标签让整理更轻松。',
  },
  {
    icon: Heart,
    title: '心情日记',
    desc: '每日心情记录，可视化情绪变化趋势，洞察你的内心世界。',
  },
  {
    icon: Server,
    title: '自主托管',
    desc: 'Rust 后端 —— 你的数据完全由你掌控，隐私无忧。',
  },
];

export default function ZhHomePage() {
  return (
    <div className="flex flex-col items-center flex-1">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 w-full overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="gradient-blob w-[500px] h-[500px] top-[-200px] left-[-150px] bg-purple-500/30 dark:bg-purple-500/20" />
        <div className="gradient-blob w-[400px] h-[400px] bottom-[-100px] right-[-100px] bg-blue-500/30 dark:bg-blue-500/20" />

        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          <span className="gradient-text">Mosaic</span>
          <span className="ml-2">📔</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          你的数字第二大脑 —— 笔记、心情、回忆，尽在掌控。
          <br className="hidden md:inline" />
          开源、自主托管，为持久隐私而构建。
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/zh/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-lg border bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            快速开始
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com/crayonlu/Mosaic"
            className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 font-medium hover:bg-secondary transition-colors"
          >
            <GitFork className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-5xl px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="feature-card rounded-xl border bg-card p-6 text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
