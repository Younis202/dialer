// Approximate per-minute rates ($/min). Real numbers come from provider APIs once configured.
// Source: published rates as of 2025 (Voip.ms, Twilio, Telnyx, Plivo).

export interface ProviderRate {
  provider: "voipms" | "twilio" | "telnyx" | "plivo" | "p2p" | "demo";
  perMinute: number;
  setupCents?: number;
}

const RATES: Record<string, Record<string, number>> = {
  voipms: {
    US: 0.009, CA: 0.009, GB: 0.012, EG: 0.110, DE: 0.014, FR: 0.014,
    AE: 0.080, SA: 0.110, ES: 0.014, IT: 0.014, NL: 0.014, BE: 0.014,
    AU: 0.025, JP: 0.030, CN: 0.022, IN: 0.020, BR: 0.020, MX: 0.025,
    RU: 0.030, TR: 0.025, IL: 0.020, PK: 0.060, BD: 0.060, NG: 0.060,
    KE: 0.080, ZA: 0.030, MA: 0.090, JO: 0.080, LB: 0.080, IQ: 0.140,
    SG: 0.018, MY: 0.018, TH: 0.022, VN: 0.022, PH: 0.140, ID: 0.030,
    KR: 0.018, TW: 0.022, HK: 0.018, NZ: 0.025,
  },
  twilio: {
    US: 0.014, CA: 0.014, GB: 0.018, EG: 0.180, DE: 0.020, FR: 0.020,
    AE: 0.110, SA: 0.140, ES: 0.020, IT: 0.020, NL: 0.020, BE: 0.020,
    AU: 0.035, JP: 0.040, CN: 0.030, IN: 0.025, BR: 0.025, MX: 0.030,
    RU: 0.040, TR: 0.035, IL: 0.025, PK: 0.080, BD: 0.080, NG: 0.080,
    KE: 0.110, ZA: 0.040, MA: 0.120, JO: 0.110, LB: 0.110, IQ: 0.180,
  },
  telnyx: {
    US: 0.0075, CA: 0.0075, GB: 0.011, EG: 0.115, DE: 0.013, FR: 0.013,
    AE: 0.085, SA: 0.115, ES: 0.013, IT: 0.013, AU: 0.025, JP: 0.030,
    IN: 0.018, BR: 0.018, MX: 0.025,
  },
  plivo: {
    US: 0.012, CA: 0.012, GB: 0.015, EG: 0.150, DE: 0.018, FR: 0.018,
    AE: 0.100, SA: 0.130, IN: 0.022, BR: 0.022, MX: 0.030,
  },
};

export function getRatesForCountry(country: string): ProviderRate[] {
  const c = country.toUpperCase() || "US";
  const out: ProviderRate[] = [];
  for (const [prov, table] of Object.entries(RATES)) {
    const r = table[c] ?? table["US"] ?? 0.05;
    out.push({ provider: prov as ProviderRate["provider"], perMinute: r });
  }
  out.push({ provider: "p2p", perMinute: 0 });
  return out.sort((a, b) => a.perMinute - b.perMinute);
}

export function cheapestProvider(country: string): ProviderRate {
  return getRatesForCountry(country)[0];
}
