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
      config: {
        rules: [
          {
            // Storybook's own chrome/iframe markup is outside our control.
            id: "region",
            enabled: false,
          },
        ],
      },
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      },
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
