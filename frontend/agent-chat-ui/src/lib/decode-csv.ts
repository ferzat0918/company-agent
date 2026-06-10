/**
 * 读取 CSV 文件文本，自动兼容 UTF-8 与 GBK/GB18030 编码。
 *
 * 背景：File.text() 永远按 UTF-8 解码。但国内 Windows 版 Excel「另存为 CSV」
 * 默认输出 GBK/GB18030 编码（即使原模板是 UTF-8 BOM，重新保存后也会被改写），
 * 用 UTF-8 解码这类文件会让中文变成乱码。
 *
 * 策略：先以 fatal 模式按 UTF-8 解码 —— 合法 UTF-8（含带 BOM 的模板）会成功；
 * 一旦遇到非法字节序列（典型的 GBK 文件）会抛错，回退用 gb18030 解码。
 * gb18030 是 GBK 的超集，浏览器 TextDecoder 原生支持，能覆盖简体中文 CSV。
 */
export async function readCsvText(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("gb18030").decode(buf);
  }
}
