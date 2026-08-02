import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ensureFreshToken, fileRequestFor } from "@/api/client";
import { ApiError } from "@/api/errors";

/**
 * Downloading a generated file (a bill PDF, a CSV, a full backup) and handing
 * it to Android.
 *
 * The file is written to the app's cache directory and then passed to the
 * system share sheet. That is deliberately the whole mechanism: the share sheet
 * already offers Print, Save to Drive, WhatsApp and every PDF viewer on the
 * device, so the app needs no storage permission, no bundled PDF renderer and
 * no file browser of its own.
 *
 * The downloader cannot replay a 401 the way the JSON client does, so the token
 * is refreshed up-front instead.
 */

export interface DownloadResult {
  uri: string;
  filename: string;
}

/**
 * `File.downloadFileAsync` rejects on a non-2xx response and writes no file, so
 * the server's actual refusal ("No bills generated for this month yet.") is not
 * recoverable from the failure itself. Fetching the same URL again gets that
 * message. It costs a second request, but only on the error path, and it is the
 * difference between a useful explanation and "download failed (404)".
 */
async function explainFailure(url: string, headers: Record<string, string>): Promise<ApiError> {
  try {
    const response = await fetch(url, { headers });

    if (response.status === 401) {
      return new ApiError("Your session has expired. Please sign in again.", "unauthorized", 401);
    }

    const body = (await response.json()) as { error?: string };
    if (body?.error) {
      return new ApiError(
        body.error,
        response.status >= 500 ? "server" : "business",
        response.status
      );
    }
    return new ApiError(`Could not prepare the file (${response.status})`, "server", response.status);
  } catch {
    return new ApiError("Could not prepare the file. Please try again.", "unknown");
  }
}

export async function downloadFile(path: string, fallbackName: string): Promise<DownloadResult> {
  await ensureFreshToken();
  const { url, headers } = fileRequestFor(path);

  // Cache, not documents: these are re-downloadable artefacts and Android may
  // reclaim the space whenever it needs to.
  const destination = new File(Paths.cache, fallbackName);

  try {
    // idempotent so re-sharing the same bill overwrites rather than failing on
    // "destination already exists".
    const file = await File.downloadFileAsync(url, destination, { headers, idempotent: true });
    return { uri: file.uri, filename: file.name };
  } catch (error) {
    // A transport failure never reached the server, so there is no body to read.
    const message = error instanceof Error ? error.message : "";
    if (!/\b(4\d\d|5\d\d)\b/.test(message)) {
      throw new ApiError("No connection. Check your internet and try again.", "network");
    }
    throw await explainFailure(url, headers);
  }
}

/** Download, then open Android's share sheet for it. */
export async function downloadAndShare(
  path: string,
  fallbackName: string,
  mimeType: string,
  dialogTitle: string
): Promise<void> {
  const { uri } = await downloadFile(path, fallbackName);

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError("Sharing is not available on this device.", "unknown");
  }

  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

export const sharePdf = (path: string, filename: string, title: string) =>
  downloadAndShare(path, filename, "application/pdf", title);

export const shareCsv = (path: string, filename: string, title: string) =>
  downloadAndShare(path, filename, "text/csv", title);

export const shareJson = (path: string, filename: string, title: string) =>
  downloadAndShare(path, filename, "application/json", title);
