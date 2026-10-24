// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
const mock = vi.hoisted(() => ({
  workspace: vi.fn(),
  run: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/components/providers', () => ({
  useWorkspace: mock.workspace,
  useI18n: () => ({ t: (_: string, en: string) => en, locale: 'en', timezone: 'UTC' }),
  useToast: () => mock.toast,
}));
vi.mock('@/hooks/use-data', () => ({ useAction: () => ({ run: mock.run, pending: false }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mock.replace, refresh: mock.refresh }),
}));
import { PersonalizationScreen } from '@/components/features/personalization';
import { PairingScreen } from '@/components/features/onboarding';
beforeEach(() => {
  vi.clearAllMocks();
  mock.workspace.mockReturnValue({
    configured: true,
    userId: 'synthetic-user',
    profile: { display_name: 'Synthetic name', timezone: 'UTC' },
    personalization: { gender: 'unspecified', layout: 'auto', cycle_tracking: false },
    members: [],
    couple: null,
  });
  mock.run.mockResolvedValue({ ok: true, data: null });
});
afterEach(cleanup);
describe('profile and pairing form wiring with isolated synthetic sessions', () => {
  it('starts with private tracking off and lets anyone override the suggested appearance', async () => {
    const view = render(<PersonalizationScreen />);
    expect(screen.getByRole('switch', { name: /I want private cycle tracking/ })).not.toBeChecked();
    expect(screen.queryByLabelText(/First day of your last period/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Gender (optional)'), 'male');
    expect(view.container.firstElementChild).toHaveAttribute('data-personal-theme', 'dusk');
    await userEvent.selectOptions(screen.getByLabelText('Appearance and layout'), 'rose');
    expect(view.container.firstElementChild).toHaveAttribute('data-personal-theme', 'rose');
  });
  it('submits health information only to the authenticated profile action and preserves a safe next route', async () => {
    render(<PersonalizationScreen next="/pairing" />);
    await userEvent.selectOptions(screen.getByLabelText('Gender (optional)'), 'male');
    await userEvent.click(screen.getByRole('switch', { name: /I want private cycle tracking/ }));
    fireEvent.change(screen.getByLabelText(/First day of your last period/), {
      target: { value: '2026-06-01' },
    });
    await userEvent.type(screen.getByLabelText(/My usual cycle length/), '29');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(mock.run).toHaveBeenCalledWith({
      type: 'profile.complete',
      fields: {
        display_name: 'Synthetic name',
        gender: 'male',
        layout: 'auto',
        locale: 'en',
        timezone: 'UTC',
        cycle_tracking: true,
        period_start: '2026-06-01',
        reported_length: 29,
        irregular: false,
      },
    });
    expect(mock.replace).toHaveBeenCalledWith('/pairing');
  });
  it('clears unsaved period data when tracking is switched off', async () => {
    render(<PersonalizationScreen />);
    const toggle = screen.getByRole('switch', { name: /I want private cycle tracking/ });
    await userEvent.click(toggle);
    fireEvent.change(screen.getByLabelText(/First day of your last period/), {
      target: { value: '2026-06-01' },
    });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(mock.run).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          cycle_tracking: false,
          period_start: null,
          reported_length: null,
          irregular: false,
        }),
      }),
    );
  });
  it('joins an existing space directly instead of forcing the second person to create another space', async () => {
    render(<PairingScreen />);
    await userEvent.type(screen.getByLabelText(/The code your partner sent/), '2ABC-3DEF-4GHJ');
    await userEvent.click(screen.getByRole('button', { name: 'Connect and start chatting' }));
    expect(mock.run).toHaveBeenCalledWith({
      type: 'invitation.code.accept',
      code: '2ABC-3DEF-4GHJ',
    });
    expect(mock.run).toHaveBeenCalledTimes(1);
    expect(mock.replace).toHaveBeenCalledWith('/chat');
    expect(screen.getByLabelText(/The code your partner sent/)).toHaveValue('');
  });
});
