/** What route heads need. Heads are bundled into the entry chunk, so this stays free of the site's content */

export const SITE_URL = "https://blankparticle.com";
export const SITE_NAME = "blankparticle";
export const SITE_DESCRIPTION =
  "Personal site of Rahul Mishra, aka BlankParticle, a software developer passionate about tech";

/** My public profiles: the socials link to them and the Person structured data lists them */
export const profiles = {
  twitter: "https://x.com/blankparticle",
  discord: "https://discord.com/users/1096392763144159252",
  github: "https://github.com/BlankParticle",
  linkedin: "https://www.linkedin.com/in/blankparticle",
};

export const personLd = {
  "@type": "Person",
  name: "Rahul Mishra",
  alternateName: "BlankParticle",
  url: SITE_URL,
  image: `${SITE_URL}/me.png`,
  jobTitle: "Software Developer",
  sameAs: Object.values(profiles),
};

const defaultImage = {
  url: `${SITE_URL}/og-image.jpg`,
  alt: "Rahul Mishra, also known as @blankparticle, software developer",
  width: 1200,
  height: 630,
};

interface SeoOptions {
  title: string;
  description: string;
  /** path on this site, e.g. `/blog`; becomes og:url and the canonical link */
  path: string;
  image?: { url: string; alt: string; width?: number; height?: number };
  type?: "website" | "article";
}

/** A page's title, description, Open Graph tags and canonical link; X reads the og:* tags, so only twitter:card (set by the root) is needed */
export function seo({ title, description, path, image = defaultImage, type = "website" }: SeoOptions) {
  const url = new URL(path, SITE_URL).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:image", content: image.url },
      { property: "og:image:alt", content: image.alt },
      ...(image.width && image.height
        ? [
            { property: "og:image:width", content: String(image.width) },
            { property: "og:image:height", content: String(image.height) },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
