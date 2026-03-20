import { ImageResponse } from "next/og"

export const alt = "Faith Lauren Photography"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          position: "relative",
        }}
      >
        {/* Subtle border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#d4a574",
            display: "flex",
          }}
        />

        {/* Monogram */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 200,
            color: "#d4a574",
            letterSpacing: "8px",
            marginBottom: 32,
            display: "flex",
          }}
        >
          FL
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            color: "#1c1917",
            letterSpacing: "-1px",
            marginBottom: 16,
            display: "flex",
          }}
        >
          Faith Lauren
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 300,
            color: "#78716c",
            letterSpacing: "4px",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Photography
        </div>
      </div>
    ),
    { ...size }
  )
}
