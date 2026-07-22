import { createFileRoute } from "@tanstack/react-router";

import { sshPublicKeys } from "@/lib/data.ts";

export const Route = createFileRoute("/keys")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (new URL(request.url).searchParams.has("json")) return Response.json(sshPublicKeys);

        return new Response(
          Object.entries(sshPublicKeys)
            .map(([username, [publicKey, email]]) => `${username} ${publicKey} ${email}`)
            .join("\n"),
          { headers: { "content-type": "text/plain; charset=UTF-8" } },
        );
      },
    },
  },
});
