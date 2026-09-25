// 判定层：线索账的规则与派生状态。纯函数，不碰存储与界面。
// 账本是只增不改的流水：结清记一笔，翻案另起一笔并写原因，旧账不动。

export const chapterIndex = (sessions, chapterId) => sessions.findIndex(s => s.id === chapterId);

// 按章节先后（同章按记录先后）排列账目；章节已不存在的排到最后
export function sortEntries(entries, sessions) {
  return entries
    .map((e, i) => ({ e, i, k: chapterIndex(sessions, e.chapterId) }))
    .sort((a, b) => ((a.k < 0 ? Infinity : a.k) - (b.k < 0 ? Infinity : b.k)) || a.i - b.i)
    .map(x => x.e);
}

// 跑完给定账目后每条线索的状态：open（待接）/ resolved（已结清）
export function clueStates(entries, sessions) {
  const map = new Map();
  for (const e of sortEntries(entries, sessions)) {
    if (e.kind === 'reversal') {
      const st = map.get(e.clueId);
      if (st && st.status === 'resolved') {
        st.status = 'open';
        st.resolvedChapterId = null;
        st.reversals.push({ entryId: e.id, reason: e.reason, chapterId: e.chapterId });
      }
      continue;
    }
    for (const c of e.introduced || []) {
      map.set(c.id, { ...c, introducedChapterId: e.chapterId, status: 'open', resolvedChapterId: null, reversals: [] });
    }
    if (e.resolvedId) {
      const st = map.get(e.resolvedId);
      if (st && st.status === 'open') {
        st.status = 'resolved';
        st.resolvedChapterId = e.chapterId;
      }
    }
  }
  return [...map.values()];
}

// 某章开始之前的待接清单：继续追和结清都只能从这里选
export function pendingBefore(entries, sessions, chapterId) {
  const idx = chapterIndex(sessions, chapterId);
  if (idx < 0) return [];
  const prior = sortEntries(entries, sessions).filter(e => {
    const k = chapterIndex(sessions, e.chapterId);
    return k >= 0 && k < idx;
  });
  return clueStates(prior, sessions).filter(c => c.status === 'open');
}

const findClue = (entries, clueId) => {
  for (const e of entries) {
    for (const c of e.introduced || []) {
      if (c.id === clueId) return { ...c, chapterId: e.chapterId };
    }
  }
  return null;
};

// 校验一条章节账目，返回问题清单（空数组 = 可以入账）
export function validateChapterEntry(entry, entries, sessions) {
  const errors = [];
  const idx = chapterIndex(sessions, entry.chapterId);
  if (idx < 0) errors.push('请选择要记账的章节');
  if (!entry.introduced.length && !entry.pursued.length && !entry.resolvedId) {
    errors.push('这一章没有记任何线索动向：新抛出、继续追或结清至少一项');
  }
  if (idx >= 0) {
    const pending = pendingBefore(entries, sessions, entry.chapterId);
    const pendingIds = new Set(pending.map(c => c.id));
    if (entry.pursued.some(id => !pendingIds.has(id))) {
      errors.push('继续追的线索必须来自本章之前仍未结的待接清单');
    }
    if (entry.resolvedId) {
      const clue = findClue(entries, entry.resolvedId);
      if (!clue) {
        errors.push('要结清的线索不存在');
      } else if (chapterIndex(sessions, clue.chapterId) >= idx) {
        errors.push('结清的线索必须抛出自更早的章节');
      } else if (!pendingIds.has(entry.resolvedId)) {
        errors.push('该线索此前已结清，不在待接清单中');
      } else {
        const missing = clue.characters.filter(n => !entry.present.includes(n));
        if (missing.length) errors.push(`相关角色不在场，不能结清：${missing.join('、')}`);
      }
    }
  }
  return errors;
}

// 翻案：只能针对当前已结清的线索，且必须写明原因
export function validateReversal(clueId, reason, entries, sessions) {
  const errors = [];
  if (!reason || !reason.trim()) errors.push('翻案需要写明原因');
  const st = clueStates(entries, sessions).find(c => c.id === clueId);
  if (!st) errors.push('要翻案的线索不存在');
  else if (st.status !== 'resolved') errors.push('只有已结清的线索才能翻案');
  return errors;
}

let seq = 0;
const uid = p => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function makeChapterEntry({ chapterId, present, introduced, pursued, resolvedId }) {
  return {
    id: uid('e'),
    kind: 'chapter',
    chapterId,
    present: [...new Set(present)],
    introduced: introduced
      .filter(c => c.text && c.text.trim())
      .map(c => ({ id: uid('c'), text: c.text.trim(), characters: [...new Set(c.characters || [])] })),
    pursued: [...pursued],
    resolvedId: resolvedId || null,
  };
}

export function makeReversal({ clueId, reason, chapterId }) {
  return { id: uid('e'), kind: 'reversal', clueId, reason: reason.trim(), chapterId };
}
