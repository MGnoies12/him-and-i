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
  const [profile, membership] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).single(),
    db.from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle(),
  ]);
  if (profile.error || membership.error) return { ...empty, userId: user.id, error: true };
  if (!membership.data) return { ...empty, userId: user.id, profile: profile.data };
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
    couple: couple.data,
    members:
      members.data?.map((m) => m.profiles).filter((p): p is NonNullable<typeof p> => p !== null) ??
      [],
    conversationId: conversation.data?.id ?? null,
    error: !!(couple.error || members.error || conversation.error),
  };
});
