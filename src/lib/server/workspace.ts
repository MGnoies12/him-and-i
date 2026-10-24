import 'server-only';
import { cache } from 'react';
import { serverSupabase } from '@/lib/supabase/server';
import type { Workspace } from '@/types/models';
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const db = await serverSupabase();
  const empty: Workspace = {
    configured: !!db,
    userId: null,
    profile: null,
    personalization: null,
    couple: null,
    members: [],
    conversationId: null,
  };
  if (!db) return empty;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return empty;
  const [profile, membership, personalization] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).single(),
    db.from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle(),
    db.from('profile_preferences').select('*').eq('owner_id', user.id).single(),
  ]);
  if (profile.error || membership.error || personalization.error)
    return { ...empty, userId: user.id, error: true };
  if (!membership.data)
    return {
      ...empty,
      userId: user.id,
      profile: profile.data,
      personalization: personalization.data,
    };
  const coupleId = membership.data.couple_id;
  const [couple, members, conversation] = await Promise.all([
    db.from('couples').select('*').eq('id', coupleId).single(),
    db.from('couple_members').select('user_id,profiles(*)').eq('couple_id', coupleId),
    db.from('conversations').select('id').eq('couple_id', coupleId).single(),
  ]);
  return {
    ...empty,
    userId: user.id,
    profile: profile.data,
    personalization: personalization.data,
    couple: couple.data,
    members:
      members.data?.map((m) => m.profiles).filter((p): p is NonNullable<typeof p> => p !== null) ??
      [],
    conversationId: conversation.data?.id ?? null,
    error: !!(couple.error || members.error || conversation.error),
  };
});
