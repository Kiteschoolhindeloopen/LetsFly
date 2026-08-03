// Gruppenrabatt für Privatstunden, wie auf kiteschoolhindeloopen.com beworben:
// 2 Personen -35%, 3+ Personen -45% auf den Stundenpreis pro Person.
export const GROUP_DISCOUNT_PERCENT: Record<1 | 2 | 3, number> = {
  1: 0,
  2: 35,
  3: 45,
};

export function groupSize(participants: number): 1 | 2 | 3 {
  return participants >= 3 ? 3 : participants === 2 ? 2 : 1;
}

export function pricePerPersonHourCents(baseHourlyCents: number, participants: number): number {
  const discount = GROUP_DISCOUNT_PERCENT[groupSize(participants)];
  return Math.round(baseHourlyCents * (1 - discount / 100));
}
