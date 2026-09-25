// 剧情线索账 · 判定层
// 输入一章的线索计划，返回能不能记、错在哪。不读页面、不写存储。

import { isOpen, sessionById, sessionIndex, threadById } from './threads.js';

// plan = { newThreads: [{title, note}], followIds: [], resolveId, resolveNote, attendees: [] }
// 返回 { ok, errors }
export function validateChapterPlan(data, sessionId, plan) {
  const errors = [];
  const session = sessionById(data, sessionId);
  if (!session) return { ok: false, errors: ['找不到这一章，无法记线索'] };
  const idx = sessionIndex(data, sessionId);
  const attendees = plan.attendees ?? session.attendees ?? data.characters.map(c => c.name);

  // 继续追：只能选更早章抛出的未结线索
  for (const id of plan.followIds || []) {
    const t = threadById(data, id);
    if (!t) { errors.push('要继续追的线索不存在'); continue; }
    if (!isOpen(t)) errors.push(`「${t.title}」已结清，不能再追；要推翻结论请在线索账里翻案`);
    else if (sessionIndex(data, t.introducedIn) >= idx) errors.push(`「${t.title}」不是更早章抛出的，本章不能记成继续追`);
  }

  // 结清：只能结更早章抛出的；相关角色不在场不能结；要写结果
  if (plan.resolveId) {
    const t = threadById(data, plan.resolveId);
    if (!t) errors.push('要结清的线索不存在');
    else {
      if (!isOpen(t)) errors.push(`「${t.title}」已经结清过了`);
      if (sessionIndex(data, t.introducedIn) >= idx) errors.push(`「${t.title}」是本章或更晚才抛出的，结线索只能选更早章抛出的`);
      const missing = (t.related || []).filter(name => !attendees.includes(name));
      if (missing.length) errors.push(`相关角色不在场（${missing.join('、')}），不能结「${t.title}」`);
      if (!plan.resolveNote || !plan.resolveNote.trim()) errors.push(`结清「${t.title}」要写一句结果，下回开团才对得上`);
    }
  }

  // 新抛线索：整行空白会被忽略，但写了细节没写线索名要拦下
  (plan.newThreads || []).forEach((n, i) => {
    if ((!n.title || !n.title.trim()) && n.note && n.note.trim()) {
      errors.push(`第 ${i + 1} 条新线索写了细节但没写线索名`);
    }
  });

  return { ok: errors.length === 0, errors };
}
