import type { ReactNode } from "react";

/**
 * Простая безопасная разметка (блог и тексты документов из админки), построчно:
 * «## » / «### » — подзаголовок, «- » или «* » — пункт списка, «1. » — пункт нумерованного списка,
 * пустая строка — новый абзац; строки подряд — один абзац. Текст сразу после подзаголовка (без пустой строки)
 * и списки внутри абзаца не теряются. HTML не допускается: всё — текстом.
 */
export function renderMarkdown(md: string): ReactNode {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const k = () => out.length;
  const flushPara = () => {
    if (para.length) out.push(<p key={k()}>{para.join(" ")}</p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((t, j) => <li key={j}>{t}</li>);
      out.push(list.ordered ? <ol key={k()}>{items}</ol> : <ul key={k()}>{items}</ul>);
    }
    list = null;
  };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(h[1].length === 2 ? <h2 key={k()}>{h[2]}</h2> : <h3 key={k()}>{h[2]}</h3>);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    const oli = /^\d+[.)]\s+(.*)$/.exec(line);
    if (li || oli) {
      flushPara();
      const ordered = !!oli;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((li ?? oli)![1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out;
}
