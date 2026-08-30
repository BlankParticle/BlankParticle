import { SpinnerGapIcon } from "@blankparticle/ui/icons-ssr";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Input } from "@blankparticle/ui/primitives/input.tsx";
import { Label } from "@blankparticle/ui/primitives/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@blankparticle/ui/primitives/select.tsx";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import type * as React from "react";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

function FieldErrors({ errors }: { errors: ReadonlyArray<unknown> }) {
  if (errors.length === 0) return null;
  return (
    <p className="text-destructive text-xs font-medium">
      {errors
        .map((error) => (typeof error === "string" ? error : ((error as { message?: string })?.message ?? "")))
        .join(", ")}
    </p>
  );
}

function useFieldErrors(meta: { isTouched: boolean; errors: ReadonlyArray<unknown> }) {
  return meta.isTouched ? meta.errors : [];
}

function TextField({
  label,
  suffix,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; suffix?: React.ReactNode }) {
  const field = useFieldContext<string>();
  const errors = useFieldErrors(field.state.meta);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          aria-invalid={errors.length > 0 || undefined}
          {...props}
        />
        {suffix}
      </div>
      <FieldErrors errors={errors} />
    </div>
  );
}

function SelectField({ label, items }: { label: string; items: Record<string, string> }) {
  const field = useFieldContext<string>();
  const errors = useFieldErrors(field.state.meta);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Select value={field.state.value} onValueChange={(value) => value && field.handleChange(value)} items={items}>
        <SelectTrigger id={field.name} onBlur={field.handleBlur}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([value, itemLabel]) => (
            <SelectItem key={value} value={value}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldErrors errors={errors} />
    </div>
  );
}

function SubmitButton({
  children,
  pendingText,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit || isSubmitting} {...props}>
          {isSubmitting ? (
            <>
              <SpinnerGapIcon className="animate-spin" /> {pendingText}
            </>
          ) : (
            children
          )}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField },
  formComponents: { SubmitButton },
});
