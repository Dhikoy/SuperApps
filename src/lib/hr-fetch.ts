/** Helper fetch API HR dengan error message terstruktur. */
export async function hrFetchJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : "Permintaan gagal";
      return { ok: false, error: msg };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Gagal terhubung ke server" };
  }
}
