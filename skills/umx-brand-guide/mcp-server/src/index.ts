import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = path.join(SKILL_ROOT, "assets");
const REFS_DIR = path.join(SKILL_ROOT, "references");

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = parseInt(process.env.PORT ?? "3737");
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

const server = new McpServer({ name: "umx-brand-mcp-server", version: "1.0.0" });

// ── Tool 1: brand text ────────────────────────────────────────────────────────

server.registerTool(
  "umx_get_brand_text",
  {
    title: "Get UMX Brand Text",
    description: `Return the UMX VI manual in Markdown. Covers colors, typography, layout, UI specs, and brand positioning.
Sections: 1=品牌定位, 2=LOGO规范, 3=色彩体系, 4=字体规范, 5=版式, 6=交互UI, 7=VI手册结构, 8=图片清单, 9=色值汇总, 10=文字层数据.
Args:
  - section (1-10, optional): Return only this section. Omit to get the full document.`,
    inputSchema: z.object({
      section: z.number().int().min(1).max(10).optional()
        .describe("Section number 1-10. Omit for full document."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ section }) => {
    const text = await fs.readFile(path.join(REFS_DIR, "brand-guide.md"), "utf8");
    if (!section) {
      return { content: [{ type: "text", text }] };
    }
    const lines = text.split("\n");
    // Headers look like "## 1. 品牌定位 / Branding"
    const headers = lines.map((l, i) => ({ i, l })).filter(({ l }) => /^## \d+\./.test(l));
    const idx = headers.findIndex(({ l }) => new RegExp(`^## ${section}\\.`).test(l));
    if (idx === -1) {
      return { content: [{ type: "text", text: `Section ${section} not found.` }] };
    }
    const start = headers[idx].i;
    const end = idx + 1 < headers.length ? headers[idx + 1].i : lines.length;
    return { content: [{ type: "text", text: lines.slice(start, end).join("\n") }] };
  }
);

// ── Tool 2: logo SVG ──────────────────────────────────────────────────────────

const LOGO_FILES: Record<string, string> = {
  full: "logo-full.svg",
  symbol: "logo-symbol-X.svg",
  wordmark: "logo-wordmark.svg",
};

server.registerTool(
  "umx_get_logo",
  {
    title: "Get UMX Logo SVG",
    description: `Return a UMX logo as SVG text, production-ready.
Variants: 'full' (X symbol + UMX wordmark), 'symbol' (X only, 80×80), 'wordmark' (UMX letters, 174×54).
Colors: 'black' (default) or 'white'.`,
    inputSchema: z.object({
      variant: z.enum(["full", "symbol", "wordmark"]).describe("full | symbol | wordmark"),
      color: z.enum(["black", "white"]).default("black").describe("black (default) or white"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ variant, color }) => {
    let svg = await fs.readFile(path.join(ASSETS_DIR, "logo", LOGO_FILES[variant]), "utf8");
    if (color === "white") svg = svg.replace(/fill="black"/g, 'fill="white"');
    return { content: [{ type: "text", text: svg }] };
  }
);

// ── Tool 3: VI frame ──────────────────────────────────────────────────────────

const FRAME_MAP: Record<number, string> = {
  1: "LOGO封面",
  4: "品牌关键词",
  6: "品牌描述",
  7: "未来主义/复古未来主义",
  8: "目录:LOGO规范索引",
  9: "关键词详情",
  10: "LOGO留白规则",
  11: "色彩阐释",
  12: "强调色阐释",
  13: "UMX LOGO规范页",
  16: "英文字体/主色黑",
  17: "中文字体/强调色",
  18: "文字层级展示",
  20: "版式示例",
  22: "交互UI规范",
};

server.registerTool(
  "umx_get_frame",
  {
    title: "Get UMX VI Manual Frame",
    description: `Return the URL of a VI manual page image (PNG @2x).
Available frames: ${Object.entries(FRAME_MAP).map(([n, d]) => `${n}(${d})`).join(", ")}.
Args:
  - frame_number: frame number (e.g. 11 for color system, 22 for UI specs)`,
    inputSchema: z.object({
      frame_number: z.number().int().min(1).max(30).describe("VI manual frame number"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ frame_number }) => {
    const files = await fs.readdir(path.join(ASSETS_DIR, "frames"));
    const match = files.find(f => f.startsWith(`Frame_${frame_number}_`) && f.endsWith(".png"));
    if (!match) {
      const available = Object.keys(FRAME_MAP).join(", ");
      return { content: [{ type: "text", text: `Frame ${frame_number} not found. Available: ${available}` }] };
    }
    const desc = FRAME_MAP[frame_number] ?? "";
    const url = `${PUBLIC_URL}/assets/frames/${encodeURIComponent(match)}`;
    return {
      content: [{ type: "text", text: `Frame ${frame_number}${desc ? ` — ${desc}` : ""}\n${url}` }],
    };
  }
);

// ── Tool 4: list assets ───────────────────────────────────────────────────────

server.registerTool(
  "umx_list_assets",
  {
    title: "List UMX Brand Assets",
    description: "Return a summary of all available UMX assets: logos (SVG), VI frames (PNG), and image fill count.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(ASSETS_DIR, "manifest.json"), "utf8")) as {
      file: unknown;
      exportedAt: string;
      logo: Record<string, { file: string; bytes: number }>;
      frames: Array<{ name: string; file: string; bytes: number }>;
      imageFills: Record<string, unknown>;
    };
    const result = {
      exportedAt: manifest.exportedAt,
      logos: Object.entries(manifest.logo).map(([name, info]) => ({
        name,
        url: `${PUBLIC_URL}/${info.file}`,
        bytes: info.bytes,
      })),
      frames: manifest.frames.map(f => ({
        name: f.name,
        url: `${PUBLIC_URL}/${f.file}`,
        bytes: f.bytes,
      })),
      imageFillCount: Object.keys(manifest.imageFills).length,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

// ── Express + MCP endpoint ────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/assets", express.static(ASSETS_DIR));

// CORS — allow any LAN client (Claude Code, Gemini CLI, etc.)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, HOST, () => {
  console.log(`\nUMX Brand MCP Server`);
  console.log(`  MCP   →  http://<your-ip>:${PORT}/mcp`);
  console.log(`  Files →  http://<your-ip>:${PORT}/assets/`);
  console.log(`\nColleagues: add to .mcp.json:`);
  console.log(`  { "umx-brand": { "type": "http", "url": "http://<your-ip>:${PORT}/mcp" } }\n`);
});
