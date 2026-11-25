import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Popover } from './Popover';

describe('Popover', () => {
  it('opens on trigger click and moves focus into the content', () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <button>Inside</button>
      </Popover>
    );

    fireEvent.click(screen.getByText('Open'));

    const inside = screen.getByText('Inside');
    expect(inside).toBeInTheDocument();
    expect(document.activeElement).toBe(inside);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(
      <Popover trigger={<button>Open</button>}>
        <button>Inside</button>
      </Popover>
    );

    const trigger = screen.getByText('Open');
    fireEvent.click(trigger);
    expect(screen.getByText('Inside')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking outside', () => {
    render(
      <div>
        <Popover trigger={<button>Open</button>}>
          <button>Inside</button>
        </Popover>
        <button>Outside</button>
      </div>
    );

    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Inside')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Outside'));

    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
  });
});
