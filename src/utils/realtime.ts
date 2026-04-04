import { supabase } from "@/integrations/supabase/client";

export const removeDuplicateRealtimeChannel = (channelName: string) => {
  const duplicates = supabase
    .getChannels()
    .filter((channel) => channel.topic === `realtime:${channelName}`);

  duplicates.forEach((channel) => {
    void supabase.removeChannel(channel);
  });
};