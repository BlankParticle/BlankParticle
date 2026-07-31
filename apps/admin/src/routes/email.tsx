import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import {
  ActivityIcon,
  AtSignIcon,
  CheckIcon,
  ClockIcon,
  InboxIcon,
  Loader2Icon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ActionBadge } from "@/components/action-badge.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { useAppForm } from "@/components/ui/form.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { addDestination, clearActivity, removeDestination, saveRuleSet, type DestinationAddress } from "@/lib/api.ts";
import { emailConfigQuery } from "@/lib/queries.ts";
import type { ActivityEntry, EmailRule, RuleAction, RuleSet } from "@/lib/rules.ts";

export const Route = createFileRoute("/email")({
  loader: ({ context }) => context.queryClient.ensureQueryData(emailConfigQuery),
  component: EmailRules,
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
      <SelectTrigger>
        <SelectValue />
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
        <PlusIcon /> rule
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New rule · {zone}</DialogTitle>
          <DialogDescription>
            First matching address wins; unmatched mail falls through to the catch-all.
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
              <form.SubmitButton pendingText="adding…">
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
  zone: string;
  ruleSet: RuleSet;
  forwardTargets: readonly string[];
}) {
  const save = useSaveRules();
  const pendingSource = save.isPending ? save.variables.source : undefined;

  const rules = ruleSet.rules.filter((rule) => rule.zone === zone);
  const defaultAction = ruleSet.defaults[zone] ?? { type: "drop" as const };

  const patchRule = (id: string, patch: Partial<EmailRule>) =>
    save.mutate({
      source: `rule:${id}`,
      update: (current) => ({
        ...current,
        rules: current.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
      }),
    });

  return (
    <Card id={zone} className="scroll-mt-20">
      <CardHeader className="flex-row items-center">
        <CardTitle className="flex items-center gap-2">
          <AtSignIcon className="text-orange-deep size-4.5" />
          {zone}
        </CardTitle>
        <CardAction>
          <AddRuleDialog zone={zone} forwardTargets={forwardTargets} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-ink-muted text-sm italic">no rules — everything falls into the catch-all below</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>address</TableHead>
                <TableHead>action</TableHead>
                <TableHead>note</TableHead>
                <TableHead className="text-right">on</TableHead>
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
                    <TableCell className="text-muted-foreground max-w-48 truncate text-xs">{rule.note}</TableCell>
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
                          <Loader2Icon className="animate-spin" />
                        ) : (
                          <Trash2Icon />
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
      <CardFooter className="border-ink bg-lime/60 -mb-5 justify-between gap-3 rounded-b-[10px] border-t-2 py-3">
        <div className="flex items-center gap-2">
          <InboxIcon className="size-4.5" />
          <span className="font-heading font-extrabold">catch-all</span>
          <span className="text-ink-muted hidden text-sm sm:inline">everything not matched above</span>
          {pendingSource === "catch-all" && <Loader2Icon className="text-ink-muted size-4 animate-spin" />}
        </div>
        <ActionSelect
          value={encodeAction(defaultAction)}
          onChange={(value) =>
            save.mutate({
              source: "catch-all",
              update: (current) => ({ ...current, defaults: { ...current.defaults, [zone]: decodeAction(value) } }),
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
        <CardTitle className="flex items-center gap-2">
          <SendIcon className="text-orange-deep size-4.5" />
          Destinations
        </CardTitle>
        <CardDescription>The rule engine can only forward to verified addresses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {destinations.map((destination) => (
            <li key={destination.id} className="flex items-center gap-2">
              <span className="font-mono text-sm">{destination.email}</span>
              {destination.verified ? (
                <Badge variant="secondary">verified</Badge>
              ) : (
                <Badge variant="destructive">pending verification</Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-orange-deep ml-auto"
                disabled={removeDest.isPending && removeDest.variables === destination.id}
                onClick={() => removeDest.mutate(destination.id)}
              >
                {removeDest.isPending && removeDest.variables === destination.id ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <Trash2Icon />
                )}
                <span className="sr-only">Remove destination</span>
              </Button>
            </li>
          ))}
          {destinations.length === 0 && (
            <li className="text-ink-muted text-sm italic">no destinations — add one to be able to forward mail</li>
          )}
        </ul>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label="Add destination"
                type="email"
                placeholder="you@example.com"
                className="w-72 font-mono"
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton variant="outline" size="sm" pendingText="adding…">
              <PlusIcon /> add
            </form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(ts: number) {
  return `${new Date(ts).toISOString().slice(0, 16).replace("T", " ")} UTC`;
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
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="text-orange-deep size-4.5" />
            Activity
          </CardTitle>
          <CardDescription>Last {activity.length} messages handled by the rule engine.</CardDescription>
        </div>
        {activity.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => clear.mutate()} disabled={clear.isPending}>
              {clear.isPending && <Loader2Icon className="animate-spin" />}
              clear
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-ink-muted text-sm italic">nothing yet — mail shows up here as it flows through</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <ClockIcon className="inline size-3" /> when
                </TableHead>
                <TableHead>from</TableHead>
                <TableHead>to</TableHead>
                <TableHead>subject</TableHead>
                <TableHead>outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((entry) => (
                <TableRow key={`${entry.ts}-${entry.to}-${entry.from}`}>
                  <TableCell className="text-muted-foreground font-mono text-xs">{formatTimestamp(entry.ts)}</TableCell>
                  <TableCell className="max-w-52 truncate font-mono text-xs">{entry.from}</TableCell>
                  <TableCell className="max-w-52 truncate font-mono text-xs">{entry.to}</TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate text-xs">{entry.subject}</TableCell>
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

function EmailRules() {
  const { data } = useSuspenseQuery(emailConfigQuery);

  const forwardTargets = data.destinations
    .filter((destination) => destination.verified)
    .map((destination) => destination.email);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Email Rules</h1>

      <DestinationsCard destinations={data.destinations} />

      {data.zones.map((zone) => (
        <ZoneCard key={zone} zone={zone} ruleSet={data.ruleSet} forwardTargets={forwardTargets} />
      ))}

      <ActivityCard activity={data.activity} />
    </div>
  );
}
