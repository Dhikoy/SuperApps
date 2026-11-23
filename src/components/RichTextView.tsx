import { sanitizeRichHtml } from "@/lib/rich-text";

const VIEW_CLASS =
  "rich-text text-sm text-slate-700 leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-[#503200] [&_a]:underline";

export function RichTextView({
  html,
  className = "",
  empty = "—",
}: {
  html: string | null | undefined;
  className?: string;
  empty?: string;
}) {
  const raw = String(html ?? "").trim();
  if (!raw) {
    return <span className={`text-slate-400 italic ${className}`}>{empty}</span>;
  }

  const looksHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (!looksHtml) {
    return (
      <div className={`whitespace-pre-wrap leading-relaxed text-sm text-slate-700 ${className}`}>
        {raw}
      </div>
    );
  }

  const clean = sanitizeRichHtml(raw);
  return (
    <div
      className={`${VIEW_CLASS} ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
