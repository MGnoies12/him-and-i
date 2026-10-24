'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace, useToast, useI18n } from '@/components/providers';
import { errorText, performClientAction, requestJSON } from '@/lib/client-api';
import type { ActionInput } from '@/schemas/actions';
import { browserSupabase } from '@/lib/supabase/browser';
export function useData<T>(
  resource: string,
  params: Record<string, string> = {},
  requiresCouple = true,
) {
  const workspace = useWorkspace();
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ['data', workspace.userId, resource, query],
    queryFn: async () =>
      (await requestJSON<{ data: T }>(`/api/data/${resource}${query ? '?' + query : ''}`)).data,
    enabled: workspace.configured && !!workspace.userId && (!requiresCouple || !!workspace.couple),
    refetchInterval: resource === 'cycle' ? 60000 : resource === 'letters' ? 30000 : false,
  });
}
export function useAction() {
  const client = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const mutation = useMutation<unknown, Error, ActionInput>({
    mutationFn: (input) => performClientAction(input),
    onSuccess: async (_result, action) => {
      await client.invalidateQueries({ queryKey: ['data'] });
      if (
        action.type.startsWith('couple.') ||
        action.type.startsWith('invitation.') ||
        action.type.startsWith('profile.') ||
        action.type === 'cycle.delete'
      )
        router.refresh();
    },
    onError: (error) => toast(errorText(error, t), 'error'),
  });
  async function run<T = unknown>(
    input: ActionInput,
  ): Promise<{ ok: true; data: T } | { ok: false }> {
    try {
      return { ok: true, data: (await mutation.mutateAsync(input)) as T };
    } catch {
      return { ok: false };
    }
  }
  return { run, pending: mutation.isPending };
}
export function useRealtime(tables: string[]) {
  const { userId, couple, conversationId } = useWorkspace();
  const client = useQueryClient();
  const stable = tables.join(',');
  useEffect(() => {
    const db = browserSupabase();
    if (!db || !userId) return;
    let channel = db.channel(`workspace:${userId}:${stable}`);
    for (const table of stable.split(',')) {
      const filter =
        table === 'messages' && conversationId
          ? `conversation_id=eq.${conversationId}`
          : table === 'notifications'
            ? `owner_id=eq.${userId}`
            : table === 'memories' && couple
              ? `couple_id=eq.${couple.id}`
              : undefined;
      // Postgres DELETE events cannot be reliably RLS-filtered by Realtime.
      // Subscribe only to INSERT/UPDATE; deletions reconcile on refetch, never leak cross-space IDs.
      for (const event of ['INSERT', 'UPDATE'] as const)
        channel = channel.on(
          'postgres_changes',
          { event, schema: 'public', table, ...(filter ? { filter } : {}) },
          () => {
            void client.invalidateQueries({ queryKey: ['data'] });
          },
        );
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void client.invalidateQueries({ queryKey: ['data'] });
    });
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, couple, conversationId, stable, client]);
}
