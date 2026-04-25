import {
  parsePhoneNumberFromString,
  AsYouType,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export interface ParsedPhone {
  e164: string;
  country: string;
  countryName: string;
  national: string;
  international: string;
  type: string;
  isValid: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", EG: "Egypt",
  DE: "Germany", FR: "France", AE: "UAE", SA: "Saudi Arabia",
  ES: "Spain", IT: "Italy", NL: "Netherlands", BE: "Belgium",
  CH: "Switzerland", AT: "Austria", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", IE: "Ireland", PT: "Portugal",
  GR: "Greece", PL: "Poland", CZ: "Czech Rep.", HU: "Hungary",
  RO: "Romania", TR: "Turkey", RU: "Russia", UA: "Ukraine",
  IL: "Israel", JO: "Jordan", LB: "Lebanon", SY: "Syria",
  IQ: "Iraq", IR: "Iran", KW: "Kuwait", QA: "Qatar",
  BH: "Bahrain", OM: "Oman", YE: "Yemen", PK: "Pakistan",
  IN: "India", BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal",
  CN: "China", JP: "Japan", KR: "South Korea", TW: "Taiwan",
  HK: "Hong Kong", SG: "Singapore", MY: "Malaysia", ID: "Indonesia",
  TH: "Thailand", VN: "Vietnam", PH: "Philippines", AU: "Australia",
  NZ: "New Zealand", BR: "Brazil", AR: "Argentina", MX: "Mexico",
  CL: "Chile", CO: "Colombia", PE: "Peru", VE: "Venezuela",
  ZA: "South Africa", NG: "Nigeria", KE: "Kenya", ET: "Ethiopia",
  MA: "Morocco", DZ: "Algeria", TN: "Tunisia", LY: "Libya",
  GH: "Ghana", CI: "Ivory Coast", SN: "Senegal", UG: "Uganda",
};

export function parsePhone(input: string, defaultCountry: CountryCode = "US"): ParsedPhone {
  const empty: ParsedPhone = {
    e164: input,
    country: "",
    countryName: "",
    national: input,
    international: input,
    type: "unknown",
    isValid: false,
  };
  if (!input) return empty;
  try {
    const n = parsePhoneNumberFromString(input, defaultCountry);
    if (!n) return empty;
    const country = n.country || defaultCountry;
    return {
      e164: n.number as string,
      country,
      countryName: COUNTRY_NAMES[country] || country,
      national: n.formatNational(),
      international: n.formatInternational(),
      type: n.getType() || "unknown",
      isValid: n.isValid(),
    };
  } catch {
    return empty;
  }
}

export function asYouType(input: string, defaultCountry: CountryCode = "US") {
  return new AsYouType(defaultCountry).input(input);
}

export function callingCode(country: CountryCode) {
  try {
    return `+${getCountryCallingCode(country)}`;
  } catch {
    return "";
  }
}

export function countryName(code: string) {
  return COUNTRY_NAMES[code] || code;
}
