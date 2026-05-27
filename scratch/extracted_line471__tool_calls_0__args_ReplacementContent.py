function WeChatManagementView() {
  const [status, setStatus] = useState<WeChatStatusRow | null>(null);
  const [settings, setSettings] = useState<WeChatSettingsRow | null>(null);
  const [history, setHistory] = useState<WeChatHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [listenChatsList, setListenChatsList] = useState<string[]>([]);
  const [isBotActive, setIsBotActive] = useState(true);
  
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  // New settings configurations
  const [systemPrompt, setSystemPrompt] = useState("你是一个温暖专业的AI助理。请用简洁、亲和的语调进行微信回复，多使用 Emoji。");
  const [replyDelay, setReplyDelay] = useState(1);
  const [groupAtOnly, setGroupAtOnly] = useState(true);
  const [filePushEnabled, setFilePushEnabled] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState(false);

  const fetchWeChatData = useCallback(async () => {
    try {
      const { data: settingsData } = await supabase
        .from("wechat_settings")
        .select("*")
        .eq("id", "default")
        .single();
      
      if (settingsData) {
        setSettings(settingsData);
        setIsBotActive(settingsData.is_active);
        setSystemPrompt(settingsData.system_prompt || "你是一个温暖专业的AI助理。请用简洁、亲和的语调进行微信回复，多使用 Emoji。");
        setReplyDelay(settingsData.reply_delay ?? 1);
        setGroupAtOnly(settingsData.group_at_only ?? true);
        setFilePushEnabled(settingsData.file_push_enabled ?? true);
        if (settingsData.listen_chats.trim()) {
          setListenChatsList(settingsData.listen_chats.split(",").map((x: string) => x.trim()));
        } else {
          setListenChatsList([]);
        }
      }

      const { data: statusData } = await supabase
        .from("wechat_status")
        .select("*")
        .eq("id", "default")
        .single();
      
      if (statusData) {
        setStatus(statusData);
      }

      const { data: historyData } = await supabase
        .from("wechat_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (historyData) {
        setHistory(historyData as WeChatHistoryRow[]);
      }
    } catch (err) {
      console.error("Error fetching WeChat RPA metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeChatData();
    const interval = setInterval(() => {
      fetchWeChatData();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchWeChatData]);

  const handleSaveSettings = async (updatedActive: boolean, updatedList: string[]) => {
    setSavingSettings(true);
    const chatsStr = updatedList.join(",");
    const { error } = await supabase
      .from("wechat_settings")
      .update({
        is_active: updatedActive,
        listen_chats: chatsStr,
        updated_at: new Date().toISOString()
      })
      .eq("id", "default");
    
    if (!error) {
      setListenChatsList(updatedList);
      setIsBotActive(updatedActive);
      fetchWeChatData();
    }
    setSavingSettings(false);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    setRulesSuccess(false);
    const { error } = await supabase
      .from("wechat_settings")
      .update({
        system_prompt: systemPrompt,
        reply_delay: replyDelay,
        group_at_only: groupAtOnly,
        file_push_enabled: filePushEnabled,
        updated_at: new Date().toISOString()
      })
      .eq("id", "default");

    if (!error) {
      setRulesSuccess(true);
      setTimeout(() => setRulesSuccess(false), 3000);
      fetchWeChatData();
    } else {
      console.error("Failed to save rules:", error);
    }
    setSavingRules(false);
  };

  const handleAddChat = () => {
    const trimmed = newChatName.trim();
    if (trimmed && !listenChatsList.includes(trimmed)) {
      const newList = [...listenChatsList, trimmed];
      handleSaveSettings(isBotActive, newList);
      setNewChatName("");
    }
  };

  const handleRemoveChat = (chatName: string) => {
    const newList = listenChatsList.filter(c => c !== chatName);
    handleSaveSettings(isBotActive, newList);
  };

  const handleToggleBot = () => {
    const nextState = !isBotActive;
    handleSaveSettings(nextState, listenChatsList);
  };

  const handleRpaControl = async (action: "start" | "stop") => {
    setControlLoading(true);
    setControlError(null);
    try {
      const resp = await fetch("/api/rpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setControlError(data.error || "操作失败");
      } else {
        setTimeout(() => fetchWeChatData(), 1500);
      }
    } catch (err: any) {
      setControlError(err.message || "请求异常");
    } finally {
      setControlLoading(false);
    }
  };

  const formatElapsed = (sec: number) => {
    return `${sec.toFixed(1)}s`;
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("zh-CN", { hour12: false });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
          CONNECTING TO WECHAT RPA TELEMETRY DATABASE...
        </span>
      </div>
    );
  }

  const isHeartbeatAlive = () => {
    if (!status?.last_heartbeat) return false;
    const last = new Date(status.last_heartbeat).getTime();
    const now = Date.now();
    return (now - last) < 20000;
  };

  const isOnline = status?.client_status === "online" && isHeartbeatAlive();

  // Calculated dynamic metrics
  const totalReplies = history.length;
  const successReplies = history.filter(h => h.status === "success").length;
  const successRate = totalReplies > 0 ? Math.round((successReplies / totalReplies) * 100) : 100;
  
  const processedReplies = history.filter(h => h.elapsed_time > 0);
  const avgThinkingTime = processedReplies.length > 0
    ? (processedReplies.reduce((sum, h) => sum + h.elapsed_time, 0) / processedReplies.length)
    : 0;
  
  const hourCounts = Array(24).fill(0);
  history.forEach(h => {
    try {
      const hr = new Date(h.created_at).getHours();
      hourCounts[hr]++;
    } catch {}
  });
  let peakHour = 0;
  let maxCount = 0;
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] > maxCount) {
      maxCount = hourCounts[i];
      peakHour = i;
    }
  }
  const activeWindowStr = maxCount > 0 ? `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 1) % 24).padStart(2, "0")}:00` : "暂无数据";

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connection Status Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Daemon Connection</span>
              {isOnline ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--umx-acid)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--umx-acid)]"></span>
                </span>
              ) : (
                <span className="inline-flex rounded-full h-2 w-2 bg-neutral-600"></span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                {isOnline ? "ONLINE" : "OFFLINE"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              {isOnline ? `心跳正常 · 最后活动: ${formatTime(status?.last_heartbeat || "")}` : "未检测到本地 RPA 进程心跳"}
            </p>
          </div>
          
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50 space-y-2">
            {isOnline ? (
              <button
                onClick={() => handleRpaControl("stop")}
                disabled={controlLoading}
                className="w-full font-mono text-[9px] text-white hover:text-black uppercase text-center bg-red-600/20 hover:bg-red-500 border border-red-500/30 py-1.5 transition-all"
                style={{ borderRadius: "2px" }}
              >
                {controlLoading ? "PROCESSING..." : "停止托管进程 (STOP)"}
              </button>
            ) : (
              <button
                onClick={() => handleRpaControl("start")}
                disabled={controlLoading}
                className="w-full font-mono text-[9px] text-black hover:text-white uppercase text-center bg-[var(--umx-acid)] hover:bg-transparent border border-[var(--umx-acid)] py-1.5 transition-all font-bold"
                style={{ borderRadius: "2px" }}
              >
                {controlLoading ? "启动托管进程 (START)" : "启动托管进程 (START)"}
              </button>
            )}
            {controlError && (
              <p className="font-mono text-[8px] text-[#ff6b6b] text-center mt-1 leading-snug">
                ⚠️ {controlError}
              </p>
            )}
          </div>
        </div>

        {/* Bound Account Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">WeChat Client Nickname</span>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-xl font-bold tracking-wide truncate max-w-full text-white">
                {isOnline && status?.wechat_nickname ? status.wechat_nickname : "未绑定"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-3">
              {isOnline ? "成功挂载 PC 微信 GUI 窗口" : "进程未启动或窗口丢失"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-[var(--umx-text-dim)] uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              {isOnline ? "PID: 微信主窗口监听中" : "STATUS: 离线"}
            </span>
          </div>
        </div>

        {/* Analytics Card 1 */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Total Replies & Efficiency</span>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                {totalReplies} 次回复
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              平均思考响应时间: <span className="text-[var(--umx-acid)] font-bold">{avgThinkingTime.toFixed(1)}s</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-white/60 uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              活跃波峰: {activeWindowStr}
            </span>
          </div>
        </div>

        {/* Auto Reply Mode Card */}
        <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Auto Reply Toggle</span>
              <button
                onClick={handleToggleBot}
                disabled={savingSettings}
                className={`font-mono text-[9px] px-2 py-0.5 border ${
                  isBotActive 
                    ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" 
                    : "border-[var(--umx-line)] text-[var(--umx-text-dim)]"
                } transition-all uppercase`}
                style={{ borderRadius: "2px" }}
              >
                {savingSettings ? "SAVING..." : isBotActive ? "ACTIVE" : "PAUSED"}
              </button>
            </div>
            <div className="flex items-baseline gap-2 mt-3">
              <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
                {isBotActive ? "智能自动回复中" : "已暂停托管"}
              </h3>
            </div>
            <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
              回复成功率: <span className="text-[var(--umx-acid)] font-bold">{successRate}%</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
            <span className="block font-mono text-[8px] text-white/60 uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }}>
              规则模式: {listenChatsList.length > 0 ? `${listenChatsList.length} 人白名单` : "全局托管模式"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Section: Whitelist Control, Config Form & Log Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Whitelist & Rules Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Whitelist Manager */}
            <div className="border border-[var(--umx-line)] p-6 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[var(--umx-line)] pb-3">
                  <MessageSquare className="size-4 text-[var(--umx-acid)]" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">监听聊天名单 (Whitelist)</h3>
                </div>
                
                <p className="font-mono text-[10px] text-[var(--umx-text-dim)] mb-4 leading-relaxed">
                  微信 RPA 仅会针对以下白名单中的群聊全称或好友备注名进行回复。如果列表为空，微信 RPA 进程将运行在<strong>全局智能回复监听模式</strong>（⚠️ 回复所有人！）。
                </p>

                <div className="flex flex-wrap gap-2 mb-4 max-h-[160px] overflow-y-auto pr-1">
                  {listenChatsList.length === 0 ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider border border-[var(--umx-acid)]/30 text-[var(--umx-acid)] px-2.5 py-1" style={{ background: "rgba(218,252,8,0.02)", borderRadius: "2px" }}>
                      🌐 GLOBAL MODE — 全局监听回复
                    </span>
                  ) : (
                    listenChatsList.map(chat => (
                      <span 
                        key={chat} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-white border border-[var(--umx-line)] bg-white/5"
                        style={{ borderRadius: "2px" }}
                      >
                        {chat}
                        <button 
                          onClick={() => handleRemoveChat(chat)}
                          disabled={savingSettings}
                          className="text-[var(--umx-text-dim)] hover:text-[#ff6b6b] transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--umx-line)]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChatName}
                    onChange={e => setNewChatName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddChat()}
                    placeholder="添加群聊全称或好友备注..."
                    disabled={savingSettings}
                    className="flex-1 bg-black/40 border border-[var(--umx-line)] px-3 py-2 font-mono text-[11px] text-white focus:border-white focus:outline-none placeholder:text-[var(--umx-text-dim)]"
                    style={{ borderRadius: "2px" }}
                  />
                  <button
                    onClick={handleAddChat}
                    disabled={savingSettings || !newChatName.trim()}
                    className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-4 py-2 font-mono text-[10px] tracking-wider uppercase font-bold transition-all disabled:opacity-30"
                    style={{ borderRadius: "2px" }}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            {/* AI & Automation Rules Config */}
            <div className="border border-[var(--umx-line)] p-6 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-[var(--umx-line)] pb-3">
                  <Sparkles className="size-4 text-[var(--umx-acid)]" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">大模型及自动化策略</h3>
                </div>

                <div className="space-y-4">
                  {/* Reply Delay Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[9px]">
                      <span className="text-[var(--umx-text-dim)] uppercase">回复延迟时间 (Reply Delay)</span>
                      <span className="text-[var(--umx-acid)] font-bold">{replyDelay} 秒</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={replyDelay}
                        onChange={e => setReplyDelay(Number(e.target.value))}
                        disabled={savingRules}
                        className="flex-1 accent-[var(--umx-acid)] bg-neutral-850 h-1 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Group @-only Toggle */}
                  <div className="flex items-center justify-between border-t border-[var(--umx-line)]/40 pt-3">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-white">群聊仅回复 @ 消息</span>
                      <span className="block font-mono text-[7px] text-[var(--umx-text-dim)]">在群聊会话中，必须 @ 机器人时才自动回复</span>
                    </div>
                    <button
                      onClick={() => setGroupAtOnly(!groupAtOnly)}
                      disabled={savingRules}
                      className={`flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-neutral-700 p-0.5 transition-colors ${
                        groupAtOnly ? "bg-[var(--umx-acid)]" : "bg-neutral-900"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                          groupAtOnly ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* File Push Toggle */}
                  <div className="flex items-center justify-between border-t border-[var(--umx-line)]/40 pt-3">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-white">智能文件/图片推送</span>
                      <span className="block font-mono text-[7px] text-[var(--umx-text-dim)]">支持大模型生成图片、文档时自动推送到微信</span>
                    </div>
                    <button
                      onClick={() => setFilePushEnabled(!filePushEnabled)}
                      disabled={savingRules}
                      className={`flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-neutral-700 p-0.5 transition-colors ${
                        filePushEnabled ? "bg-[var(--umx-acid)]" : "bg-neutral-900"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                          filePushEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--umx-line)] flex items-center justify-between">
                <span className="font-mono text-[8px] text-[var(--umx-acid)] uppercase">
                  {rulesSuccess ? "✓ 已同步到本地" : ""}
                </span>
                <button
                  onClick={handleSaveRules}
                  disabled={savingRules}
                  className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-5 py-2 font-mono text-[10px] tracking-wider uppercase font-bold transition-all disabled:opacity-30"
                  style={{ borderRadius: "2px" }}
                >
                  {savingRules ? "同步中..." : "保存AI策略"}
                </button>
              </div>
            </div>
          </div>

          {/* System Prompt Code Pane */}
          <div className="border border-[var(--umx-line)] p-6" style={{ background: "rgba(255,255,255,0.01)" }}>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquareCode className="size-4 text-[var(--umx-acid)]" />
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">大模型设定提示词 (System Prompt)</h3>
              </div>
              <span className="font-mono text-[8px] text-[var(--umx-text-dim)] uppercase">
                IDE-Style System Instruction Editor
              </span>
            </div>

            <div className="relative font-mono text-[11px] border border-[var(--umx-line)] bg-black/80">
              {/* Terminal header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--umx-line)] bg-white/5 select-none">
                <span className="text-white/40 text-[9px] uppercase tracking-wider font-bold">system_prompt.txt</span>
                <span className="text-[var(--umx-acid)] text-[9px] uppercase font-bold">UTF-8</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                disabled={savingRules}
                className="w-full min-h-[120px] bg-black/30 p-4 text-white focus:outline-none font-mono text-[11px] leading-relaxed resize-y focus:bg-black/40"
                placeholder="在此输入机器人的大模型 System Prompt 设定..."
              />
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <p className="font-mono text-[8.5px] text-[var(--umx-text-dim)] leading-relaxed max-w-[70%]">
                💡 设定将实时写入 Supabase，守护进程检测到配置变更后无需重启即可动态生效。
              </p>
              <button
                onClick={handleSaveRules}
                disabled={savingRules}
                className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-6 py-2.5 font-mono text-[10px] tracking-widest uppercase font-bold transition-all disabled:opacity-30"
                style={{ borderRadius: "2px" }}
              >
                {savingRules ? "保存中..." : "保存提示词"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Terminal/Log Console */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="border border-[var(--umx-line)] p-6 flex flex-col h-full justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-[var(--umx-acid)] animate-pulse" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">运行日志终端</h3>
                </div>
                <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase tracking-wider">
                  {isOnline ? "🔴 4s 心跳轮询" : "⏳ 进程已离线"}
                </span>
              </div>

              {/* Console Box */}
              <div className="bg-black/90 border border-[var(--umx-line)] p-4 font-mono text-[10px] text-[var(--umx-silver)] flex-1 min-h-[300px] max-h-[460px] overflow-y-auto space-y-1.5 select-text selection:bg-[var(--umx-acid)] selection:text-black">
                {(!status?.system_logs || status.system_logs.length === 0) ? (
                  <div className="flex items-center justify-center h-full text-[var(--umx-text-dim)] uppercase tracking-wider text-center">
                    WAITING FOR LIVE TELEMETRY LOGS STREAM...
                  </div>
                ) : (
                  status.system_logs.map((log, i) => {
                    let colorClass = "text-[var(--umx-silver)]";
                    if (log.includes("[ERROR]")) colorClass = "text-[#ff6b6b]";
                    else if (log.includes("[WARNING]")) colorClass = "text-yellow-400";
                    else if (log.includes("[思考开始]") || log.includes("触发AI思考")) colorClass = "text-cyan-400";
                    else if (log.includes("[思考完成]") || log.includes("成功送达")) colorClass = "text-[var(--umx-acid)]";
                    
                    return (
                      <div key={i} className={`leading-relaxed break-all ${colorClass}`}>
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--umx-line)] flex items-center justify-between">
              <span className="font-mono text-[8px] text-[var(--umx-text-dim)]">
                TELEMETRY ACTIVE
              </span>
              <button 
                onClick={() => {
                  if (status) {
                    setStatus({ ...status, system_logs: [] });
                  }
                }}
                className="font-mono text-[8px] text-[var(--umx-text-dim)] hover:text-white uppercase tracking-wider border border-[var(--umx-line)] px-2 py-1 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                CLEAR CONSOLE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. History Feed Table */}
      <div className="border border-[var(--umx-line)] p-6" style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[var(--umx-acid)]" />
            <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">自动回复历史日志 (Auto-Reply History)</h3>
          </div>
          <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase">
            最近 50 条匹配记录
          </span>
        </div>

        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="mb-3 size-8 text-[var(--umx-text-dim)]" />
              <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
                暂无自动回复历史记录
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--umx-line)] bg-white/[0.01] select-none">
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[12%]">时间</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[15%]">会话窗口</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[10%]">发言人</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">收到的消息</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">AI 的自动回复</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[8%]">耗时</th>
                  <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[5%]">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--umx-line)]">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)]">
                      {new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-white font-bold truncate max-w-[120px]">
                      {row.chat_name}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-silver)] truncate max-w-[100px]">
                      {row.sender}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)] max-w-[200px] truncate" title={row.message}>
                      {row.message}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-white max-w-[200px] truncate" title={row.response}>
                      {row.response}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px]">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[var(--umx-line)] text-[var(--umx-silver)]" style={{ borderRadius: "2px" }}>
                        <Timer className="size-2.5" />
                        {formatElapsed(row.elapsed_time)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {row.status === "success" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-[var(--umx-acid)]/30 text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" style={{ borderRadius: "2px" }}>
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-red-500/30 text-[#ff6b6b] bg-red-500/10" style={{ borderRadius: "2px" }}>
                          ERROR
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

interface WeChatStatusRow {
  client_status: string;
  last_heartbeat: string | null;
  wechat_nickname: string;
  active_workers: number;
  system_logs: string[];
  updated_at: string;
}

interface WeChatSettingsRow {
  listen_chats: string;
  is_active: boolean;
  system_prompt: string;
  reply_delay: number;
  group_at_only: boolean;
  file_push_enabled: boolean;
}