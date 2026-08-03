-- 0003_fix_private_hour_pricing.sql — corrects the private-hour packages to
-- match the real prices advertised on kiteschoolhindeloopen.com (Einstieg
-- 2h/€160, Fortgeschritten 6h/€399, Intensiv 10h/€600). 0002_seed.sql already
-- ran with the old placeholder numbers, so update the existing rows here.

update public.course_offerings set
  name = 'Privatstunden Einstieg',
  description = '2h Stundenpaket.',
  package_hours = 2,
  price_cents = 16000,
  price_per_hour_cents = 8000
where id = 'course-private-beginner';

update public.course_offerings set
  name = 'Privatstunden Fortgeschritten',
  description = '6h Stundenpaket.',
  package_hours = 6,
  price_cents = 39900,
  price_per_hour_cents = 6650
where id = 'course-private-intermediate';

update public.course_offerings set
  name = 'Privatstunden Intensiv',
  description = '10h Stundenpaket.',
  package_hours = 10,
  price_cents = 60000,
  price_per_hour_cents = 6000
where id = 'course-private-intensive';
