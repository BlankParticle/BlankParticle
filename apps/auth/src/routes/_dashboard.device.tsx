import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { CheckCircleIcon, SpinnerGapIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blankparticle/ui/primitives/card.tsx";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@blankparticle/ui/primitives/input-otp.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppAsking, Person, Receives } from "@/components/authorize.tsx";
import { useDashboard } from "@/components/dashboard.tsx";
import { normalizeUserCode, USER_CODE_LENGTH } from "@/lib/clients.ts";
import { decideDevice, lookupDeviceCode, type DeviceRequest } from "@/lib/server-fns.ts";

/** Where a CLI or headless device sends you: type its code, see what it wants, approve */
export const Route = createFileRoute("/_dashboard/device")({ component: DevicePage });

type State =
  | { step: "enter"; code: string; error?: string }
  | { step: "confirm"; code: string; request: DeviceRequest }
  | { step: "done"; decision: "approved" | "denied"; request: DeviceRequest };

function DevicePage() {
  const { user } = useDashboard();
  const [state, setState] = useState<State>({ step: "enter", code: "" });
  const [busy, setBusy] = useState(false);

  const lookup = async (code: string) => {
    setBusy(true);
    try {
      const request = await lookupDeviceCode({ data: { code } });
      setState(
        request === null
          ? { step: "enter", code, error: "That code isn't right, or it has expired." }
          : { step: "confirm", code, request },
      );
    } finally {
      setBusy(false);
    }
  };
  const decide = async (code: string, request: DeviceRequest, decision: "approved" | "denied") => {
    setBusy(true);
    try {
      await decideDevice({ data: { code, decision } });
      setState({ step: "done", decision, request });
    } finally {
      setBusy(false);
    }
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
          <AppAsking
            clientId={state.request.clientId}
            name={state.request.name}
            logo={state.request.logo}
            audience={state.request.audience}
          />
          <CardDescription className="pt-2">
            Someone is signing in as you on another device with the code{" "}
            <span className="font-mono font-bold">
              {state.code.slice(0, 4)}-{state.code.slice(4)}
            </span>
            . Only approve if that is you.
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
            <InputOTPGroup>
              {[0, 1, 2, 3].map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              {[4, 5, 6, 7].map((index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {state.error !== undefined && <p className="text-destructive text-sm">{state.error}</p>}
          <Button
            type="submit"

            className="w-full"
            disabled={busy || state.code.length !== USER_CODE_LENGTH}
          >
            {busy ? <SpinnerGapIcon className="animate-spin" /> : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
