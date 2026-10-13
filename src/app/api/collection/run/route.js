import { executeCollectionWorkflow, SYNC_MODES } from "@/lib/autoCollection/collectionEngine";
import { ROLES, canAccessStore } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // Max execution timeout for Vercel functions

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      mode = SYNC_MODES.INCREMENTAL, 
      storeId = "all", 
      userRole = ROLES.HQ_MASTER,
      authorizedStoreIds = ["*"]
    } = body;

    // 권한 검증: 본사 관리자 또는 허가된 매장만 실행 가능
    const user = { role: userRole, authorizedStoreIds };
    if (storeId !== "all" && !canAccessStore(user, storeId)) {
      return Response.json({
        success: false,
        error: "FORBIDDEN: 해당 매장의 수집 실행 권한이 없습니다."
      }, { status: 403 });
    }

    if (storeId === "all" && userRole !== ROLES.HQ_MASTER) {
      return Response.json({
        success: false,
        error: "FORBIDDEN: 전체 매장 수집은 본사 총괄 관리자만 실행 가능합니다."
      }, { status: 403 });
    }

    const workflowResult = await executeCollectionWorkflow({
      mode,
      targetStoreId: storeId
    });

    return Response.json({
      success: true,
      result: workflowResult
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
