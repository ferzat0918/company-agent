# Implementation Plan: Premium WeChat RPA Dashboard & Control Panel

This plan outlines the design and implementation of a premium WeChat RPA management dashboard within the Next.js Admin page. It replicates features from modern WeChat robot UIs (like `SiverWXbot_plus`) using the UMX retro-futuristic styling tokens.

## User Review Required

> [!IMPORTANT]
> **Process Control Isolation**:
> The Next.js app running inside the Docker container is mapped to the Windows host network. The `/api/rpa` route interacts with the Windows host processes using command executions (like `taskkill` and `spawn`).
> To allow these buttons to manage the local daemon seamlessly, the Next.js process must have appropriate command permissions.

> [!NOTE]
> **Direct Sync with Local Daemon**:
> By saving settings directly in the `wechat_settings` Supabase table, the `wechat_rpa_v4.py` script (which polls settings every 10s) will dynamically pick up new prompts, delays, and filter configurations without requiring a process restart.

---

## Proposed Changes

We will modify the frontend Next.js code to support advanced settings columns (`system_prompt`, `reply_delay`, `group_at_only`, `file_push_enabled`), add explicit start/stop buttons for the daemon, calculate analytical metrics from historical data, and design a gorgeous control dashboard.

### Next.js Admin View

#### [MODIFY] [page.tsx](file:///C:/Users/lenovo/company-agent/frontend/agent-chat-ui/src/app/admin/page.tsx)
- **Settings Columns Integration**:
  - Extend the `WeChatSettingsRow` type interface with `system_prompt`, `reply_delay`, `group_at_only`, and `file_push_enabled`.
  - Add state variables (`systemPrompt`, `replyDelay`, `groupAtOnly`, `filePushEnabled`) in `WeChatManagementView` and load them in `fetchWeChatData`.
  - Create a unified settings save function that handles white-list and dynamic toggles.
- **Daemon Process Controls**:
  - Replace the static "💡 RUN python wechat_rpa_v4.py ON HOST" span with two action buttons: **启动托管进程 (Start Daemon)** and **停止托管进程 (Stop Daemon)**.
  - Bind `handleRpaControl("start")` and `handleRpaControl("stop")` with interactive loading states, spinners, and success/error status toasts.
- **Analytics Metrics Panel**:
  - Automatically calculate statistics from the `history` state array:
    - **Total Responses**: length of history.
    - **Success Rate**: percentage of rows with `status === 'success'`.
    - **Average Time**: average `elapsed_time` formatted in seconds.
    - **Peak Interactions Window**: hour block with the most responses.
- **Premium Styling & Layout**:
  - Implement a 2-column layout for the settings: Whitelist manager (left) and Prompt & Rules panel (right).
  - Use a sleek retro code editor style for the `system_prompt` text area.
  - Implement dynamic slider for `reply_delay` and stylized checkboxes for rule flags.
  - Enhance live log console with auto-scrolling, clear buffer capability, and rich color-coding.

---

## Verification Plan

### Automated Tests
- Run typecheck in the frontend directory to ensure zero compilation or build errors:
  ```powershell
  cd C:\Users\lenovo\company-agent\frontend\agent-chat-ui
  npx tsc --noEmit
  ```

### Manual Verification
- Deploy/render the `/admin` page and click `"微信智能托管"` tab.
- Test adding and removing whitelist items; verify instant updates.
- Test changing the system prompt, setting a reply delay of 5 seconds, and toggling rules; verify they write to Supabase.
- Test clicking "启动托管进程" and "停止托管进程"; confirm the local Python process starts and terminates on the Windows host.
