"use client";

import { Avatar } from "@/app/components/avatar";
import { Button } from "@/app/components/button";
import { Field, Label } from "@/app/components/fieldset";
import { Text } from "@/app/components/text";
import { AVATAR_ACCEPT, validateAvatarFile } from "@/lib/profile-avatar-storage";
import type { ChangeEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

export type EntityAvatarFieldProps = {
  disabled?: boolean;
  initials: string;
  existingUrl?: string | null;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  label?: string;
  square?: boolean;
};

export function EntityAvatarField({
  disabled,
  initials,
  existingUrl = null,
  pendingFile,
  onPendingFileChange,
  label = "Photo (optional)",
  square = true,
}: EntityAvatarFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const displaySrc = objectUrl ?? existingUrl ?? null;

  return (
    <Field>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          square={square}
          src={displaySrc}
          initials={initials}
          alt=""
          className="size-14 shrink-0 bg-zinc-100 text-base text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" outline disabled={disabled} onClick={() => inputRef.current?.click()}>
              Choose image…
            </Button>
            {pendingFile ? (
              <Button
                type="button"
                plain
                disabled={disabled}
                onClick={() => {
                  setPickError(null);
                  onPendingFileChange(null);
                }}
              >
                Clear selection
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!file) {
                onPendingFileChange(null);
                setPickError(null);
                return;
              }
              const err = validateAvatarFile(file);
              if (err) {
                setPickError(err);
                return;
              }
              setPickError(null);
              onPendingFileChange(file);
            }}
          />
          {pendingFile ? (
            <Text className="text-xs text-zinc-500 dark:text-zinc-400">New photo saves when you submit the form.</Text>
          ) : null}
          {pickError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {pickError}
            </p>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
