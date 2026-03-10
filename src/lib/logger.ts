import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type LogAction = Database["public"]["Enums"]["log_action"];
type EntityType = string;

interface LogParams {
  action: LogAction;
  entityType: EntityType;
  entityId?: string;
  description: string;
}

export const logActivity = async ({ action, entityType, entityId, description }: LogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("logs").insert({
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      description,
      user_id: user?.id || null,
      ip_address: null // يمكن إضافة IP لاحقاً
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
