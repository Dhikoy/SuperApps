const PTKP_ANNUAL: Record<string, number> = {
  "TK/0": 54_000_000,
  "TK/1": 58_500_000,
  "TK/2": 63_000_000,
  "TK/3": 67_500_000,
  "K/0": 58_500_000,
  "K/1": 63_000_000,
  "K/2": 67_500_000,
  "K/3": 72_000_000,
};

export function getPtkpAnnual(status: string): number {
  return PTKP_ANNUAL[status] ?? PTKP_ANNUAL["TK/0"];
}

export function calcPph21Monthly(gajiBruto: number, ptkpStatus: string) {
  const penghasilanTahunan = gajiBruto * 12;
  const ptkp = getPtkpAnnual(ptkpStatus);
  const pkp = Math.max(0, penghasilanTahunan - ptkp);

  let pphTahunan = 0;
  if (pkp > 0) {
    const layer1 = Math.min(pkp, 60_000_000);
    pphTahunan += layer1 * 0.05;
    const sisa = pkp - 60_000_000;
    if (sisa > 0) {
      const layer2 = Math.min(sisa, 190_000_000);
      pphTahunan += layer2 * 0.15;
      const sisa2 = sisa - 190_000_000;
      if (sisa2 > 0) {
        const layer3 = Math.min(sisa2, 2_500_000_000);
        pphTahunan += layer3 * 0.25;
        const sisa3 = sisa2 - 2_500_000_000;
        if (sisa3 > 0) pphTahunan += sisa3 * 0.3;
      }
    }
  }

  return {
    gajiBruto,
    penghasilanTahunan,
    ptkp,
    pkp,
    pphTahunan: Math.round(pphTahunan),
    pphBulanan: Math.round(pphTahunan / 12),
  };
}
