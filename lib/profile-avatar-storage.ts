import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

export const PROFILES_BUCKET = "profiles";
export const PROFILE_AVATAR_KEY = "avatar";
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const AVATAR_TYPE_SET = new Set(AVATAR_ACCEPT.split(","));

export function authUserAvatarPath(userId: string) {
  return `${userId}/${PROFILE_AVATAR_KEY}`;
}

export function studentAvatarPath(studentId: number) {
  return `students/${studentId}/${PROFILE_AVATAR_KEY}`;
}

export function teacherAvatarPath(teacherId: number) {
  return `teachers/${teacherId}/${PROFILE_AVATAR_KEY}`;
}

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPE_SET.has(file.type)) {
    if (!file.type || file.type.trim() === "") {
      return "Your browser did not report an image type for this file. That often happens with HEIC/HEIF or other camera formats. Export or convert to JPEG or PNG, then try again.";
    }
    return `This file is labeled as “${file.type}”. Profile photos must be one of: JPEG (.jpg), PNG, WebP, or GIF—not documents, screenshots saved as PDF, or raw camera formats unless converted.`;
  }
  if (file.size > AVATAR_MAX_BYTES) {
    const maxMb = (AVATAR_MAX_BYTES / (1024 * 1024)).toFixed(0);
    const gotMb = (file.size / (1024 * 1024)).toFixed(1);
    return `This file is about ${gotMb} MB. The limit is ${maxMb} MB. Resize or compress the image, or pick a smaller file.`;
  }
  if (file.size === 0) {
    return "This file is empty (0 bytes). Pick a different image file.";
  }
  return null;
}

/**
 * Turns raw Supabase Storage errors into actionable copy for profile uploads.
 */
export function explainProfilePhotoStorageError(rawMessage: string): string {
  const m = rawMessage.toLowerCase();

  if (m.includes("row-level security") || m.includes("violates policy") || m.includes("rls")) {
    return "Supabase Storage blocked this upload (row-level security). Apply the latest project migration for the `profiles` bucket so the `public` role can insert into that bucket, or adjust policies in the Supabase Storage UI.";
  }

  if (
    m.includes("bucket not found") ||
    m.includes("no such bucket") ||
    (m.includes("bucket") && (m.includes("does not exist") || m.includes("not found")))
  ) {
    return `The “${PROFILES_BUCKET}” storage bucket does not exist in this Supabase project. In the Supabase dashboard, create that bucket (or run the repo’s SQL migrations that insert it) before uploading photos.`;
  }

  if (
    m.includes("jwt") ||
    m.includes("invalid claim") ||
    m.includes("not authenticated") ||
    m.includes("login required") ||
    m.includes("unauthorized") ||
    m.includes("401")
  ) {
    return "Supabase rejected the upload because there is no valid signed-in session (or the session expired). Sign in again, refresh the page, and retry.";
  }

  if (m.includes("mime") || m.includes("invalid type") || m.includes("content-type")) {
    return `The storage bucket rejected this file’s type. Only JPEG, PNG, WebP, and GIF are allowed, and the bucket may restrict MIME types in its settings. Technical detail: ${rawMessage}`;
  }

  if (m.includes("too large") || m.includes("entity too large") || m.includes("413") || m.includes("payload")) {
    return `The file is larger than this bucket’s upload limit (often 5 MB in our migrations). Compress the image or raise the bucket’s file size limit in Supabase. Technical detail: ${rawMessage}`;
  }

  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) {
    return `Could not reach Supabase to upload the file (${rawMessage}). Check your internet connection and that NEXT_PUBLIC_SUPABASE_URL is correct.`;
  }

  return `Photo upload failed: ${rawMessage}`;
}

/**
 * When saving `avatar_url` on students/teachers fails, map common schema issues.
 */
export function explainAvatarUrlSaveError(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (m.includes("avatar_url") && (m.includes("column") || m.includes("does not exist") || m.includes("unknown"))) {
    return "The database does not have an `avatar_url` column on this table yet. Apply the project migration that adds `avatar_url` to students and teachers, then try again.";
  }
  if (m.includes("permission denied") || m.includes("row-level security") || m.includes("rls")) {
    return "Saving the photo URL was blocked by database row-level security (or missing privileges). Check Supabase policies on the students/teachers tables for your role, or use the same access pattern as other edits in this app.";
  }
  return rawMessage;
}

/**
 * When updating the signed-in user’s `user_metadata.avatar_url` fails.
 */
export function explainAccountAvatarMetadataError(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (m.includes("network") || m.includes("fetch")) {
    return `Could not reach Supabase to update your profile (${rawMessage}). Check your connection and try again.`;
  }
  if (m.includes("jwt") || m.includes("session")) {
    return "Your session is invalid or expired. Sign in again, then change your profile photo.";
  }
  return rawMessage;
}

export async function uploadProfilePhoto(
  supabase: SupabaseClient<Database>,
  objectPath: string,
  file: File
): Promise<{ publicUrl: string } | { error: string }> {
  const validation = validateAvatarFile(file);
  if (validation) return { error: validation };
  const { error } = await supabase.storage.from(PROFILES_BUCKET).upload(objectPath, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) return { error: explainProfilePhotoStorageError(error.message) };
  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILES_BUCKET).getPublicUrl(objectPath);
  return { publicUrl: `${publicUrl}?v=${Date.now()}` };
}
