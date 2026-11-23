"use client";

const COMMON = ["password", "123456", "12345678", "qwerty", "bci123", "admin", "superapps", "password123"];

export type PasswordStrengthLevel = 0 | 1 | 2 | 3;

export function passwordStrength(password: string) {
  const checks = [
    { ok: password.length >= 8, label: "Minimal 8 karakter" },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: "Huruf besar & kecil" },
    { ok: /\d/.test(password), label: "Angka" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "Simbol (!@#…)" },
  ];
  let score = checks.filter((c) => c.ok).length + (password.length >= 12 ? 1 : 0);
  if (COMMON.includes(password.toLowerCase()) || /^(.)\1+$/.test(password)) score = 0;

  const level: PasswordStrengthLevel = !password ? 0 : score <= 2 ? 1 : score === 3 ? 2 : 3;
  return { level, checks };
}

const LEVELS = {
  1: { label: "Lemah", bar: "bg-red-500", text: "text-red-600" },
  2: { label: "Sedang", bar: "bg-amber-500", text: "text-amber-600" },
  3: { label: "Kuat", bar: "bg-emerald-500", text: "text-emerald-600" },
} as const;

export function PasswordStrength({ password }: { password: string }) {
  const { level, checks } = passwordStrength(password);
  if (level === 0) return null;
  const style = LEVELS[level];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= level ? style.bar : "bg-slate-200"}`} />
          ))}
        </div>
        <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "text-emerald-600" : "text-slate-400"}>
            {c.ok ? "✓" : "○"} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
