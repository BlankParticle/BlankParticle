import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { CheckCircleIcon, SpinnerGapIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blankparticle/ui/primitives/card.tsx";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@blankparticle/ui/primitives/input-otp.tsx";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { AppIdentity } from "#/components/app-identity.tsx";
import { Person, Receives } from "#/components/authorize.tsx";
import { useDashboard } from "#/components/dashboard.tsx";
import { formatUserCode, normalizeUserCode, USER_CODE_LENGTH } from "#/lib/clients.ts";
import { decideDevice, lookupDeviceCode, type DeviceRequest } from "#/lib/server-fns.ts";

/** Where a CLI or headless device sends you: type its code, see what it wants, approve */
export const Route = createFileRoute("/_dashboard/device")({ component: DevicePage });

type State =
  | { step: "enter"; code: string; error?: string }
  | { step: "confirm"; code: string; request: DeviceRequest; error?: string }
  | { step: "done"; decision: "approved" | "denied"; request: DeviceRequest };

/** Slot indexes, split in two halves like the `XXXX-XXXX` display */
const SLOT_GROUPS = [0, USER_CODE_LENGTH / 2].map((start) =>
  Array.from({ length: USER_CODE_LENGTH / 2 }, (_, offset) => start + offset),
);

function DevicePage() {
  const { user } = useDashboard();
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "enter", code: "" });
  const [busy, setBusy] = useState(false);

  const lookup = (code: string) => {
    setBusy(true);
    return lookupDeviceCode({ data: { code } })
      .then((request) =>
        setState(
          request === null
            ? { step: "enter", code, error: "That code isn't right, or it has expired." }
            : { step: "confirm", code, request },
        ),
      )
      .catch(() => setState({ step: "enter", code, error: "Couldn't check that code. Try again." }))
      .finally(() => setBusy(false));
  };
  const decide = (code: string, request: DeviceRequest, decision: "approved" | "denied") => {
    setBusy(true);
    return decideDevice({ data: { code, decision } })
      .then((decided) => {
        if (!decided) {
          setState({ step: "enter", code: "", error: "That code has expired. Start signing in again on your device." });
          return;
        }
        setState({ step: "done", decision, request });
        // the dashboard's app list may have just changed
        void router.invalidate();
      })
      .catch(() => setState({ step: "confirm", code, request, error: "Something went wrong. Try again." }))
      .finally(() => setBusy(false));
  };

  if (state.step === "done")
    return (
      <EmptyState
        icon={<CheckCircleIcon weight="fill" className="text-primary" />}
        title={
          state.decision === "approved"
            ? `${state.request.name ?? state.request.clientId} is signed in`
            : "Request denied"
        }
        description={
          state.decision === "approved"
            ? "You can close this tab and go back to where you started."
            : "Nothing was shared. You can close this tab."
        }
        className="mx-auto mt-6 max-w-xl"
      />
    );

  if (state.step === "confirm")
    return (
      <Card className="mx-auto mt-6 max-w-xl">
        <CardHeader>
          <AppIdentity
            name={state.request.name}
            logo={state.request.logo}
            clientId={state.request.clientId}
            audience={state.request.audience}
            size="lg"
          />
          <CardDescription className="pt-2">
            Someone is signing in as you on another device with the code{" "}
            <span className="font-mono font-bold">{formatUserCode(state.code)}</span>. Only approve if that is you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Person user={user} />
          <Receives pii={state.request.pii} user={user} />
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => decide(state.code, state.request, "denied")}
            >
              Deny
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(state.code, state.request, "approved")}>
              {busy ? <SpinnerGapIcon className="animate-spin" /> : "Approve"}
            </Button>
          </div>
          {state.error !== undefined && <p className="text-destructive mt-3 text-sm">{state.error}</p>}
        </CardContent>
      </Card>
    );

  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardHeader>
        <CardTitle>Enter the code</CardTitle>
        <CardDescription>It is shown wherever you started signing in — usually your terminal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col items-center gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (state.code.length === USER_CODE_LENGTH) void lookup(state.code);
          }}
        >
          <InputOTP
            maxLength={USER_CODE_LENGTH}
            value={state.code}
            onChange={(value) => setState({ step: "enter", code: normalizeUserCode(value) })}
            onComplete={(value) => void lookup(normalizeUserCode(value))}
            pattern="^[a-zA-Z]*$"
            autoFocus
            disabled={busy}
          >
            {SLOT_GROUPS.map((group, groupIndex) => (
              <Fragment key={group[0]}>
                {groupIndex > 0 && <InputOTPSeparator />}
                <InputOTPGroup>
                  {group.map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </Fragment>
            ))}
          </InputOTP>
          {state.error !== undefined && <p className="text-destructive text-sm">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={busy || state.code.length !== USER_CODE_LENGTH}>
            {busy ? <SpinnerGapIcon className="animate-spin" /> : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
