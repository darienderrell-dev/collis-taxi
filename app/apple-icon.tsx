import { ImageResponse } from "next/og";

// Apple touch icon — Next.js generates this as a PNG at build time.
// 180x180 is the Apple-recommended size; iOS scales it as needed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fbbf24 0%, #ea580c 100%)",
          borderRadius: 38,
          fontSize: 110,
        }}
      >
        🚕
      </div>
    ),
    { ...size },
  );
}
