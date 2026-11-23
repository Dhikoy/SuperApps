import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "mark",
  "blockquote",
  "a",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

/** Strip HTML for length / empty checks */
export function plainTextFromHtml(html: string): string {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeRichHtml(html: string): string {
  return DOMPurify.sanitize(String(html ?? ""), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function isRichHtmlEmpty(html: string): boolean {
  return plainTextFromHtml(html).length === 0;
}
