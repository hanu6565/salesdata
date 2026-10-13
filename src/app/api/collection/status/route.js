import { calculateNextCollectionSchedule, CredentialVault } from "@/lib/autoCollection/collectionEngine";
import { API_PROTOCOL_AUDIT } from "@/lib/autoCollection/apiAudit";
import { STORES_MASTER } from "@/lib/storesConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const schedule = calculateNextCollectionSchedule();
    const vaultSummary = CredentialVault.getMaskedVaultSummary();

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      schedule,
      storesCount: STORES_MASTER.length,
      stores: STORES_MASTER.map(s => ({
        id: s.id,
        name: s.name,
        posSite: s.posSite,
        posAdapterStatus: s.posAdapterStatus,
        posStoreCode: s.posStoreCode,
        businessHours: s.businessHours,
        notes: s.notes
      })),
      vaultSummary,
      apiAudit: API_PROTOCOL_AUDIT
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
