export function Icon({ kind, className = "" }: { kind: "wheat" | "phone" | "bag" | "check"; className?: string }) {
  const paths = {
    wheat: (
      <>
        <path d="M6 21 18 3M10 15C4 15 4 10 4 10s6 0 6 5ZM13 10c-5-1-4-6-4-6s5 1 4 6ZM10 15c2-5 7-3 7-3s-2 5-7 3ZM14 9c2-5 7-3 7-3s-2 5-7 3Z" />
      </>
    ),
    phone: <path d="m7 3 3 5-3 3c2 3 3 4 6 6l3-3 5 3c-1 5-4 5-7 3C8 17 3 12 3 7c0-3 2-4 4-4Z" />,
    bag: (
      <>
        <path d="M5 8h14l1 13H4L5 8Z" />
        <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}
