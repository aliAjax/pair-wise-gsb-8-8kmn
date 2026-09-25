// 剧情线索账 · 数据层
// 只负责线索数据的形状、默认值、读写迁移，不做判定、不碰页面。
//
// 线索结构：
// { id, title, note,
//   introducedIn: sessionId,        // 哪一章抛出的
//   status: 'open' | 'resolved',
//   follows: [sessionId],           // 哪些章继续追过它
//   resolvedIn, resolution,         // 结清于哪一章、结果如何（翻案后保留作历史）
//   reopened: [{ sessionId, reason }], // 翻案记录：另起一条，必须写原因
//   related: [角色名] }             // 相关角色，用于“不在场不能结”
//
// 章节上新增 attendees: [角色名]（出场角色）；旧章节没有就视为全员在场。

export const seedThreads = [
  { id: 't1', title: '钟声与钟楼符文', note: '失落钟楼里的神秘符文和夜半钟声，来源还没查清。', introducedIn: 1, status: 'open', follows: [], related: ['艾德里安', '莫尔'], reopened: [] },
  { id: 't2', title: '答应伊琳找的书', note: '流浪法师伊琳托付的那本法术书，队伍答应替她找回。', introducedIn: 2, status: 'open', follows: [], related: ['瑟琳'], reopened: [] },
  { id: 't3', title: '古老铜币的纹章', note: '深林采药换来的古老铜币，上面的纹章没人认得。', introducedIn: 3, status: 'open', follows: [], related: [], reopened: [] },
];

// 旧存档没有 threads 字段也能记线索：补登种子线索，对应章节已删的跳过。
export function normalizeData(raw) {
  const data = { ...raw };
  if (!Array.isArray(data.threads)) {
    data.threads = seedThreads
      .filter(t => (data.sessions || []).some(s => s.id === t.introducedIn))
      .map(t => ({ ...t }));
  }
  data.threads = data.threads.map(t => ({ follows: [], reopened: [], related: [], ...t }));
  return data;
}

export const isOpen = t => t.status !== 'resolved';
export const openThreads = data => data.threads.filter(isOpen);
export const resolvedThreads = data => data.threads.filter(t => !isOpen(t));

export const sessionById = (data, id) => data.sessions.find(s => s.id === id);
export const sessionIndex = (data, id) => data.sessions.findIndex(s => s.id === id);
export const threadById = (data, id) => data.threads.find(t => t.id === id);
export const chapterNo = (data, id) => sessionIndex(data, id) + 1;
export const chapterLabel = (data, id) => {
  const s = sessionById(data, id);
  return s ? `《${s.title}》` : '（已删除的章节）';
};

// 把一章的线索计划记到账上，返回新的线索数组（不改原数组）。
// plan = { newThreads: [{title, note}], followIds: [], resolveId, resolveNote }
export function applyChapterPlan(data, session, plan) {
  const kept = data.threads.map(t => {
    if (plan.resolveId && t.id === plan.resolveId) {
      return { ...t, status: 'resolved', resolvedIn: session.id, resolution: plan.resolveNote.trim() };
    }
    if ((plan.followIds || []).includes(t.id)) {
      return { ...t, follows: [...(t.follows || []), session.id] };
    }
    return t;
  });
  const fresh = (plan.newThreads || [])
    .filter(n => n.title && n.title.trim())
    .map((n, i) => ({
      id: `t${session.id}-${i}`,
      title: n.title.trim(),
      note: (n.note || '').trim(),
      introducedIn: session.id,
      status: 'open',
      follows: [],
      related: [],
      reopened: [],
    }));
  return [...kept, ...fresh];
}

// 翻案：不改原结清记录，另起一条翻案记录并写原因，线索回到待接清单。
export function reopenThread(data, threadId, sessionId, reason) {
  return data.threads.map(t => (t.id === threadId
    ? { ...t, status: 'open', reopened: [...(t.reopened || []), { sessionId, reason }] }
    : t));
}
