export function VortexLogo({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  // When `title` is provided the SVG is meaningful (e.g. a standalone link icon);
  // otherwise it is decorative and hidden from assistive technology.
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
