Created At: 2026-05-26T08:35:16Z
Completed At: 2026-05-26T08:35:16Z
File Path: `file:///C:/Users/lenovo/company-agent/frontend/agent-chat-ui/src/app/admin/page.tsx`
Total Lines: 2445
Total Bytes: 107913
Showing lines 2100 to 2445
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
2100:       const d = new Date(isoString);
2101:       return d.toLocaleTimeString("zh-CN", { hour12: false });
2102:     } catch {
2103:       return isoString;
2104:     }
2105:   };
2106: 
2107:   if (loading) {
2108:     return (
2109:       <div className="flex justify-center py-20">
2110:         <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--umx-text-dim)]">
2111:           CONNECTING TO WECHAT RPA TELEMETRY DATABASE...
2112:         </span>
2113:       </div>
2114:     );
2115:   }
2116: 
2117:   const isHeartbeatAlive = () => {
2118:     if (!status?.last_heartbeat) return false;
2119:     const last = new Date(status.last_heartbeat).getTime();
2120:     const now = Date.now();
2121:     return (now - last) < 20000;
2122:   };
2123: 
2124:   const isOnline = status?.client_status === "online" && isHeartbeatAlive();
2125: 
2126:   return (
2127:     <div className="space-y-6">
2128:       {/* 1. Header Metrics Card Grid */}
2129:       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
2130:         {/* Connection Status Card */}
2131:         <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
2132:           <div>
2133:             <div className="flex items-center justify-between mb-2">
2134:               <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Daemon Connection</span>
2135:               {isOnline ? (
2136:                 <span className="relative flex h-2 w-2">
2137:                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--umx-acid)] opacity-75"></span>
2138:                   <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--umx-acid)]"></span>
2139:                 </span>
2140:               ) : (
2141:                 <span className="inline-flex rounded-full h-2 w-2 bg-neutral-600"></span>
2142:               )}
2143:             </div>
2144:             <div className="flex items-baseline gap-2 mt-3">
2145:               <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
2146:                 {isOnline ? "ONLINE" : "OFFLINE"}
2147:               </h3>
2148:             </div>
2149:             <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
2150:               {isOnline ? `心跳正常 · 最后活动: ${formatTime(status?.last_heartbeat || "")}` : "未检测到本地 RPA 进程心跳"}
2151:             </p>
2152:           </div>
2153:           
2154:           <div className="mt-4 pt-3 border-t border-[var(--umx-line)]/50">
2155:             {isOnline ? (
2156:               <span className="block font-mono text-[8px] text-[var(--umx-acid)] uppercase text-center bg-[var(--umx-acid)]/5 border border-[var(--umx-acid)]/20 py-1.5" style={{ borderRadius: "2px" }}>
2157:                 ✓ LOCAL DAEMON ACTIVE
2158:               </span>
2159:             ) : (
2160:               <span className="block font-mono text-[8px] text-[var(--umx-text-dim)] uppercase text-center bg-white/5 border border-white/10 py-1.5" style={{ borderRadius: "2px" }} title="请在本地终端运行 python wechat_rpa_v4.py 启动进程">
2161:                 💡 RUN `python wechat_rpa_v4.py` ON HOST
2162:               </span>
2163:             )}
2164:           </div>
2165:         </div>
2166: 
2167:         {/* Bound Account Card */}
2168:         <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
2169:           <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">WeChat Client Nickname</span>
2170:           <div className="flex items-baseline gap-2 mt-3">
2171:             <h3 className="font-display text-xl font-bold tracking-wide truncate max-w-full text-white">
2172:               {isOnline && status?.wechat_nickname ? status.wechat_nickname : "未绑定"}
2173:             </h3>
2174:           </div>
2175:           <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-3">
2176:             {isOnline ? "成功挂载 PC 微信 GUI 窗口" : "进程未启动或窗口丢失"}
2177:           </p>
2178:         </div>
2179: 
2180:         {/* AI Workers Card */}
2181:         <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
2182:           <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">AI Workers (Thread Pool)</span>
2183:           <div className="flex items-baseline gap-2 mt-3">
2184:             <h3 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
2185:               {isOnline ? `${status?.active_workers} / 5` : "0 / 0"}
2186:             </h3>
2187:           </div>
2188:           <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
2189:             {isOnline && status?.active_workers && status.active_workers > 0 ? "大模型正在深度思考中" : "线程空闲 · 等待新消息"}
2190:           </p>
2191:         </div>
2192: 
2193:         {/* Auto Reply Mode Card */}
2194:         <div className="border border-[var(--umx-line)] p-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
2195:           <div className="flex items-center justify-between mb-1">
2196:             <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--umx-text-dim)]">Auto Reply Toggle</span>
2197:             <button
2198:               onClick={handleToggleBot}
2199:               disabled={savingSettings}
2200:               className={`font-mono text-[9px] px-2 py-0.5 border ${
2201:                 isBotActive 
2202:                   ? "border-[var(--umx-acid)] text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" 
2203:                   : "border-[var(--umx-line)] text-[var(--umx-text-dim)]"
2204:               } transition-all uppercase`}
2205:               style={{ borderRadius: "2px" }}
2206:             >
2207:               {savingSettings ? "SAVING..." : isBotActive ? "ACTIVE" : "PAUSED"}
2208:             </button>
2209:           </div>
2210:           <div className="flex items-baseline gap-2 mt-3">
2211:             <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
2212:               {isBotActive ? "智能自动回复中" : "已暂停托管"}
2213:             </h3>
2214:           </div>
2215:           <p className="font-mono text-[9px] text-[var(--umx-text-dim)] mt-2">
2216:             {isBotActive ? "实时匹配监听白名单" : "微信好友消息将不受机器干扰"}
2217:           </p>
2218:         </div>
2219:       </div>
2220: 
2221:       {/* 2. Middle Section: Whitelist Control & Log Console */}
2222:       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
2223:         {/* Whitelist Manager */}
2224:         <div className="lg:col-span-1 border border-[var(--umx-line)] p-6 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
2225:           <div>
2226:             <div className="flex items-center gap-2 mb-4 border-b border-[var(--umx-line)] pb-3">
2227:               <MessageSquare className="size-4 text-[var(--umx-acid)]" />
2228:               <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">监听聊天名单 (Whitelist)</h3>
2229:             </div>
2230:             
2231:             <p className="font-mono text-[10px] text-[var(--umx-text-dim)] mb-4 leading-relaxed">
2232:               微信 RPA 仅会针对以下白名单中的群聊全称或好友备注名进行回复。如果列表为空，微信 RPA 进程将运行在<strong>全局智能回复监听模式</strong>（⚠️ 回复所有人！）。
2233:             </p>
2234: 
2235:             <div className="flex flex-wrap gap-2 mb-4 max-h-[220px] overflow-y-auto pr-1">
2236:               {listenChatsList.length === 0 ? (
2237:                 <span className="font-mono text-[9px] uppercase tracking-wider border border-[var(--umx-acid)]/30 text-[var(--umx-acid)] px-2.5 py-1" style={{ background: "rgba(218,252,8,0.02)", borderRadius: "2px" }}>
2238:                   🌐 GLOBAL MODE — 全局监听回复
2239:                 </span>
2240:               ) : (
2241:                 listenChatsList.map(chat => (
2242:                   <span 
2243:                     key={chat} 
2244:                     className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-white border border-[var(--umx-line)] bg-white/5"
2245:                     style={{ borderRadius: "2px" }}
2246:                   >
2247:                     {chat}
2248:                     <button 
2249:                       onClick={() => handleRemoveChat(chat)}
2250:                       disabled={savingSettings}
2251:                       className="text-[var(--umx-text-dim)] hover:text-[#ff6b6b] transition-colors"
2252:                     >
2253:                       <X className="size-3" />
2254:                     </button>
2255:                   </span>
2256:                 ))
2257:               )}
2258:             </div>
2259:           </div>
2260: 
2261:           <div className="mt-4 pt-4 border-t border-[var(--umx-line)]">
2262:             <div className="flex gap-2">
2263:               <input
2264:                 type="text"
2265:                 value={newChatName}
2266:                 onChange={e => setNewChatName(e.target.value)}
2267:                 onKeyDown={e => e.key === "Enter" && handleAddChat()}
2268:                 placeholder="添加群聊全称或好友备注..."
2269:                 disabled={savingSettings}
2270:                 className="flex-1 bg-black/40 border border-[var(--umx-line)] px-3 py-2 font-mono text-[11px] text-white focus:border-white focus:outline-none placeholder:text-[var(--umx-text-dim)]"
2271:                 style={{ borderRadius: "2px" }}
2272:               />
2273:               <button
2274:                 onClick={handleAddChat}
2275:                 disabled={savingSettings || !newChatName.trim()}
2276:                 className="flex items-center justify-center border border-[var(--umx-acid)] hover:bg-[var(--umx-acid)] hover:text-black text-[var(--umx-acid)] px-4 py-2 font-mono text-[10px] tracking-wider uppercase font-bold transition-all disabled:opacity-30"
2277:                 style={{ borderRadius: "2px" }}
2278:               >
2279:                 添加
2280:               </button>
2281:             </div>
2282:           </div>
2283:         </div>
2284: 
2285:         {/* Terminal/Log Console */}
2286:         <div className="lg:col-span-2 border border-[var(--umx-line)] p-6" style={{ background: "rgba(255,255,255,0.01)" }}>
2287:           <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
2288:             <div className="flex items-center gap-2">
2289:               <Terminal className="size-4 text-[var(--umx-acid)] animate-pulse" />
2290:               <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">本地 RPA 进程控制台日志 (Live Logs)</h3>
2291:             </div>
2292:             <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase tracking-wider">
2293:               {isOnline ? "🔴 心跳同步中 · 4s 轮询" : "⏳ 进程已离线"}
2294:             </span>
2295:           </div>
2296: 
2297:           {/* Console Box */}
2298:           <div className="bg-black/90 border border-[var(--umx-line)] p-4 font-mono text-[10px] text-[var(--umx-silver)] h-[290px] overflow-y-auto space-y-1.5 select-text selection:bg-[var(--umx-acid)] selection:text-black">
2299:             {(!status?.system_logs || status.system_logs.length === 0) ? (
2300:               <div className="flex items-center justify-center h-full text-[var(--umx-text-dim)] uppercase tracking-wider">
2301:                 WAITING FOR LIVE TELEMETRY LOGS STREAM...
2302:               </div>
2303:             ) : (
2304:               status.system_logs.map((log, i) => {
2305:                 let colorClass = "text-[var(--umx-silver)]";
2306:                 if (log.includes("[ERROR]")) colorClass = "text-[#ff6b6b]";
2307:                 else if (log.includes("[WARNING]")) colorClass = "text-yellow-400";
2308:                 else if (log.includes("[思考开始]") || log.includes("触发AI思考")) colorClass = "text-cyan-400";
2309:                 else if (log.includes("[思考完成]") || log.includes("成功送达")) colorClass = "text-[var(--umx-acid)]";
2310:                 
2311:                 return (
2312:                   <div key={i} className={`leading-relaxed break-all ${colorClass}`}>
2313:                     {log}
2314:                   </div>
2315:                 );
2316:               })
2317:             )}
2318:           </div>
2319:         </div>
2320:       </div>
2321: 
2322:       {/* 3. History Feed Table */}
2323:       <div className="border border-[var(--umx-line)] p-6" style={{ background: "rgba(255,255,255,0.01)" }}>
2324:         <div className="flex items-center justify-between mb-4 border-b border-[var(--umx-line)] pb-3">
2325:           <div className="flex items-center gap-2">
2326:             <Clock className="size-4 text-[var(--umx-acid)]" />
2327:             <h3 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-white">自动回复历史日志 (Auto-Reply History)</h3>
2328:           </div>
2329:           <span className="font-mono text-[9px] text-[var(--umx-text-dim)] uppercase">
2330:             最近 50 条匹配记录
2331:           </span>
2332:         </div>
2333: 
2334:         <div className="overflow-x-auto">
2335:           {history.length === 0 ? (
2336:             <div className="flex flex-col items-center justify-center py-16 text-center">
2337:               <MessageSquare className="mb-3 size-8 text-[var(--umx-text-dim)]" />
2338:               <p className="font-mono text-[11px] text-[var(--umx-text-dim)]">
2339:                 暂无自动回复历史记录
2340:               </p>
2341:             </div>
2342:           ) : (
2343:             <table className="w-full">
2344:               <thead>
2345:                 <tr className="border-b border-[var(--umx-line)] bg-white/[0.01] select-none">
2346:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[12%]">时间</th>
2347:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[15%]">会话窗口</th>
2348:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[10%]">发言人</th>
2349:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">收到的消息</th>
2350:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[25%]">AI 的自动回复</th>
2351:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[8%]">耗时</th>
2352:                   <th className="px-4 py-3 text-left font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--umx-text-dim)] w-[5%]">状态</th>
2353:                 </tr>
2354:               </thead>
2355:               <tbody className="divide-y divide-[var(--umx-line)]">
2356:                 {history.map((row) => (
2357:                   <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
2358:                     <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)]">
2359:                       {new Date(row.created_at).toLocaleString("zh-CN", { hour12: false })}
2360:                     </td>
2361:                     <td className="px-4 py-3.5 font-mono text-[11px] text-white font-bold truncate max-w-[120px]">
2362:                       {row.chat_name}
2363:                     </td>
2364:                     <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-silver)] truncate max-w-[100px]">
2365:                       {row.sender}
2366:                     </td>
2367:                     <td className="px-4 py-3.5 font-mono text-[10px] text-[var(--umx-text-dim)] max-w-[200px] truncate" title={row.message}>
2368:                       {row.message}
2369:                     </td>
2370:                     <td className="px-4 py-3.5 font-mono text-[10px] text-white max-w-[200px] truncate" title={row.response}>
2371:                       {row.response}
2372:                     </td>
2373:                     <td className="px-4 py-3.5 font-mono text-[10px]">
2374:                       <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[var(--umx-line)] text-[var(--umx-silver)]" style={{ borderRadius: "2px" }}>
2375:                         <Timer className="size-2.5" />
2376:                         {formatElapsed(row.elapsed_time)}
2377:                       </span>
2378:                     </td>
2379:                     <td className="px-4 py-3.5">
2380:                       {row.status === "success" ? (
2381:                         <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-[var(--umx-acid)]/30 text-[var(--umx-acid)] bg-[var(--umx-acid)]/10" style={{ borderRadius: "2px" }}>
2382:                           SUCCESS
2383:                         </span>
2384:                       ) : (
2385:                         <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] border border-red-500/30 text-[#ff6b6b] bg-red-500/10" style={{ borderRadius: "2px" }}>
2386:                           ERROR
2387:                         </span>
2388:                       )}
2389:                     </td>
2390:                   </tr>
2391:                 ))}
2392:               </tbody>
2393:             </table>
2394:           )}
2395:         </div>
2396:       </div>
2397:     </div>
2398:   );
2399: }
2400: 
2401: interface WeChatStatusRow {
2402:   client_status: string;
2403:   last_heartbeat: string | null;
2404:   wechat_nickname: string;
2405:   active_workers: number;
2406:   system_logs: string[];
2407:   updated_at: string;
2408: }
2409: 
2410: interface WeChatSettingsRow {
2411:   listen_chats: string;
2412:   is_active: boolean;
2413: }
2414: 
2415: interface WeChatHistoryRow {
2416:   id: string;
2417:   chat_name: string;
2418:   sender: string;
2419:   message: string;
2420:   response: string;
2421:   status: string;
2422:   elapsed_time: number;
2423:   created_at: string;
2424: }
2425: 
2426: /* ── Gate ───────────────────────────────────────────────────────── */
2427: 
2428: function AdminGate() {
2429:   const { session, user, loading } = useAuth();
2430:   if (loading) return <UmxLoadingScreen />;
2431:   if (!session) return <LoginPage />;
2432:   if (!user?.email || !ADMIN_EMAILS.includes(user.email)) return <ForbiddenScreen />;
2433:   return <AdminContent />;
2434: }
2435: 
2436: export default function AdminPage() {
2437:   return (
2438:     <React.Suspense fallback={<UmxLoadingScreen />}>
2439:       <AuthProvider>
2440:         <AdminGate />
2441:       </AuthProvider>
2442:     </React.Suspense>
2443:   );
2444: }
2445: 
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
