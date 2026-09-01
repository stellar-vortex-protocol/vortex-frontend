import type { Meta, StoryObj } from "@storybook/react";
import { QrCode } from "./QrCode";

const meta: Meta<typeof QrCode> = {
  title: "Components/QrCode",
  component: QrCode,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dependency-free inline-SVG QR code with a show/hide toggle. " +
          "Uses a from-scratch QR encoder (ISO/IEC 18004, ECC level M, versions 1–10). " +
          "Screen-reader users receive an aria-label describing the encoded value.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    size: { control: { type: "range", min: 80, max: 400, step: 20 } },
  },
};

export default meta;
type Story = StoryObj<typeof QrCode>;

export const StellarAddress: Story = {
  args: {
    value: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "Stellar address GBBD…LA5",
    size: 200,
  },
};

export const SolverAddress: Story = {
  name: "Solver address (longer label)",
  args: {
    value: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKM0JLZWH0M0Q5O8N1BXU",
    label: "QR code for solver address GCEZ…BXU",
    size: 200,
  },
};

export const Small: Story = {
  name: "Small (80 px minimum)",
  args: {
    value: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "Stellar address GBBD…LA5",
    size: 80,
  },
};

export const Large: Story = {
  name: "Large (320 px)",
  args: {
    value: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "Stellar address GBBD…LA5",
    size: 320,
  },
};
