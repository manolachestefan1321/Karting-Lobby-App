-- Shorter track names, so they fit on the session cards ("VMax Romexpo" instead of
-- "VMax Electric Indoor Karting Romexpo"). Only names change; nothing is deleted.
update public.tracks set name = 'VMax Romexpo'   where slug = 'vmax-romexpo';
update public.tracks set name = 'VMax Titan'     where slug = 'vmax-titan';
update public.tracks set name = 'VMax Cluj'      where slug = 'vmax-cluj';
update public.tracks set name = 'VMax Brașov'    where slug = 'vmax-brasov';
update public.tracks set name = 'VMax Timișoara' where slug = 'vmax-timisoara';
