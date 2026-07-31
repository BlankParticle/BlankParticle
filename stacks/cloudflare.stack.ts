import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";

type DNSRecordDefinition = Omit<Cloudflare.DNS.RecordProps, "zoneId"> & { id: string };

const SetupZones = Effect.gen(function* () {
  const sharedRecords: DNSRecordDefinition[] = [
    { type: "CNAME", name: `s719706._domainkey`, content: `dkim.smtp2go.net`, id: "dkim" },
    { type: "CNAME", name: `mail`, content: `return.smtp2go.net`, id: "mail" },
    { type: "TXT", name: `default._bimi`, content: `"v=BIMI1; l=https://blankparticle.com/me.png; a=;"`, id: "bimi" },
  ];

  const zoneDefinitions = {
    "blankparticle.com": [
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
      ...sharedRecords,
    ],
    "blankparticle.in": [
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
      ...sharedRecords,
    ],
    "rx2.dev": [
      { type: "TXT", name: "_discord", content: `"dh=2cd8819866aa7d37960f152545921f28b5051211"`, id: "discord" },
      {
        type: "TXT",
        name: "_dmarc",
        content: `"v=DMARC1; p=reject; rua=mailto:1ee15af81e234e2dbcd81114b3464256@dmarc-reports.cloudflare.net"`,
        id: "dmarc",
      },
      ...sharedRecords,
    ],
  } as const satisfies Record<string, DNSRecordDefinition[]>;

  const zones = yield* Effect.all(
    Record.map(zoneDefinitions, (_, domain) => Cloudflare.Zone.Zone(domain, { name: domain })),
  );

  yield* Effect.all(
    Record.map(zoneDefinitions, (records, domain) =>
      Effect.forEach(
        records,
        (record) =>
          Cloudflare.DNS.Record(`${domain}-${record.id}`, {
            comment: `Managed by Alchemy (${domain}/${record.id})`,
            ...record,
            zoneId: zones[domain].zoneId,
          }),
        { discard: true, concurrency: "unbounded" },
      ),
    ),
    { discard: true, concurrency: "unbounded" },
  );

  return zones;
});

const SetupZeroTrust = Effect.gen(function* () {
  yield* Cloudflare.Access.Organization("ZeroTrustOrg", {
    authDomain: "blankparticle.cloudflareaccess.com",
    name: "blankparticle.cloudflareaccess.com",
    sessionDuration: "730h",
  });
});

export default Alchemy.Stack(
  "Cloudflare",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    yield* SetupZones;
    yield* SetupZeroTrust;
  }),
).pipe(adopt());
