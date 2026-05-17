import type { EvPackageCtaEmbed } from '../schemas/ev-package-cta.schema';

export type EvPackageCtaDto = {
  label: string;
  linkType: 'internal' | 'external';
  url: string;
  iosUrl?: string;
  androidUrl?: string;
  fallbackUrl?: string;
};

export const DEFAULT_EV_PACKAGE_CTA: EvPackageCtaDto = {
  label: 'პაკეტის არჩევა',
  linkType: 'internal',
  url: '/premium-offers?source=ev_charging_map',
  fallbackUrl: '/premium-offers?source=ev_charging_map',
};

export function mapPackageCtaEmbed(
  raw?: EvPackageCtaEmbed | Record<string, unknown> | null,
): EvPackageCtaDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = o.url != null ? String(o.url).trim() : '';
  const label = o.label != null ? String(o.label).trim() : '';
  if (!url && !label) return null;
  const linkType = o.linkType === 'external' ? 'external' : 'internal';
  return {
    label: label || DEFAULT_EV_PACKAGE_CTA.label,
    linkType,
    url: url || DEFAULT_EV_PACKAGE_CTA.url,
    iosUrl: o.iosUrl ? String(o.iosUrl).trim() : undefined,
    androidUrl: o.androidUrl ? String(o.androidUrl).trim() : undefined,
    fallbackUrl: o.fallbackUrl ? String(o.fallbackUrl).trim() : undefined,
  };
}

export function resolvePackageCta(
  globalCta: EvPackageCtaDto,
  partnerCta?: EvPackageCtaDto | null,
): EvPackageCtaDto {
  if (!partnerCta) return globalCta;
  return {
    label: partnerCta.label || globalCta.label,
    linkType: partnerCta.linkType || globalCta.linkType,
    url: partnerCta.url || globalCta.url,
    iosUrl: partnerCta.iosUrl ?? globalCta.iosUrl,
    androidUrl: partnerCta.androidUrl ?? globalCta.androidUrl,
    fallbackUrl: partnerCta.fallbackUrl ?? globalCta.fallbackUrl,
  };
}

export function parsePackageCtaBody(
  body: Record<string, unknown>,
): EvPackageCtaEmbed | undefined {
  const raw = body.packageCta;
  if (raw === null) return undefined;
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const url = o.url != null ? String(o.url).trim() : '';
  const label = o.label != null ? String(o.label).trim() : '';
  if (!url && !label && !o.linkType) return undefined;
  return {
    label: label || DEFAULT_EV_PACKAGE_CTA.label,
    linkType: o.linkType === 'external' ? 'external' : 'internal',
    url: url || DEFAULT_EV_PACKAGE_CTA.url,
    iosUrl: o.iosUrl ? String(o.iosUrl).trim() : undefined,
    androidUrl: o.androidUrl ? String(o.androidUrl).trim() : undefined,
    fallbackUrl: o.fallbackUrl ? String(o.fallbackUrl).trim() : undefined,
  };
}
