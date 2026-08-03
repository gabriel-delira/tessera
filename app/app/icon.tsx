import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C1324",
          borderRadius: 6,
        }}
      >
        <svg
          viewBox="0 0 32 40"
          width="22"
          height="27"
          fill="none"
          stroke="#C79A4A"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 37V16a12 12 0 0 1 24 0v21" />
          <rect x="10" y="15" width="12" height="19" rx="2" />
          <path d="M2 37h28" />
        </svg>
      </div>
    ),
    size
  );
}
