import { GithubClientId, GithubClientSecret, StageInvariant } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Namespace from "alchemy/Namespace";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

type DNSRecordDefinition = Omit<Cloudflare.DNS.RecordProps, "zoneId"> & { id: string };

const SharedDNSRecords = [
  { type: "TXT", name: "@", content: `"v=spf1 include:_spf.mx.cloudflare.net ~all"`, id: "spf" },
  { type: "CNAME", name: `s719706._domainkey`, content: `dkim.smtp2go.net`, id: "dkim" },
  { type: "CNAME", name: `mail`, content: `return.smtp2go.net`, id: "mail" },
  { type: "TXT", name: `default._bimi`, content: `"v=BIMI1; l=https://blankparticle.com/me.png; a=;"`, id: "bimi" },
] satisfies DNSRecordDefinition[];

const SharedZoneSettings = {
  always_online: "off",
  always_use_https: "on",
  automatic_https_rewrites: "on",
  browser_cache_ttl: 14_400,
  browser_check: "off",
  cache_level: "aggressive",
  challenge_ttl: 1_800,
  cname_flattening: "flatten_at_root",
  early_hints: "on",
  ech: "on",
  edge_cache_ttl: 7_200,
  email_obfuscation: "off",
  hotlink_protection: "off",
  http3: "on",
  ip_geolocation: "on",
  ipv6: "on",
  max_upload: 100,
  min_tls_version: "1.2",
  opportunistic_encryption: "off",
  opportunistic_onion: "on",
  pq_keyex: "on",
  privacy_pass: "on",
  pseudo_ipv4: "off",
  rocket_loader: "off",
  security_header: {
    strict_transport_security: {
      enabled: false,
      max_age: 0,
      include_subdomains: false,
      preload: false,
      nosniff: false,
    },
  },
  security_level: "medium",
  ssl: "full",
  tls_1_3: "on",
  tls_client_auth: "off",
  websockets: "on",
} as const satisfies Record<string, unknown>;

const Zones = {
  "blankparticle.com": {
    dns: [
      ...SharedDNSRecords,
      { type: "TXT", name: "_discord", content: `"dh=63c6be9cf64b7d568b124e7674dd544fc63be4ea"`, id: "discord" },
      {
        type: "TXT",
        name: "@",
        content: `"google-site-verification=3IAqWLF6JANuHprkhdxFpxrKxxWhM8TCNr9uKStyLmY"`,
        id: "google-site-verification",
      },
      {
        type: "TXT",
        name: "_dmarc",
        content: `"v=DMARC1; p=reject; rua=mailto:1e14a7ecc6fe4ff382b2adc7ab2b4586@dmarc-reports.cloudflare.net"`,
        id: "dmarc",
      },
      { type: "A", name: "*.orion", content: "100.64.0.3", id: "orion-wildcard" },
    ],
    settings: SharedZoneSettings,
  },
  "blankparticle.in": {
    dns: [
      ...SharedDNSRecords,
      { type: "TXT", name: "_discord", content: `"dh=5209be9cf688ee3c1376913170f41fc62478922c"`, id: "discord" },
      {
        type: "TXT",
        name: "@",
        content: `"google-site-verification=nR_b3euGlRZYK5zvy2E7o2jUOphKR72S4ghFjp5eFtQ"`,
        id: "google-site-verification",
      },
      {
        type: "TXT",
        name: "_dmarc",
        content: `"v=DMARC1; p=reject; rua=mailto:2c81981ae92546098d55393207fdfdaa@dmarc-reports.cloudflare.net;"`,
        id: "dmarc",
      },
    ],
    settings: SharedZoneSettings,
  },
  "rx2.dev": {
    dns: [
      ...SharedDNSRecords,
      { type: "TXT", name: "_discord", content: `"dh=2cd8819866aa7d37960f152545921f28b5051211"`, id: "discord" },
      {
        type: "TXT",
        name: "_dmarc",
        content: `"v=DMARC1; p=reject; rua=mailto:1ee15af81e234e2dbcd81114b3464256@dmarc-reports.cloudflare.net"`,
        id: "dmarc",
      },
    ],
    settings: SharedZoneSettings,
  },
} as const satisfies Record<string, { dns: DNSRecordDefinition[]; settings: Record<string, unknown> }>;

const ApplyZones = Effect.all(
  Record.map(Zones, ({ dns, settings }, domain) =>
    Effect.gen(function* () {
      const { zoneId } = yield* Cloudflare.Zone.Zone(domain, { name: domain });

      yield* Effect.forEach(dns, (record) =>
        Cloudflare.DNS.Record(record.id, {
          comment: `Managed by Alchemy (${domain}/${record.id})`,
          ...record,
          zoneId,
        }),
      ).pipe(Namespace.push("DNS"), Namespace.push(domain));

      yield* Effect.all(
        Record.map(settings, (value, settingId) => Cloudflare.Zone.Setting(settingId, { zoneId, settingId, value })),
        { concurrency: "unbounded", discard: true },
      ).pipe(Namespace.push("Settings"), Namespace.push(domain));
    }),
  ),
  { concurrency: "unbounded", discard: true },
).pipe(Namespace.push("Zones"));

const ZeroTrust = Effect.all(
  [
    Cloudflare.Access.Organization("Organization", {
      authDomain: "blankparticle.cloudflareaccess.com",
      name: "BlankParticle",
      sessionDuration: "730h",
      loginDesign: {
        logoPath: "https://blankparticle.com/me.png",
        backgroundColor: "#f8f9f5",
      },
    }),
    Cloudflare.Access.IdentityProvider("Cloudflare", {
      type: "cloudflare",
      name: "Cloudflare",
      config: { restrictToAccountMembers: true },
    }).pipe(Namespace.push("IdentityProvider")),
    Cloudflare.Access.IdentityProvider("GitHub", {
      type: "github",
      name: "GitHub",
      config: { clientId: GithubClientId, clientSecret: GithubClientSecret.pipe(Config.map(Redacted.value)) },
    }).pipe(Namespace.push("IdentityProvider")),
  ],
  { concurrency: "unbounded" },
).pipe(Namespace.push("ZeroTrust"));

export default Alchemy.Stack(
  "Cloudflare",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    yield* StageInvariant(Schema.Literal("prod")).pipe(Effect.orDie);
    yield* Effect.all([ApplyZones, ZeroTrust], { discard: true, concurrency: "unbounded" });
  }),
);
