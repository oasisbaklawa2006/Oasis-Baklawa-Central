import { createLovableConfig } from "lovable-agent-playwright-config/config";

export default createLovableConfig({
  use: {
    video: 'on',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
});
