import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-vx-ink p-8 text-vx-text">
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: {
      // Enforced: axe violations fail `npm run test:storybook` in CI.
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
  },
};

export default preview;
