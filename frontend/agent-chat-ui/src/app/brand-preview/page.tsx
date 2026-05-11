import { UmxSymbol, UmxWordmark } from "@/components/icons/umx-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Separator } from "@/components/ui/separator";

const COLOR_TOKENS: Array<{ name: string; var: string; hex: string }> = [
  { name: "UMX BLACK", var: "--umx-black", hex: "#000000" },
  { name: "UMX WHITE", var: "--umx-white", hex: "#FFFFFF" },
  { name: "UMX SILVER", var: "--umx-silver", hex: "#D3D3D4" },
  { name: "ACID GREEN", var: "--umx-acid", hex: "#DAFC08" },
  { name: "CYBER VIOLET", var: "--umx-violet", hex: "#7201FF" },
];

const SURFACE_TOKENS = [
  { name: "BG / 0", var: "--umx-bg-0" },
  { name: "BG / 1", var: "--umx-bg-1" },
  { name: "BG / 2", var: "--umx-bg-2" },
  { name: "BG / 3", var: "--umx-bg-3" },
  { name: "LINE", var: "--umx-line" },
  { name: "LINE / STRONG", var: "--umx-line-strong" },
];

export default function BrandPreview() {
  return (
    <main className="umx-scrollbar min-h-screen overflow-x-hidden bg-[var(--umx-bg-0)] text-[var(--umx-white)]">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-[var(--umx-line)] px-8 py-5">
        <div className="flex items-center gap-3">
          <UmxSymbol size={28} className="text-[var(--umx-white)]" />
          <UmxWordmark size={22} />
          <span className="ml-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
            · COMPANY AGENT / BRAND PREVIEW
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
          STAGE 01 / DESIGN TOKENS
        </span>
      </header>

      <div className="mx-auto max-w-6xl space-y-16 px-8 py-12">
        {/* §1 LOGO */}
        <section>
          <SectionLabel index="01" title="LOGO" />
          <div className="grid grid-cols-3 gap-px border border-[var(--umx-line)] bg-[var(--umx-line)]">
            <LogoCell bg="var(--umx-white)" fg="var(--umx-black)">
              <UmxSymbol size={72} className="text-[var(--umx-black)]" />
            </LogoCell>
            <LogoCell bg="var(--umx-black)" fg="var(--umx-white)">
              <UmxSymbol size={72} className="text-[var(--umx-white)]" />
            </LogoCell>
            <LogoCell bg="var(--umx-acid)" fg="var(--umx-black)">
              <UmxSymbol size={72} className="text-[var(--umx-black)]" />
            </LogoCell>
          </div>
        </section>

        {/* §2 色彩 */}
        <section>
          <SectionLabel index="02" title="BRAND COLOR" />
          <div className="grid grid-cols-5 gap-px border border-[var(--umx-line)] bg-[var(--umx-line)]">
            {COLOR_TOKENS.map((c) => (
              <div
                key={c.var}
                style={{ background: `var(${c.var})` }}
                className="aspect-square p-4 flex flex-col justify-between"
              >
                <span
                  className="font-mono text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: c.hex === "#FFFFFF" || c.hex === "#DAFC08" ? "#000" : "#fff", opacity: 0.85 }}
                >
                  {c.name}
                </span>
                <span
                  className="font-mono text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: c.hex === "#FFFFFF" || c.hex === "#DAFC08" ? "#000" : "#fff", opacity: 0.85 }}
                >
                  {c.hex}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-6 gap-px border border-[var(--umx-line)] bg-[var(--umx-line)]">
            {SURFACE_TOKENS.map((s) => (
              <div
                key={s.var}
                style={{ background: `var(${s.var})` }}
                className="h-20 p-3 flex items-end"
              >
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* §3 字体层级 */}
        <section>
          <SectionLabel index="03" title="TYPOGRAPHY" />
          <div className="space-y-6 border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8">
            <Stack tag="H1 · 64PX">
              <h1 className="m-0">FUTURISM</h1>
            </Stack>
            <Stack tag="H2 · 48PX">
              <h2 className="m-0">RETRO-FUTURISM</h2>
            </Stack>
            <Stack tag="H3 · 32PX">
              <h3 className="m-0">COMPANY AGENT</h3>
            </Stack>
            <Stack tag="BODY · 16PX">
              <p className="m-0 text-base leading-relaxed text-[var(--umx-white)]">
                未来主义 / 复古未来主义。关键词：高颜值、氛围感、不妥协、航空、滑雪、声光电、赛博朋克、机械美学。
                A high-end aesthetic that merges mechanical precision with atmospheric depth.
              </p>
            </Stack>
            <Stack tag="DATA · 10PX MONO">
              <code className="font-mono">
                THREAD_ID 019E15CF-2CB0-75C2-BBA2-C3F3020513A9 · 312MS · TOK 1024
              </code>
            </Stack>
          </div>
        </section>

        {/* §4 装饰元素 */}
        <section>
          <SectionLabel index="04" title="TEXTURE & ATMOSPHERE" />
          <div className="grid grid-cols-2 gap-px border border-[var(--umx-line)] bg-[var(--umx-line)]">
            <div className="relative h-48 overflow-hidden bg-[var(--umx-bg-1)] p-6">
              <div className="absolute inset-0 umx-dot-grid" />
              <div className="relative flex h-full flex-col justify-end">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                  SILVER DOT GRID · #D3D3D4 / 12PX
                </span>
              </div>
            </div>
            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[var(--umx-violet)]/40 to-[var(--umx-acid)]/30 p-6">
              <div className="umx-glass absolute inset-6 flex items-end p-4">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-white)]">
                  GLASS · BLUR 32PX (VI §6)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* §5 按钮 */}
        <section>
          <SectionLabel index="05" title="BUTTONS" />
          <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="acid">Send →</Button>
              <Button variant="violet">SubAgent</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">link · normal case</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" variant="outline" aria-label="icon">✕</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </section>

        {/* §5b 输入 */}
        <section>
          <SectionLabel index="06" title="INPUTS" />
          <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8 space-y-4">
            <Input placeholder="USERNAME · 输入员工 ID" />
            <Input type="password" placeholder="••••••••" />
            <Textarea placeholder="描述你的任务… 例如：帮我起草一份内部公告" rows={4} />
            <Input aria-invalid placeholder="ARIA INVALID 示例" defaultValue="invalid value" />
          </div>
        </section>

        {/* §6 Chip 标签 */}
        <section>
          <SectionLabel index="07" title="CHIPS / BADGES" />
          <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Chip pulse variant="violet">HR-AGENT · ACTIVE</Chip>
              <Chip variant="acid">SKILL · EMPLOYEE-HANDBOOK</Chip>
              <Chip variant="outline">▸ THREAD · 019E15CF</Chip>
              <Chip variant="solid">tool · search_brand_assets</Chip>
              <Chip variant="muted">312ms · 1024 tok</Chip>
              <Chip variant="outline" size="sm">v0.1</Chip>
              <Chip variant="acid" size="lg">ON · LIGHT</Chip>
            </div>
          </div>
        </section>

        {/* §7 Switch + Avatar + Skeleton */}
        <section>
          <SectionLabel index="08" title="STATE · MISC" />
          <div className="border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8 space-y-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch defaultChecked />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                  THEME · ON / LIGHT
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                  THEME · OFF / DARK
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>HF</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>
                  <UmxSymbol size={16} className="text-[var(--umx-silver)]" />
                </AvatarFallback>
              </Avatar>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                AVATAR · USER / AGENT
              </span>
            </div>

            <Separator />

            <div className="space-y-2 max-w-md">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                SKELETON · LOADING
              </span>
            </div>
          </div>
        </section>

        {/* §8 Card */}
        <section>
          <SectionLabel index="09" title="CARD" />
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Marketing Agent</CardTitle>
                <CardDescription>文案 / EDM / 活动策划</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Chip variant="solid">copywriting-cn</Chip>
                  <Chip variant="solid">campaign-templates</Chip>
                  <Chip variant="solid">compliance-redlines</Chip>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>HR Agent</CardTitle>
                <CardDescription>制度 / 招聘 / 内部公告</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Chip variant="solid">employee-handbook</Chip>
                  <Chip variant="solid">compensation</Chip>
                  <Chip variant="solid">recruiting</Chip>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* §10 模拟消息样式 */}
        <section>
          <SectionLabel index="10" title="MESSAGE SAMPLE" />
          <div className="space-y-6 border border-[var(--umx-line)] bg-[var(--umx-bg-1)] p-8">
            {/* user */}
            <div className="flex justify-end">
              <div className="max-w-[78%] border-r-2 border-[var(--umx-silver)] pr-4 text-right">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                  HEFAN · HR · 10:24
                </div>
                <div className="mt-1 leading-relaxed">
                  你好，我是 HR。请帮我起草一份请假流程的内部公告。
                </div>
              </div>
            </div>
            {/* agent */}
            <div className="flex">
              <div className="max-w-[78%] border-l-2 border-[var(--umx-violet)] pl-4">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-violet)]">
                  █▌ HR-AGENT  ▸  LOADED: EMPLOYEE-HANDBOOK
                </div>
                <div className="mt-2 leading-relaxed">
                  好的。根据《员工手册》§4.2，标准请假流程如下：
                  <span className="umx-caret" />
                </div>
                <div className="mt-3 rounded-[2px] border border-[var(--umx-line)] bg-[var(--umx-bg-2)] p-3">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
                    ▾ TOOL · SEARCH_BRAND_ASSETS(QUERY="内部公告模板") · 312MS
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-[var(--umx-silver)]">
                    4 results returned
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-[var(--umx-line)] pt-8 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
          UMX · COMPANY AGENT · BRAND PREVIEW · 2026
        </footer>
      </div>
    </main>
  );
}

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-4">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
        {index}.
      </span>
      <h2 className="m-0 text-2xl">{title}</h2>
    </div>
  );
}

function LogoCell({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ background: bg, color: fg }}
      className="aspect-square flex items-center justify-center"
    >
      {children}
    </div>
  );
}

function Stack({
  tag,
  children,
}: {
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-6 border-b border-[var(--umx-line)] pb-4 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--umx-text-dim)]">
        {tag}
      </span>
      <div>{children}</div>
    </div>
  );
}
