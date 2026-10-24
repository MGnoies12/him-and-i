// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Button, Toggle, Field, EmptyState } from '@/components/ui/primitives';
afterEach(cleanup);
describe('accessible shared primitives', () => {
  it('exposes pending state and blocks duplicate submissions', () => {
    const clicked = vi.fn();
    render(
      <Button busy onClick={clicked}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
  it('labels controls without relying on placeholders', async () => {
    render(
      <Field label="A private note" hint="Only you can see it">
        <textarea />
      </Field>,
    );
    await userEvent.type(
      screen.getByLabelText('A private note', { exact: false }),
      'A fictional note',
    );
    expect(screen.getByRole('textbox')).toHaveValue('A fictional note');
  });
  it('supports a labelled, keyboard-operable opt-in switch', async () => {
    const change = vi.fn();
    render(
      <Toggle
        checked={false}
        onChange={change}
        label="Share a simple status"
        description="Off by default"
      />,
    );
    const toggle = screen.getByRole('switch', { name: /Share a simple status/ });
    expect(toggle).not.toBeChecked();
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(change).toHaveBeenCalledWith(true);
  });
  it('offers a meaningful empty state rather than fake personal content', () => {
    render(
      <EmptyState
        title="Our first page is still unwritten"
        description="Start with a memory of your own."
        action={<Button>New memory</Button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Our first page is still unwritten' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'New memory' })).toBeVisible();
  });
});
