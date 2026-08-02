import { updateSettingsSchema } from "@/lib/schemas/settings.schema";
import { getSettings, updateSettings } from "@/lib/services/settings.service";
import { encrypt } from "@/lib/utils/encryption";
import { withAuth } from "@/lib/mobile/guard";
import { fail, failFrom, ok } from "@/lib/mobile/response";
import { toSettingsDTO } from "@/lib/mobile/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/settings
 *
 * The stored WhatsApp access token is never included — the DTO exposes only a
 * `whatsappConfigured` boolean. A device that is lost should not carry the
 * credential that can send messages as the dairy.
 */
export const GET = withAuth(async () => ok(toSettingsDTO(await getSettings())));

/**
 * PUT /api/mobile/settings
 *
 * Same schema, same blank-means-unchanged handling, and the same AES-GCM
 * encryption of the Green API token as `updateSettingsAction`. Sending the
 * token field blank leaves the stored one intact, so the app can save farm
 * details without ever holding the credential.
 */
export const PUT = withAuth(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Validation failed", 422, parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const data = { ...parsed.data };

  if (!data.whatsappAccessToken?.trim()) delete data.whatsappAccessToken;
  if (!data.whatsappPhoneNumberId?.trim()) delete data.whatsappPhoneNumberId;

  if (data.whatsappAccessToken && data.whatsappAccessToken.length > 20) {
    try {
      data.whatsappAccessToken = encrypt(data.whatsappAccessToken);
    } catch {
      // Skip encryption if the key is not configured, matching the web path.
    }
  }

  try {
    await updateSettings(data as unknown as Parameters<typeof updateSettings>[0]);
    return ok(toSettingsDTO(await getSettings()));
  } catch (error) {
    return failFrom(error, "Failed to update settings");
  }
});
