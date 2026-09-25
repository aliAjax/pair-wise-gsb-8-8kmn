// 数据层：战役数据的种子、读写与旧存档迁移。不做任何判定，判定在 logic/clues.js。
export const STORAGE_KEY = 'campaign-log';

export const seed = {
  name: '暮光边境',
  system: 'D&D 5E',
  sessions: [
    { id: 1, date: '2024-06-08', title: '第一章：灰港的钟声', summary: '队伍抵达灰港，在失落的钟楼发现了神秘符文。', tag: '主线', color: '#d8a153' },
    { id: 2, date: '2024-06-15', title: '第二章：雾中来客', summary: '与流浪法师伊琳结盟，追踪海雾中的脚印。', tag: '主线', color: '#93b7a6' },
    { id: 3, date: '2024-06-22', title: '支线：深林采药', summary: '帮助村民寻找月光草，获得一枚古老铜币。', tag: '支线', color: '#b9a6d1' },
  ],
  characters: [
    { name: '艾德里安', role: '圣骑士', player: '林默', color: '#d8a153' },
    { name: '瑟琳', role: '游侠', player: '安然', color: '#93b7a6' },
    { name: '莫尔', role: '术士', player: '周岳', color: '#b9a6d1' },
  ],
  // 线索账流水：只增不改。章节账 kind:'chapter'，翻案账 kind:'reversal'
  clueEntries: [
    { id: 'e1', kind: 'chapter', chapterId: 1,
      present: ['艾德里安', '瑟琳', '莫尔'],
      introduced: [
        { id: 'c1', text: '钟楼夜半钟声的来源', characters: ['艾德里安', '瑟琳'] },
        { id: 'c4', text: '为钟楼符文找一位鉴定人', characters: ['艾德里安'] },
      ],
      pursued: [], resolvedId: null },
    { id: 'e2', kind: 'chapter', chapterId: 2,
      present: ['艾德里安', '瑟琳', '莫尔', '伊琳'],
      introduced: [{ id: 'c2', text: '替伊琳找回《雾海手记》', characters: ['伊琳'] }],
      pursued: ['c1'], resolvedId: 'c4' },
    { id: 'e3', kind: 'chapter', chapterId: 3,
      present: ['艾德里安', '莫尔'],
      introduced: [{ id: 'c3', text: '古老铜币上的纹章出自哪个家族', characters: ['莫尔'] }],
      pursued: [], resolvedId: null },
  ],
};

// 旧存档兼容：只补齐缺失的账本字段，已有章节、摘要等一律原样保留
export function migrate(data) {
  const base = JSON.parse(JSON.stringify(seed));
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    sessions: Array.isArray(data.sessions) ? data.sessions : base.sessions,
    characters: Array.isArray(data.characters) ? data.characters : base.characters,
    clueEntries: Array.isArray(data.clueEntries) ? data.clueEntries : [],
  };
}

export function load() {
  try {
    return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return migrate(null);
  }
}

export function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
