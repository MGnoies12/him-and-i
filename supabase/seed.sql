-- Public, non-personal game prompts only. No invented couples, profiles or private activity.
insert into public.game_questions(id,game_type,question_fa,question_en,options_fa,options_en) values
('10000000-0000-4000-8000-000000000001','know','یک روز ایده‌آل برای من چه شکلی است؟','What does my ideal day look like?',null,null),
('10000000-0000-4000-8000-000000000002','know','چه چیز کوچکی همیشه حالم را بهتر می‌کند؟','What little thing always makes me feel better?',null,null),
('10000000-0000-4000-8000-000000000003','know','دوست دارم با هم به کجا سفر کنیم؟','Where would I love us to travel together?',null,null),
('10000000-0000-4000-8000-000000000004','know','کدام خاطره‌مان برای من خاص‌تر است؟','Which of our memories is especially meaningful to me?',null,null),
('10000000-0000-4000-8000-000000000005','know','وقتی خسته‌ام، چه کمکی دوست دارم؟','What kind of support do I like when I am tired?',null,null),
('10000000-0000-4000-8000-000000000006','choice','یک قرار برای آخر هفته','A date for the weekend',array['پیک‌نیک در طبیعت','شام در خانه'],array['A picnic outdoors','Dinner at home']),
('10000000-0000-4000-8000-000000000007','choice','اگر وقت آزاد داشته باشیم…','If we have some free time…',array['قدم‌زدن بی‌مقصد','فیلم و پتو'],array['A wandering walk','A film and a blanket']),
('10000000-0000-4000-8000-000000000008','choice','برای سفر بعدی','For our next trip',array['دریا و آفتاب','کوه و هوای خنک'],array['Sea and sunshine','Mountains and cool air']),
('10000000-0000-4000-8000-000000000009','choice','یک هدیه‌ی کوچک','A little gift',array['یک نامه‌ی دست‌نویس','یک تجربه‌ی مشترک'],array['A handwritten letter','A shared experience']),
('10000000-0000-4000-8000-000000000010','choice','آهنگِ لحظه‌مان','The soundtrack to our moment',array['آرام و بی‌کلام','شاد و پرانرژی'],array['Soft and instrumental','Bright and energetic']),
('10000000-0000-4000-8000-000000000011','daily','امروز برای چه چیز کوچکی قدردانی؟','What small thing are you grateful for today?',null,null),
('10000000-0000-4000-8000-000000000012','daily','این هفته چطور می‌توانم کنارت باشم؟','How can I be there for you this week?',null,null),
('10000000-0000-4000-8000-000000000013','daily','دوست داری چه سنت کوچکی با هم بسازیم؟','What little tradition would you like us to start?',null,null),
('10000000-0000-4000-8000-000000000014','daily','چه چیزی اخیراً لبخند روی لبت آورده؟','What has made you smile lately?',null,null),
('10000000-0000-4000-8000-000000000015','daily','یک آرزوی ساده برای روزهای پیش رو؟','A simple wish for the days ahead?',null,null)
on conflict(id) do nothing;
