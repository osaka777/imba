export default function CasinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full-bleed game shell: skip sports coupon/nav chrome from parent visually via CSS.
  return <div style={{ position: "relative", minHeight: "100vh" }}>{children}</div>;
}
