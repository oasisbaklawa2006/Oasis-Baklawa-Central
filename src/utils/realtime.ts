import { supabase } from "@/integrations/supabase/client";
import {
  normalizeRealtimeChannelName,
  supabaseTopicForChannel,
} from "@/lib/realtime/realtimeChannelNaming";

export const removeDuplicateRealtimeChannel = (channelName: string) => {
  const normalized = normalizeRealtimeChannelName(channelName);
  const topic = supabaseTopicForChannel(normalized);
  const duplicates = supabase.getChannels().filter((channel) => channel.topic === topic);

  duplicates.forEach((channel) => {
    void supabase.removeChannel(channel);
  });
};
