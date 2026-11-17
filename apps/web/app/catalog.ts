import summary from "../public/data/catalog-summary.v1.json";

const numberFormat = new Intl.NumberFormat("zh-CN");

export const formatCount = (value: number) => numberFormat.format(value);
export const formatHours = (milliseconds: number) => (milliseconds / 3_600_000).toFixed(2);
export const formatMiB = (bytes: number) => (bytes / 1_048_576).toFixed(1);

export const catalog = {
  counts: summary.counts,
  durationMs: summary.durationMs,
  bytes: summary.bytes,
  formats: summary.formats,
};
