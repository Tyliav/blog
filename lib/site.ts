export const site = {
  name: "CyberCheems",
  title: "CyberCheems · 学习笔记与技术博客",
  shortTitle: "CyberCheems",
  description:
    "记录机器学习、大模型系统、Serverless 与性能工程的学习笔记与项目实践。写给未来的自己，也写给正在看这篇的人。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  author: "CyberCheems",
  email: "1939523795@qq.com",
  github: "https://github.com/Tyliav",
  locale: "zh-CN",
  nav: [
    { href: "/", label: "首页" },
    { href: "/blog", label: "文章" },
    { href: "/tags", label: "标签" },
    { href: "/about", label: "关于" },
  ],
  /** 学习方向卡片，展示在首页。 */
  tracks: [
    {
      icon: "Brain",
      title: "大模型与智能系统",
      desc: "Transformer、RAG、推理优化、Agent 与模型服务的工程实现。",
      href: "/tags/大模型",
      accent: "from-violet-500/15 to-violet-500/0",
    },
    {
      icon: "Server",
      title: "Serverless 与云原生",
      desc: "函数计算、容器编排、Serverless 架构的成本与性能权衡。",
      href: "/tags/Serverless",
      accent: "from-sky-500/15 to-sky-500/0",
    },
    {
      icon: "Gauge",
      title: "性能工程",
      desc: "系统级性能剖析、基准测试方法与可观测性实践。",
      href: "/tags/性能工程",
      accent: "from-amber-500/15 to-amber-500/0",
    },
    {
      icon: "Code",
      title: "工程与开发实践",
      desc: "TypeScript、Python、前后端协作与日常开发踩坑记录。",
      href: "/tags/工程实践",
      accent: "from-emerald-500/15 to-emerald-500/0",
    },
  ],
};

export type SiteConfig = typeof site;
