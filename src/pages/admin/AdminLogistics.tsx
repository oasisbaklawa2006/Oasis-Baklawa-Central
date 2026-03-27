import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Trash2, Save, Loader2, Plus, Settings2, CalendarOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface FactoryHoliday {
  id: string;
  holiday_date: string;
  description: string | null;
}

const AdminLogistics = () => {
  const [bufferDays, setBufferDays] = useState(0);
  const [savedBuffer, setSavedBuffer] = useState(0);
  const [bufferLoading, setBufferLoading] = useState(true);
  const [bufferSaving, setBufferSaving] = useState(false);

  const [holidays, setHolidays] = useState<FactoryHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [newDate, setNewDate] = useState<Date>();
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBuffer();
    fetchHolidays();
  }, []);

  const fetchBuffer = async () => {
    setBufferLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("global_buffer_days")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      const val = data?.global_buffer_days ?? 0;
      setBufferDays(val);
      setSavedBuffer(val);
    } catch (e: any) {
      toast.error(e.message || "Failed to load buffer settings");
    } finally {
      setBufferLoading(false);
    }
  };

  const saveBuffer = async () => {
    setBufferSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ global_buffer_days: bufferDays, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      setSavedBuffer(bufferDays);
      toast.success(`Buffer updated to +${bufferDays} days`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save buffer");
    } finally {
      setBufferSaving(false);
    }
  };

  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const { data, error } = await supabase
        .from("factory_holidays")
        .select("*")
        .gte("holiday_date", new Date().toISOString().split("T")[0])
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      setHolidays(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load holidays");
    } finally {
      setHolidaysLoading(false);
    }
  };

  const addHoliday = async () => {
    if (!newDate) { toast.error("Select a date"); return; }
    if (!newReason.trim()) { toast.error("Enter a reason"); return; }
    setAdding(true);
    try {
      const dateStr = format(newDate, "yyyy-MM-dd");
      const exists = holidays.some(h => h.holiday_date === dateStr);
      if (exists) { toast.error("This date is already blocked"); setAdding(false); return; }

      const { error } = await supabase.from("factory_holidays").insert({
        holiday_date: dateStr,
        description: newReason.trim(),
      });
      if (error) throw error;
      toast.success(`${format(newDate, "dd MMM yyyy")} blocked`);
      setNewDate(undefined);
      setNewReason("");
      fetchHolidays();
    } catch (e: any) {
      toast.error(e.message || "Failed to block date");
    } finally {
      setAdding(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("factory_holidays").delete().eq("id", id);
      if (error) throw error;
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success("Date unblocked");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Logistics & Capacity Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Control dispatch buffer days and factory blocked dates for accurate delivery estimation.</p>
      </div>

      {/* Buffer Days Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Global Dispatch Buffer</CardTitle>
              <CardDescription>Extra days added to every delivery estimate for safety margin.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {bufferLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : (
            <>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <Slider
                    value={[bufferDays]}
                    onValueChange={([v]) => setBufferDays(v)}
                    min={0}
                    max={10}
                    step={1}
                  />
                </div>
                <div className="text-3xl font-bold text-primary w-16 text-center">+{bufferDays}</div>
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={saveBuffer}
                  disabled={bufferSaving || bufferDays === savedBuffer}
                  size="sm"
                >
                  {bufferSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                  Save Buffer
                </Button>
                {bufferDays !== savedBuffer && (
                  <span className="text-xs text-muted-foreground">Unsaved change (was +{savedBuffer})</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Factory Calendar Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <CalendarOff size={20} className="text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Factory Blocked Dates</CardTitle>
              <CardDescription>Holidays and maintenance days excluded from dispatch scheduling.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Add form */}
          <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !newDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    disabled={(d) => d < new Date(new Date().toDateString())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs font-semibold">Reason</Label>
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Diwali Closed, Oven Maintenance"
              />
            </div>
            <Button onClick={addHoliday} disabled={adding} size="sm">
              {adding ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
              Block Date
            </Button>
          </div>

          {/* Holidays list */}
          {holidaysLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming blocked dates. Factory operates all days.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => {
                    const d = new Date(h.holiday_date + "T00:00:00");
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{format(d, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-muted-foreground">{format(d, "EEEE")}</TableCell>
                        <TableCell>{h.description || "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteHoliday(h.id)}
                            disabled={deletingId === h.id}
                          >
                            {deletingId === h.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogistics;
