import type { ReactNode } from "react";

// Простая безопасная разметка: «## » — подзаголовок, «- » — пункт списка, пустая строка — абзац. HTML не допускается.
export function renderMarkdown(md: string): ReactNode {
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/);
  return blocks.map((b, i) => {
    const lines = b.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    if (lines[0].startsWith("## ")) return <h2 key={i}>{lines[0].slice(3)}</h2>;
    if (lines.every((l) => l.startsWith("- "))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{lines.join(" ")}</p>;
  });
}
