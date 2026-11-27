// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinoraLogo } from '@/components/common/FinoraLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

describe('Finora UI components', () => {
  it('renders FinoraLogo with expanded and collapsed image sources', () => {
    const { rerender } = render(<FinoraLogo collapsed={false} />);
    const img = screen.getByAltText('Finora') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/finora_logo.png');

    rerender(<FinoraLogo collapsed />);
    expect(img.getAttribute('src')).toBe('/favicon.png');
  });

  it('handles Button click and loading/disabled state', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} isLoading>
        Save
      </Button>,
    );
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('renders EmptyState with title, description, and action', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon" />}
        title="No records"
        description="Add a record to begin"
        action={<Button>Add</Button>}
      />,
    );
    expect(screen.getByText('No records')).toBeTruthy();
    expect(screen.getByText('Add a record to begin')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('renders ConfirmDialog and invokes confirm handler', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete item"
        description="Confirm deletion"
        confirmLabel="Delete"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
