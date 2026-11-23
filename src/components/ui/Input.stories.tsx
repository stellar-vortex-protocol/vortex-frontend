import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <Input id="email" type="email" placeholder="Email" {...args} />
    </div>
  ),
};

export const WithError: Story = {
  args: {
    placeholder: "you@example.com",
    error: "Please enter a valid email address.",
  },
  render: (args) => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <label htmlFor="email-error" className="text-sm font-medium">
        Email
      </label>
      <Input id="email-error" type="email" {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};
