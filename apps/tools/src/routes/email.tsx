import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { CheckIcon, EnvelopeSimpleIcon, PlusIcon, SpinnerGapIcon, TrashIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@blankparticle/ui/primitives/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@blankparticle/ui/primitives/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@blankparticle/ui/primitives/select.tsx";
import { Switch } from "@blankparticle/ui/primitives/switch.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";

import { ActionBadge } from "#/components/action-badge.tsx";
import { useAppForm } from "#/components/form.tsx";
import { formatTimestamp, SignedOut } from "#/components/signed-out.tsx";
import {
  addDestination,
  clearActivity,
  removeDestination,
  saveRuleSet,
  type DestinationAddress,
  type ZoneOverview,
} from "#/lib/email-api.ts";
import { dashboardQuery, emailConfigQuery } from "#/lib/queries.ts";
import type { ActivityEntry, EmailRule, RuleAction, RuleSet } from "#/lib/rules.ts";

export const Route = createFileRoute("/email")({
  loader: async ({ context }) => {
    const dashboard = await context.queryClient.ensureQueryData(dashboardQuery);
    if (dashboard.user) await context.queryClient.ensureQueryData(emailConfigQuery);
  },
  component: EmailPage,
});

function encodeAction(action: RuleAction) {
  return action.type === "drop" ? "drop" : `forward:${action.to}`;
}

function decodeAction(value: string): RuleAction {
  return value === "drop" ? { type: "drop" } : { type: "forward", to: value.slice("forward:".length) };
}

function actionItems(forwardTargets: readonly string[]): Record<string, string> {
  return {
    drop: "drop",
    ...Object.fromEntries(forwardTargets.map((email) => [`forward:${email}`, `forward → ${email}`])),
  };
}

/**
 * Rule saves are scoped: the next ruleset is computed from the freshest cache
 * inside the mutation, and the server's response is patched back into the query
 * cache directly — no full refetch of zones/destinations/activity.
 */
function useSaveRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ update }: { update: (current: RuleSet) => RuleSet; source: string }) => {
      const config = queryClient.getQueryData(emailConfigQuery.queryKey);
      if (!config) throw new Error("email config not loaded");
      return saveRuleSet({ data: update(config.ruleSet) });
    },
    onSuccess: (ruleSet) => {
      queryClient.setQueryData(emailConfigQuery.queryKey, (old) => (old ? { ...old, ruleSet } : old));
    },
  });
}

function RoutingBadge({ zone }: { zone: ZoneOverview }) {
  const { routing } = zone;
  if ("error" in routing) return <Badge variant="destructive">{routing.error}</Badge>;
  if (!routing.enabled) return <Badge variant="destructive">routing off</Badge>;
  if (routing.status === "ready") return <Badge variant="secondary">routing ready</Badge>;
  return <Badge variant="outline">{routing.status}</Badge>;
}

function ActionSelect({
  value,
  onChange,
  forwardTargets,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  forwardTargets: readonly string[];
  disabled?: boolean;
}) {
  const items = actionItems(forwardTargets);
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)} items={items} disabled={disabled}>
      <SelectTrigger className="max-w-full">
        <SelectValue className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const AddRuleForm = Schema.Struct({
  address: Schema.String.check(Schema.isPattern(/^[^@\s]+$/)),
  action: Schema.String,
  note: Schema.String,
});

function AddRuleDialog({ zone, forwardTargets }: { zone: string; forwardTargets: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const save = useSaveRules();

  const form = useAppForm({
    defaultValues: { address: "", action: "drop", note: "" },
    validators: { onSubmit: Schema.toStandardSchemaV1(AddRuleForm) },
    onSubmit: async ({ value }) => {
      const rule: EmailRule = {
        id: crypto.randomUUID(),
        zone,
        address: `${value.address.trim().toLowerCase()}@${zone}`,
        action: decodeAction(value.action),
        enabled: true,
        ...(value.note.trim() && { note: value.note.trim() }),
      };
      await save.mutateAsync({ source: "add", update: (current) => ({ ...current, rules: [...current.rules, rule] }) });
      form.reset();
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon /> Rule
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New rule · {zone}</DialogTitle>
          <DialogDescription>
            Mail sent to this address follows this rule. Everything else follows the default for the domain.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="address">
            {(field) => (
              <field.TextField
                label="Address"
                placeholder="hello"
                autoFocus
                className="font-mono"
                suffix={<span className="text-muted-foreground font-mono text-sm whitespace-nowrap">@{zone}</span>}
              />
            )}
          </form.AppField>
          <form.AppField name="action">
            {(field) => <field.SelectField label="Action" items={actionItems(forwardTargets)} />}
          </form.AppField>
          <form.AppField name="note">
            {(field) => <field.TextField label="Note" placeholder="optional" />}
          </form.AppField>
          <div className="flex justify-end pt-1">
            <form.AppForm>
              <form.SubmitButton pendingText="Adding…">
                <CheckIcon /> Add rule
              </form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ZoneCard({
  zone,
  ruleSet,
  forwardTargets,
}: {
  zone: ZoneOverview;
  ruleSet: RuleSet;
  forwardTargets: readonly string[];
}) {
  const save = useSaveRules();
  const pendingSource = save.isPending ? save.variables.source : undefined;

  const rules = ruleSet.rules.filter((rule) => rule.zone === zone.name);
  const defaultAction = ruleSet.defaults[zone.name] ?? { type: "drop" as const };

  const patchRule = (id: string, patch: Partial<EmailRule>) =>
    save.mutate({
      source: `rule:${id}`,
      update: (current) => ({
        ...current,
        rules: current.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      }),
    });

  return (
    <Card id={zone.name} className="scroll-mt-20">
      <CardHeader className="flex-row items-center gap-3">
        <div className="space-y-1">
          <CardTitle className="font-mono">{zone.name}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={zone.status === "active" ? "secondary" : "outline"}>{zone.status}</Badge>
            <RoutingBadge zone={zone} />
          </div>
        </div>
        <CardAction>
          <AddRuleDialog zone={zone.name} forwardTargets={forwardTargets} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-muted-foreground text-sm">No rules yet — everything goes where the default below says.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
                <TableHead className="text-right">On</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const rulePending = pendingSource === `rule:${rule.id}` || pendingSource === `delete:${rule.id}`;
                return (
                  <TableRow key={rule.id} className={rule.enabled ? "" : "opacity-50"}>
                    <TableCell className="font-mono text-xs">{rule.address}</TableCell>
                    <TableCell>
                      <ActionBadge action={rule.action} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-48 truncate text-xs md:table-cell">
                      {rule.note}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => patchRule(rule.id, { enabled })}
                        disabled={rulePending}
                      />
                    </TableCell>
                    <TableCell className="w-8 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={rulePending}
                        onClick={() =>
                          save.mutate({
                            source: `delete:${rule.id}`,
                            update: (current) => ({
                              ...current,
                              rules: current.rules.filter((other) => other.id !== rule.id),
                            }),
                          })
                        }
                      >
                        {pendingSource === `delete:${rule.id}` ? (
                          <SpinnerGapIcon className="animate-spin" />
                        ) : (
                          <TrashIcon />
                        )}
                        <span className="sr-only">Delete rule</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="bg-muted/40 flex-wrap justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">Default</span>
          <span className="text-muted-foreground hidden sm:inline">for every other address on this domain</span>
          {pendingSource === "catch-all" && <SpinnerGapIcon className="text-muted-foreground size-4 animate-spin" />}
        </div>
        <ActionSelect
          value={encodeAction(defaultAction)}
          onChange={(value) =>
            save.mutate({
              source: "catch-all",
              update: (current) => ({
                ...current,
                defaults: { ...current.defaults, [zone.name]: decodeAction(value) },
              }),
            })
          }
          forwardTargets={forwardTargets}
          disabled={pendingSource === "catch-all"}
        />
      </CardFooter>
    </Card>
  );
}

const AddDestinationForm = Schema.Struct({
  email: Schema.String.check(Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)),
});

function DestinationsCard({ destinations }: { destinations: DestinationAddress[] }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: emailConfigQuery.queryKey });

  const removeDest = useMutation({
    mutationFn: (id: string) => removeDestination({ data: { id } }),
    onSettled: invalidate,
  });

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onSubmit: Schema.toStandardSchemaV1(AddDestinationForm) },
    onSubmit: async ({ value }) => {
      await addDestination({ data: { email: value.email.trim().toLowerCase() } });
      await invalidate();
      form.reset();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Destinations</CardTitle>
        <CardDescription>Mail can only be forwarded to an address that has been verified.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-border divide-y">
          {destinations.map((destination) => (
            <li key={destination.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 truncate font-mono text-sm">{destination.email}</span>
              {destination.verified ? (
                <Badge variant="secondary">verified</Badge>
              ) : (
                <Badge variant="destructive">pending verification</Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive ml-auto"
                disabled={removeDest.isPending && removeDest.variables === destination.id}
                onClick={() => removeDest.mutate(destination.id)}
              >
                {removeDest.isPending && removeDest.variables === destination.id ? (
                  <SpinnerGapIcon className="animate-spin" />
                ) : (
                  <TrashIcon />
                )}
                <span className="sr-only">Remove destination</span>
              </Button>
            </li>
          ))}
          {destinations.length === 0 && (
            <li className="text-muted-foreground py-2 text-sm">
              No destinations — add one to be able to forward mail.
            </li>
          )}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="w-full sm:w-auto">
            <form.AppField name="email">
              {(field) => (
                <field.TextField
                  label="Add destination"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full font-mono sm:w-72"
                />
              )}
            </form.AppField>
          </div>
          <form.AppForm>
            <form.SubmitButton variant="outline" pendingText="Adding…">
              <PlusIcon /> Add
            </form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>
    </Card>
  );
}

function ActivityCard({ activity }: { activity: readonly ActivityEntry[] }) {
  const queryClient = useQueryClient();
  const clear = useMutation({
    mutationFn: () => clearActivity(),
    onSuccess: () => {
      queryClient.setQueryData(emailConfigQuery.queryKey, (old) => (old ? { ...old, activity: [] } : old));
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center">
        <div className="space-y-1">
          <CardTitle>Activity</CardTitle>
          <CardDescription>The last {activity.length} messages and what happened to them.</CardDescription>
        </div>
        {activity.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => clear.mutate()} disabled={clear.isPending}>
              {clear.isPending && <SpinnerGapIcon className="animate-spin" />}
              Clear
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState
            icon={<EnvelopeSimpleIcon />}
            title="Nothing yet"
            description="Mail shows up here as it arrives."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((entry) => (
                <TableRow key={`${entry.ts}-${entry.to}-${entry.from}`}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{formatTimestamp(entry.ts)}</TableCell>
                  <TableCell className="max-w-52 truncate font-mono text-xs">{entry.from}</TableCell>
                  <TableCell className="max-w-52 truncate font-mono text-xs">{entry.to}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-64 truncate text-xs md:table-cell">
                    {entry.subject}
                  </TableCell>
                  <TableCell>
                    <ActionBadge
                      action={
                        entry.outcome === "forward"
                          ? { type: "forward", to: entry.forwardedTo ?? "?" }
                          : { type: "drop" }
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function EmailPage() {
  const { data: dashboard } = useSuspenseQuery(dashboardQuery);
  if (!dashboard.user) return <SignedOut denied={dashboard.denied} />;
  return <EmailTool />;
}

function EmailTool() {
  const { data } = useSuspenseQuery(emailConfigQuery);
  const forwardTargets = data.destinations
    .filter((destination) => destination.verified)
    .map((destination) => destination.email);

  return (
    <>
      <PageHeader
        title="Email"
        description="Where mail to your addresses goes. Set a rule per address, and a default for everything else on the domain."
      />
      <div className="space-y-5">
        <DestinationsCard destinations={data.destinations} />
        {data.zones.map((zone) => (
          <ZoneCard key={zone.id} zone={zone} ruleSet={data.ruleSet} forwardTargets={forwardTargets} />
        ))}
        <ActivityCard activity={data.activity} />
      </div>
    </>
  );
}
