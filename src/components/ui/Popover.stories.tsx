import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Popover } from './Popover';

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={<button type="button">Open popover</button>}
      >
        <div style={{ padding: 12 }}>
          <p>Popover content</p>
          <button type="button">Action</button>
        </div>
      </Popover>
    );
  },
};

export const KeyboardDismissal: Story = {
  name: 'Keyboard dismissal (Escape)',
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={<button type="button">Open popover</button>}
      >
        <div style={{ padding: 12 }}>
          <p>Press Escape to close and return focus to the trigger.</p>
          <button type="button">Action</button>
        </div>
      </Popover>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Open the popover with the keyboard, press Escape, and confirm it closes with focus restored to the trigger.',
      },
    },
  },
};
