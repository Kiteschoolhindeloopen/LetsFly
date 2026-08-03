// A private lesson always occupies two consecutive one-hour slots
// (e.g. booking 10:00 reserves both the 10:00 and the 11:00 slot).
export function hourSlotWindows(startsAt: string): { startsAt: string; endsAt: string }[] {
  const first = new Date(startsAt);
  const second = new Date(first);
  second.setHours(second.getHours() + 1);
  const third = new Date(second);
  third.setHours(third.getHours() + 1);
  return [
    { startsAt: first.toISOString(), endsAt: second.toISOString() },
    { startsAt: second.toISOString(), endsAt: third.toISOString() },
  ];
}
