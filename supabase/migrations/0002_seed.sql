-- 0002_seed.sql — role-independent seed data (courses, videos).
-- availability_windows/slots/bookings seed data that reference specific
-- users is handled separately in Task 15, after those accounts exist.

insert into public.course_offerings
  (id, name, category, description, duration_hours, min_group_size, max_group_size, package_hours, price_cents, price_per_hour_cents, includes_equipment, includes_iko, active)
values
  ('course-camp-2day', '2 Tage Anfänger Kitecamp', 'GROUP_CAMP', '12h Unterricht + 2h Theorie, Gruppe 2-4 Personen.', 14, 2, 4, null, 24000, null, true, true, true),
  ('course-camp-4day', '4 Tage Intensiv Kitecamp', 'GROUP_CAMP', '20-24h Wasserzeit + tägliche Theorie.', null, 2, 4, null, 44000, null, true, true, true),
  ('course-camp-5day', '5 Tage Kitecamp Woche', 'GROUP_CAMP', '25-30h Wasserzeit.', null, 2, 4, null, 55000, null, true, true, true),
  ('course-private-beginner', 'Privatstunden Einstieg', 'PRIVATE_HOURS', '2h Stundenpaket.', null, null, null, 2, 16000, 8000, true, true, true),
  ('course-private-intermediate', 'Privatstunden Fortgeschritten', 'PRIVATE_HOURS', '6h Stundenpaket.', null, null, null, 6, 39900, 6650, true, true, true),
  ('course-private-intensive', 'Privatstunden Intensiv', 'PRIVATE_HOURS', '10h Stundenpaket.', null, null, null, 10, 60000, 6000, true, true, true);

insert into public.videos (id, title, category, duration, image, description) values
  ('video-1', 'Kite-Check vor dem Start', 'Sicherheit & Material', '6:12', 'https://kiteschoolhindeloopen.com/images/bg-3.webp', 'So prüfst du Leinen, Aufhängung und Sicherheitssystem vor jeder Session – die wichtigste Routine, bevor du überhaupt ins Wasser gehst.'),
  ('video-2', 'Trapez richtig anlegen', 'Sicherheit & Material', '3:40', 'https://kiteschoolhindeloopen.com/images/kite2.webp', 'Sitzhöhe, Hakenposition und Quick-Release im Detail erklärt.'),
  ('video-3', 'Der erste Wasserstart', 'Wasserstart', '3:20', 'https://kiteschoolhindeloopen.com/images/kite1.webp', 'Board anschnallen, Kite in Startposition, Timing für den Zug – Schritt für Schritt zum sauberen Wasserstart.'),
  ('video-4', 'Wasserstart: Häufige Fehler', 'Wasserstart', '4:25', 'https://kiteschoolhindeloopen.com/images/kitesurf-bg.webp', 'Die typischen Anfängerfehler beim Wasserstart und wie du sie vermeidest.'),
  ('video-5', 'Bodydrag upwind', 'Bodydrag', '2:36', 'https://kiteschoolhindeloopen.com/images/kitesurf-bg.webp', 'Mit dem Kite gegen den Wind schwimmen – die Grundlage, um dein Board zurückzuholen.'),
  ('video-6', 'Bodydrag mit Board', 'Bodydrag', '3:12', 'https://kiteschoolhindeloopen.com/images/kite2.webp', 'Das Board vor dir herziehen, bevor du es anschnallst.'),
  ('video-7', 'Erste Meter fahren', 'Erste Fahrversuche', '6:37', 'https://kiteschoolhindeloopen.com/images/kite3.webp', 'Kantendruck aufbauen und die ersten stehenden Meter auf dem Board.'),
  ('video-8', 'Höhe laufen (Upwind)', 'Erste Fahrversuche', '5:48', 'https://kiteschoolhindeloopen.com/images/kite1.webp', 'So verlierst du beim Fahren keinen Weg mehr gegen den Wind.'),
  ('video-9', 'Erster Jump', 'Tricks & Fortgeschritten', '3:56', 'https://kiteschoolhindeloopen.com/images/bg-4.webp', 'Anlauf, Kitesteuerung und Landung für deinen ersten kontrollierten Sprung.'),
  ('video-10', 'Toeside fahren', 'Tricks & Fortgeschritten', '3:46', 'https://kiteschoolhindeloopen.com/images/kite3.webp', 'Die Fahrtrichtung wechseln und sicher auf der Zehenkante fahren.'),
  ('video-11', 'Windfenster verstehen', 'Wind- & Wetterkunde', '3:58', 'https://kiteschoolhindeloopen.com/images/bg-5.webp', 'Wie das Windfenster aufgebaut ist und warum Position im Fenster über Zug entscheidet.'),
  ('video-12', 'Wettervorhersage lesen', 'Wind- & Wetterkunde', '4:18', 'https://kiteschoolhindeloopen.com/images/bg-5.webp', 'Welche Vorhersage-Apps wir nutzen und worauf du für sichere Bedingungen achtest.');
