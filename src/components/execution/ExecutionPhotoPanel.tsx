import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ExecutionPhotoPanel({
  disabled,
  onAttach,
}: {
  disabled?: boolean;
  onAttach: (imageReference: string, caption: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">Internal photo reference only (no upload pipeline in 3F).</p>
      <Input
        placeholder="Internal image reference URL or path"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
      <Input
        placeholder="Caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled || !url.trim()}
        onClick={() => {
          onAttach(url.trim(), caption.trim());
          setUrl("");
          setCaption("");
        }}
      >
        Attach photo metadata
      </Button>
    </div>
  );
}
