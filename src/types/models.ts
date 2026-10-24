import type { Row } from './database';
export type Profile = Row<'profiles'>;
export type Asset = Row<'upload_assets'>;
export type Memory = Row<'memories'> & {
  memory_media: { id: string; asset_id: string; position: number; upload_assets: Asset | null }[];
  memory_favorites: { user_id: string }[];
};
export type Message = Row<'messages'> & {
  upload_assets: Asset | null;
  message_reactions: Row<'message_reactions'>[];
};
export type Letter = Row<'letters'> & { upload_assets: Asset | null };
export type Event = Row<'events'> & { event_responses: Row<'event_responses'>[] };
export type Mood = Row<'daily_moods'> & { mood_notes: Row<'mood_notes'> | null };
export type Playlist = Row<'playlists'> & {
  playlist_tracks: (Row<'playlist_tracks'> & { track_favorites: Row<'track_favorites'>[] })[];
};
export type Game = Row<'game_sessions'> & {
  game_questions: Row<'game_questions'>;
  game_answers: Row<'game_answers'>[];
};
export interface Workspace {
  configured: boolean;
  userId: string | null;
  profile: Profile | null;
  couple: Row<'couples'> | null;
  members: Profile[];
  conversationId: string | null;
  error?: boolean;
}
export interface CycleData {
  records: Row<'period_records'>[];
  settings: Row<'cycle_settings'> | null;
  reminders: Row<'cycle_reminders'>[];
  sharing: Row<'cycle_sharing_preferences'> | null;
  partner: { owner_id: string; status_text: string | null; approximate_date: string | null }[];
}
