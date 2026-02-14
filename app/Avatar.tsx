"use client";

type AvatarProps = {
  url?: string | null;
  size?: number;
  alt?: string;
};

export default function Avatar({ url, size = 28, alt = "Avatar" }: AvatarProps) {
  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: "1px solid #ddd",
    background: "#f3f3f3",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flex: `0 0 ${size}px`,
  };

  if (url) {
    return (
      <span style={boxStyle} aria-label={alt}>
        <img
          src={url}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }

  return (
    <span style={boxStyle} aria-label="Default avatar">
      <svg
        width={Math.floor(size * 0.6)}
        height={Math.floor(size * 0.6)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#777"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.8-3.6 5-5 8-5s6.2 1.4 8 5" />
      </svg>
    </span>
  );
}
