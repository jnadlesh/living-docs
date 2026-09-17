// Small Markdown readers. They understand only what the documentation rules allow:
// one H1 title, H2 sections, lists, links and backticked paths.

const H1 = /^# (.+)$/;
const H2 = /^## (.+)$/;
const FENCE = /^```/;
const LINK = /\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const LINK_DEFINITION = /^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm;
const BACKTICKED = /`([^`]+)`/g;
// A sentence ends at punctuation followed by a new capitalised sentence or the end of the
// passage. A full stop inside "v1.2" or before a lowercase word does not end one.
const SENTENCE_END = /[.!?]+(?=\s+[A-Z"'(\[`]|\s*$)/g;

/** Drops fenced code blocks so their contents are never read as headings or links. */
export function withoutFences(text) {
  let fenced = false;
  return text
    .split("\n")
    .filter((line) => {
      if (FENCE.test(line.trim())) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join("\n");
}

/** Splits a page into its title and its H2 sections, in the order they appear. */
export function parsePage(text) {
  const lines = withoutFences(text).split("\n");
  const sections = [];
  let title = null;
  for (const line of lines) {
    const h1 = H1.exec(line);
    const h2 = H2.exec(line);
    if (h1 && title === null) title = h1[1].trim();
    else if (h2) sections.push({ heading: h2[1].trim(), lines: [] });
    else if (sections.length > 0) sections.at(-1).lines.push(line);
  }
  return {
    title,
    sections: sections.map((s) => ({ heading: s.heading, body: s.lines.join("\n").trim() })),
  };
}

/** The body of one section, or null when the page does not have it. */
export function sectionBody(page, heading) {
  const found = page.sections.find((s) => s.heading === heading);
  return found ? found.body : null;
}

/** The first `count` sentences of a passage, joined on one line. */
export function firstSentences(text, count) {
  const flat = text.replace(/\s+/g, " ").trim();
  const ends = [...flat.matchAll(SENTENCE_END)].map((m) => m.index + m[0].length);
  if (ends.length === 0) return flat;
  return flat.slice(0, ends[Math.min(count, ends.length) - 1]).trim();
}

/** Link targets that point at files in this repository, without any #anchor. */
export function relativeLinks(text) {
  const prose = withoutFences(text);
  const targets = [...prose.matchAll(LINK), ...prose.matchAll(LINK_DEFINITION)]
    .map((m) => m[1].replace(/^<|>$/g, ""));
  return targets
    .filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t) && !t.startsWith("#"))
    .map((t) => t.split("#")[0])
    .filter((t) => t.length > 0);
}

/** Prose only: no fenced blocks, no inline code, no link targets. */
export function proseOnly(text) {
  return withoutFences(text)
    .replace(BACKTICKED, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(LINK_DEFINITION, " ");
}

/** Backticked entries in a list: the code paths a page says it describes. */
export function listedPaths(body) {
  return body
    .split("\n")
    .filter((line) => /^\s*[-*] /.test(line))
    .flatMap((line) => [...line.matchAll(BACKTICKED)].map((m) => m[1].trim()))
    .filter((path) => path.length > 0);
}

/** Replaces the text between a named pair of generated-block markers. */
export function replaceBlock(text, name, content) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`missing generated block "${name}"`);
  }
  const body = content.trim().length > 0 ? `\n${content.trim()}\n` : "\n";
  return `${text.slice(0, from + start.length)}${body}${text.slice(to)}`;
}
