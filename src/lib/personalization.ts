export const genders = ['female', 'male', 'other', 'unspecified'] as const;
export const layouts = ['auto', 'rose', 'dusk'] as const;
export type Gender = (typeof genders)[number];
export type Layout = (typeof layouts)[number];
export function personalTheme(gender?: string | null, layout?: string | null): 'rose' | 'dusk' {
  if (layout === 'rose' || layout === 'dusk') return layout;
  return gender === 'male' ? 'dusk' : 'rose';
}
export function personalNavigation(theme: 'rose' | 'dusk', cycleTracking: boolean) {
  const routes =
    theme === 'dusk'
      ? ['/home', '/chat', '/games', '/memories', '/calendar', '/letters', '/mood', '/music']
      : ['/home', '/memories', '/chat', '/letters', '/calendar', '/mood', '/music', '/games'];
  return cycleTracking ? [...routes, '/cycle'] : routes;
}
