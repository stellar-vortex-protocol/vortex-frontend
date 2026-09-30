/**
 * SVG → PNG serialisation without external services.
 * Inlines computed styles so exported images are self-contained.
 *
 * Limitations (documented):
 * - Web fonts are not embedded in the canvas; system fallback fonts are used instead.
 * - CSS custom properties (variables) are resolved at export time via getComputedStyle.
 * - Tainted-canvas prevention: only blob: / data: image sources are allowed (img-src CSP).
 * - Memory cap: images larger than MAX_DIMENSION × MAX_DIMENSION are rejected.
 */

const MAX_DIMENSION = 4096;
const EXPORT_SCALE = 2; // 2× for crispness on retina displays

/**
 * Clone an SVG element and inline all computed CSS custom-property values so
 * the canvas renderer resolves colours correctly regardless of theme.
 */
function cloneSvgWithInlinedStyles(svgEl: SVGSVGElement): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const sourceEls = svgEl.querySelectorAll("*");
  const clonedEls = clone.querySelectorAll("*");

  sourceEls.forEach((source, index) => {
    const cloned = clonedEls[index] as SVGElement | undefined;
    if (!cloned) return;
    const computed = getComputedStyle(source);
    // Only inline properties that contain var() references to avoid bloat
    const style = (source as SVGElement).getAttribute("style") ?? "";
    if (style.includes("var(") || source.tagName === "text") {
      const fill = computed.getPropertyValue("fill");
      const stroke = computed.getPropertyValue("stroke");
      const color = computed.getPropertyValue("color");
      if (fill) cloned.style.fill = fill;
      if (stroke && stroke !== "none") cloned.style.stroke = stroke;
      if (color) cloned.style.color = color;
    }
  });

  return clone;
}

export type SvgToPngOptions = {
  /** Scale factor (default: EXPORT_SCALE = 2) */
  scale?: number;
  /** Background colour (default: transparent) */
  background?: string;
  /** Max pixels per side — rejects oversized requests (default: MAX_DIMENSION) */
  maxDimension?: number;
};

/**
 * Serialise an SVGSVGElement to a PNG Blob.
 * Works in Safari, Firefox, and Chromium.
 *
 * @throws if the resulting image would exceed maxDimension on either side.
 */
export async function svgToPng(
  svgEl: SVGSVGElement,
  options: SvgToPngOptions = {},
): Promise<Blob> {
  const scale = options.scale ?? EXPORT_SCALE;
  const maxDim = options.maxDimension ?? MAX_DIMENSION;

  const rect = svgEl.getBoundingClientRect();
  const width = Math.round(rect.width * scale);
  const height = Math.round(rect.height * scale);

  if (width > maxDim || height > maxDim) {
    throw new Error(
      `Export image too large: ${width}×${height} exceeds max ${maxDim}. Reduce scale or chart size.`,
    );
  }

  const cloned = cloneSvgWithInlinedStyles(svgEl);
  cloned.setAttribute("width", String(width));
  cloned.setAttribute("height", String(height));

  const serialiser = new XMLSerializer();
  const svgString = serialiser.serializeToString(cloned);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      if (options.background) {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("canvas.toBlob returned null"));
        }
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Failed to load SVG image for canvas export"));
    };
    img.src = svgUrl;
  });
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
