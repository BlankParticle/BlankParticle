import { join } from "node:path";

import { renderToFile, REPO_ROOT, scaledDimensions } from "./helpers.ts";
import { fonts, profileImage, themedInk } from "./shared.tsx";

const WIDTH = 1200;
const HEIGHT = 630;

function OgImage() {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        color: themedInk.text,
        backgroundColor: themedInk.paper,
        fontFamily: "Karla",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "0 64px",
          padding: "26px 0",
          borderBottom: `3px dashed rgba(104, 45, 172, 0.35)`,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 4,
          color: themedInk.violet,
        }}
      >
        <div>BLANKPARTICLE.COM</div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px",
          gap: 60,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 680 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: themedInk.muted, letterSpacing: 1 }}>Hello, I'm</div>
          <div
            style={{
              fontFamily: "Bricolage Grotesque",
              fontSize: 110,
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: -2,
              color: themedInk.violet,
            }}
          >
            Rahul Mishra
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, color: themedInk.muted }}>
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
          <div style={{ fontSize: 30, color: themedInk.muted }}>software developer</div>
        </div>

        <div style={{ position: "relative", display: "flex", transform: "rotate(2deg)" }}>
          <img
            src={profileImage.src}
            style={{
              width: 300,
              height: 300,
              objectFit: "cover",
              borderRadius: 32,
              border: `10px solid ${themedInk.paper}`,
              boxShadow: `0 0 0 4px ${themedInk.text}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -18,
              left: 70,
              backgroundColor: themedInk.lime,
              border: `4px solid ${themedInk.text}`,
              padding: "4px 14px",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              transform: "rotate(-3deg)",
            }}
          >
            THAT'S ME
          </div>
        </div>
      </div>
    </div>
  );
}

await renderToFile(
  <OgImage />,
  {
    ...scaledDimensions(WIDTH, HEIGHT),
    fonts,
    images: [profileImage],
    format: "webp",
    headers: {
      "Content-Type": "image/webp",
    },
  },
  join(REPO_ROOT, "apps/www/public/og-image.webp"),
);
