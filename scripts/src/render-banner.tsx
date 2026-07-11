import { join } from "node:path";

import { renderToFile, REPO_ROOT, scaledDimensions } from "./helpers.ts";
import { fonts, profileImage, themedInk } from "./shared.tsx";

const WIDTH = 1280;
const HEIGHT = 426;

const noiseSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="100%" height="100%" fill="${themedInk.paper}" />
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.07" />
  </svg>
`;

const noiseDataUrl = `data:image/svg+xml;base64,${Buffer.from(noiseSvg).toString("base64")}`;

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        backgroundColor: color,
        color: themedInk.text,
        fontWeight: 700,
        fontSize: 24,
        padding: "4px 14px",
        border: `3px solid ${themedInk.text}`,
      }}
    >
      {label}
    </span>
  );
}

function Banner() {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 80px",
        gap: 48,
        color: themedInk.text,
        backgroundColor: themedInk.paper,
        backgroundImage: `url("${noiseDataUrl}")`,
        backgroundSize: `${WIDTH}px ${HEIGHT}px`,
        fontFamily: "Karla",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: themedInk.muted, letterSpacing: 1 }}>Hello, I'm</div>
        <div
          style={{
            fontFamily: "Bricolage Grotesque",
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: -2,
            color: themedInk.violet,
          }}
        >
          Rahul Mishra
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: themedInk.muted }}>
          <span>also known as</span>
          <span
            style={{
              backgroundColor: themedInk.lime,
              color: themedInk.text,
              fontWeight: 700,
              padding: "2px 10px",
              transform: "rotate(-1deg)",
            }}
          >
            @blankparticle
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <Tag label="TypeScript" color={themedInk.lime} />
          <Tag label="Cloudflare" color="#ffffff" />
          <Tag label="AI" color={themedInk.lime} />
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", transform: "rotate(2deg)", marginRight: 8 }}>
        <img
          src={profileImage.src}
          style={{
            width: 240,
            height: 240,
            objectFit: "cover",
            borderRadius: 28,
            border: `8px solid ${themedInk.paper}`,
            boxShadow: `0 0 0 4px ${themedInk.text}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -16,
            left: 58,
            backgroundColor: themedInk.lime,
            border: `4px solid ${themedInk.text}`,
            padding: "4px 14px",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            transform: "rotate(-3deg)",
          }}
        >
          THAT'S ME
        </div>
      </div>
    </div>
  );
}

await renderToFile(
  <Banner />,
  {
    ...scaledDimensions(WIDTH, HEIGHT),
    fonts,
    images: [profileImage],
    format: "png",
    headers: {
      "Content-Type": "image/png",
    },
  },
  join(REPO_ROOT, ".github/assets/banner.png"),
);
