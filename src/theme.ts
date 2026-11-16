// Design tokens from "Doubters App Design" (dark).
export const T = {
  bg: "#0B0B0C",
  card: "#17171A",
  line: "#2A2A2E",
  fg: "#F2F2F0",
  muted: "#9A9AA0",
  dim: "#5C5C62",
  blue: "#6CB4FF", // you / believers / progress
  yellow: "#F2E14C", // doubters / doubt
  red: "#FF6B5E",
  radius: { card: 16, inner: 12, pill: 999 },
  pad: 20,
} as const;

// Avatar colors from the design, picked by name.
const AVATARS = ["#4A4A8C", "#8C6B2F", "#2F6F5E", "#8C5A3B", "#5E6B2F", "#8C3B5E", "#3B6E8C", "#6B3B8C"];
export const avatarColor = (name: string) =>
  AVATARS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATARS.length];
