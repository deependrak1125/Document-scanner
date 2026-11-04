function escapeMarkdown(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/([`*_{}\[\]<>#+.!|~-])/g, "\\$1");
}
export function documentMarkdown(title: string, pages: string[], fallback = "") {
  const text = pages.some(p => p.trim()) ? pages : [fallback];
  if (!text.some(p => p.trim())) throw new Error("Recognize text before exporting Markdown.");
  return `# ${escapeMarkdown(title.replace(/[\r\n]+/g, " "))}\n\n` + text.map((page, i) => `## Page ${i + 1}\n\n${escapeMarkdown(page.trim()) || "_No text recognized on this page._"}\n`).join("\n");
}
