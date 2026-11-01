-- Only the KartUP tracks are offered: the 5 VMax venues + AMC Kart Tunari.
begin;
select plan(3);
select is((select count(*)::int from public.tracks where is_active), 6, 'six active tracks');
select is((select string_agg(slug, ',' order by slug) from public.tracks where is_active),
          'amc-kart,vmax-brasov,vmax-cluj,vmax-romexpo,vmax-timisoara,vmax-titan', 'the 5 VMax venues + AMC Kart');
select is((select string_agg(name, ',' order by slug) from public.tracks where is_active),
          'AMC Kart,VMax Brașov,VMax Cluj,VMax Romexpo,VMax Timișoara,VMax Titan', 'short track names');
select * from finish();
rollback;
