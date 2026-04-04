import { supabase } from "@/integrations/supabase/client";

export const removeDuplicateRealtimeChannel = (channelName: string) => {
  const duplicate = supabase
    .getChannels()
    .find((channel) => channel.topic === `realtime:${channelName}`);

  if (duplicate) {
    void supabase.removeChannel(duplicate);
  }
};