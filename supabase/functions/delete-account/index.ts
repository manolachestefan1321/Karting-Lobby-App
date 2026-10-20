// Deletes the calling user's account (required by Apple & Google).
//
// What happens:
//  1. Their avatar files are removed from Storage.
//  2. The auth user is deleted → profile, experience, stats are removed by
//     ON DELETE CASCADE. Financial records (added in step 4) keep the amounts
//     but lose the link to the person (ON DELETE SET NULL) for accounting.
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { handler, HttpError, json } from '../_shared/http.ts';

Deno.serve(
  handler(async (req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const user = await requireUser(req);
    const db = adminClient();

    // Step 4 adds: cancel the user's upcoming bookings using the normal refund rules.

    const { data: files } = await db.storage.from('avatars').list(user.id, { limit: 100 });
    if (files?.length) {
      await db.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
    }

    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new HttpError(500, 'delete_failed', error.message);
    return json({ ok: true });
  }),
);
