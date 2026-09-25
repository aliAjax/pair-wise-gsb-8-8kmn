import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import {
  seedThreads, normalizeData, isOpen, openThreads, resolvedThreads,
  threadById, chapterLabel, applyChapterPlan, reopenThread,
} from './threads.js';
import { validateChapterPlan } from './threadRules.js';

const seed = {
  name: '暮光边境',
  system: 'D&D 5E',
  sessions: [
    { id: 1, date: '2024-06-08', title: '第一章：灰港的钟声', summary: '队伍抵达灰港，在失落的钟楼发现了神秘符文。', tag: '主线', color: '#d8a153', attendees: ['艾德里安', '瑟琳', '莫尔'] },
    { id: 2, date: '2024-06-15', title: '第二章：雾中来客', summary: '与流浪法师伊琳结盟，追踪海雾中的脚印。', tag: '主线', color: '#93b7a6', attendees: ['艾德里安', '瑟琳', '莫尔'] },
    { id: 3, date: '2024-06-22', title: '支线：深林采药', summary: '帮助村民寻找月光草，获得一枚古老铜币。', tag: '支线', color: '#b9a6d1', attendees: ['艾德里安', '瑟琳', '莫尔'] },
  ],
  characters: [
    { name: '艾德里安', role: '圣骑士', player: '林默', color: '#d8a153' },
    { name: '瑟琳', role: '游侠', player: '安然', color: '#93b7a6' },
    { name: '莫尔', role: '术士', player: '周岳', color: '#b9a6d1' },
  ],
  threads: seedThreads,
};

const read = () => {
  try {
    return normalizeData(JSON.parse(localStorage.getItem('campaign-log')) || seed);
  } catch {
    return normalizeData(seed);
  }
};

const TABS = [
  ['timeline', '◌', '时间线'],
  ['threads', '✧', '线索账'],
  ['characters', '♙', '角色与阵营'],
  ['places', '⌖', '地点图鉴'],
  ['loot', '◇', '战利品'],
];
const TITLES = { timeline: '战役时间线', threads: '剧情线索账', characters: '角色与阵营', places: '地点图鉴', loot: '战利品' };

const toggleIn = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

function App() {
  const [data, setData] = useState(read);
  const [tab, setTab] = useState('timeline');
  const [active, setActive] = useState(1);
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState([]);
  const [reopen, setReopen] = useState(null); // { threadId, sessionId, reason }
  const blankForm = () => ({
    title: '', date: '2024-07-01', summary: '', tag: '主线',
    attendees: data.characters.map(c => c.name),
    newThreads: [], followIds: [], resolveId: '', resolveNote: '',
  });
  const [form, setForm] = useState(blankForm);

  useEffect(() => localStorage.setItem('campaign-log', JSON.stringify(data)), [data]);

  const cur = data.sessions.find(x => x.id === active) || data.sessions[0];
  const open = openThreads(data);
  const done = resolvedThreads(data);

  const add = () => {
    if (!form.title) return;
    const session = {
      id: Date.now(), title: form.title, date: form.date, summary: form.summary,
      tag: form.tag, color: '#d8a153', attendees: form.attendees,
    };
    const plan = {
      newThreads: form.newThreads, followIds: form.followIds,
      resolveId: form.resolveId, resolveNote: form.resolveNote, attendees: form.attendees,
    };
    const nextSessions = [...data.sessions, session];
    const check = validateChapterPlan({ ...data, sessions: nextSessions }, session.id, plan);
    if (!check.ok) { setErrors(check.errors); return; }
    setData({ ...data, sessions: nextSessions, threads: applyChapterPlan(data, session, plan) });
    setActive(session.id);
    setForm(blankForm());
    setErrors([]);
    setShow(false);
    setNotice('新章节已加入时间线，线索账已更新');
  };

  const confirmReopen = () => {
    if (!reopen.reason.trim()) { setNotice('翻案要写原因'); return; }
    setData({ ...data, threads: reopenThread(data, reopen.threadId, reopen.sessionId, reopen.reason.trim()) });
    setReopen(null);
    setNotice('已翻案，线索回到待接清单');
  };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'campaign.json';
    a.click();
    setNotice('战役记录已导出');
  };

  // 当前章节的线索账目（详情面板用）
  const introduced = data.threads.filter(t => t.introducedIn === cur?.id);
  const followed = data.threads.filter(t => (t.follows || []).includes(cur?.id));
  const resolvedHere = data.threads.filter(t => t.resolvedIn === cur?.id);
  const reopenedHere = data.threads.filter(t => (t.reopened || []).some(r => r.sessionId === cur?.id));

  const threadCard = t => (
    <article className={'thread-card ' + (isOpen(t) ? 'open' : 'done')} key={t.id}>
      <div className="thread-meta">
        <span className={'pill ' + (isOpen(t) ? 'open' : 'done')}>{isOpen(t) ? '待接' : '已结清'}</span>
        <span>抛出于{chapterLabel(data, t.introducedIn)}</span>
        {(t.follows || []).length > 0 && <span>追过 {t.follows.length} 次：{t.follows.map(id => chapterLabel(data, id)).join('、')}</span>}
        {(t.related || []).length > 0 && <span>相关：{t.related.join('、')}</span>}
      </div>
      <h3>{t.title}</h3>
      {t.note && <p>{t.note}</p>}
      {t.resolvedIn && (
        <p className="resolution">
          结清于{chapterLabel(data, t.resolvedIn)}：{t.resolution}{isOpen(t) && '（后被翻案，暂存待考）'}
        </p>
      )}
      {(t.reopened || []).map((r, i) => (
        <div className="reopen-log" key={i}>翻案 · {chapterLabel(data, r.sessionId)}：{r.reason}</div>
      ))}
      {!isOpen(t) && (
        <button className="mini" onClick={() => setReopen({ threadId: t.id, sessionId: data.sessions[data.sessions.length - 1].id, reason: '' })}>↩ 翻案</button>
      )}
    </article>
  );

  return (
    <div className="shell">
      <aside>
        <div className="logo"><span>✦</span> CAMPAIGNER</div>
        <div className="campaign"><small>当前战役</small><strong>{data.name}</strong><span>{data.system} · 2024</span></div>
        <nav>
          {TABS.map(([id, i, t]) => (
            <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}><i>{i}</i>{t}</button>
          ))}
        </nav>
        <div className="side-bottom"><button>⚙ 偏好设置</button><small>本地存储已开启</small></div>
      </aside>
      <main>
        <header>
          <div>
            <span className="crumb">MY CAMPAIGN / {data.system}</span>
            <h1>{TITLES[tab]}</h1>
          </div>
          <div className="actions">
            <button onClick={exportData} className="outline">↓ 导出</button>
            <button onClick={() => setShow(true)} className="primary">＋ 新建章节</button>
          </div>
        </header>

        {tab === 'timeline' && (
          <div className="timeline-layout">
            <section className="timeline">
              <div className="timeline-intro">
                <div><span>THE CHRONICLE</span><h2>记录每一次冒险</h2></div>
                <span className="count">{data.sessions.length} CHAPTERS</span>
              </div>
              {data.sessions.map((s, i) => (
                <button className={'chapter ' + (active === s.id ? 'selected' : '')} onClick={() => setActive(s.id)} key={s.id}>
                  <div className="date">
                    <b>{new Date(s.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</b>
                    <small>{new Date(s.date).getFullYear()}</small>
                  </div>
                  <div className="line"><span style={{ background: s.color }}></span>{i < data.sessions.length - 1 && <i />}</div>
                  <div className="chapter-copy">
                    <div className="tag">{s.tag}</div>
                    <h3>{s.title}</h3>
                    <p>{s.summary}</p>
                  </div>
                  <span className="arrow">↗</span>
                </button>
              ))}
            </section>
            <section className="detail-panel">
              <div className="detail-cover" style={{ background: cur?.color }}>
                <span>CHAPTER {String(data.sessions.findIndex(x => x.id === active) + 1).padStart(2, '0')}</span><i>✦</i>
              </div>
              <div className="detail-body">
                <span className="tag">{cur?.tag}</span>
                <h2>{cur?.title}</h2>
                <p>{cur?.summary}</p>
                <div className="meta-grid">
                  <div><small>游戏日期</small><strong>{cur?.date}</strong></div>
                  <div><small>参与者</small><strong>{(cur?.attendees || data.characters.map(c => c.name)).join('、')}</strong></div>
                </div>
                <div className="detail-threads">
                  <h4>本章线索</h4>
                  {introduced.length + followed.length + resolvedHere.length + reopenedHere.length === 0 && (
                    <p className="dim">本章还没有记线索，新建章节时可以补。</p>
                  )}
                  {introduced.map(t => <div className="tline" key={'n' + t.id}><span className="pill open">新抛出</span>{t.title}</div>)}
                  {followed.map(t => <div className="tline" key={'f' + t.id}><span className="pill">继续追</span>{t.title}</div>)}
                  {resolvedHere.map(t => <div className="tline" key={'r' + t.id}><span className="pill done">结清</span>{t.title}：{t.resolution}</div>)}
                  {reopenedHere.map(t => <div className="tline" key={'o' + t.id}><span className="pill">翻案</span>{t.title}</div>)}
                </div>
                <div className="note">
                  <span>✎</span>
                  <div><strong>笔记</strong><p>点击编辑这一章节的剧情细节、重要决定和未解线索。</p></div>
                  <button onClick={() => setNotice('笔记编辑已开启')}>编辑</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'threads' && (
          <section className="ledger">
            <div className="timeline-intro">
              <div><span>OPEN THREADS</span><h2>待接清单</h2></div>
              <span className="count">{open.length} OPEN</span>
            </div>
            {open.length === 0 && <p className="dim">没有待接的线索，都结清了。</p>}
            <div className="thread-list">{open.map(threadCard)}</div>
            <div className="timeline-intro">
              <div><span>RESOLVED</span><h2>已结清</h2></div>
              <span className="count">{done.length} CLOSED</span>
            </div>
            {done.length === 0 && <p className="dim">还没有结清的线索。</p>}
            <div className="thread-list">{done.map(threadCard)}</div>
          </section>
        )}

        {tab === 'characters' && (
          <section className="cards">
            <div className="section-note">队伍中有 {data.characters.length} 位冒险者，点击卡片查看角色档案。</div>
            {data.characters.map(c => (
              <article className="char-card" key={c.name}>
                <div className="avatar" style={{ background: c.color }}>{c.name[0]}</div>
                <div><small>{c.role}</small><h3>{c.name}</h3><p>玩家 · {c.player}</p></div>
                <button onClick={() => setNotice(`${c.name} 的角色档案`)}>↗</button>
              </article>
            ))}
          </section>
        )}

        {tab === 'places' && (
          <section className="empty">
            <div>⌖</div>
            <h2>地点图鉴</h2>
            <p>从章节笔记中收集地点。当前已记录灰港、雾林和失落钟楼。</p>
            <div className="place-list">
              <span>01　灰港 <b>已探索</b></span>
              <span>02　失落钟楼 <b>已探索</b></span>
              <span>03　雾林 <b>待探索</b></span>
            </div>
          </section>
        )}

        {tab === 'loot' && (
          <section className="empty">
            <div>◇</div>
            <h2>战利品清单</h2>
            <p>追踪旅途中获得的装备、遗物和金币。</p>
            <div className="place-list">
              <span>月光草 × 3 <b>消耗品</b></span>
              <span>古老铜币 × 1 <b>遗物</b></span>
              <span>灰港守卫徽章 × 2 <b>任务物品</b></span>
            </div>
          </section>
        )}
      </main>

      {show && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => { setShow(false); setErrors([]); }}>×</button>
            <span className="crumb">NEW CHAPTER</span>
            <h2>记录新的章节</h2>
            <label>章节标题<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例：第三章：月下集市" /></label>
            <label>游戏日期<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label>章节摘要<textarea rows="3" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="发生了什么？" /></label>
            <label>章节类型
              <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}>
                <option>主线</option><option>支线</option><option>番外</option>
              </select>
            </label>
            <div className="mfield">出场角色（相关角色不在场的线索不能结）
              <div className="check-list">
                {data.characters.map(c => (
                  <label key={c.name}>
                    <input type="checkbox" checked={form.attendees.includes(c.name)} onChange={() => setForm({ ...form, attendees: toggleIn(form.attendees, c.name) })} />
                    {c.name}<small>{c.role}</small>
                  </label>
                ))}
              </div>
            </div>
            <div className="mfield">本章新抛出的线索
              <div className="thread-rows">
                {form.newThreads.map((n, i) => (
                  <div className="thread-row" key={i}>
                    <div className="thread-row-head">
                      <input value={n.title} placeholder="线索名，例：钟声来源" onChange={e => setForm({ ...form, newThreads: form.newThreads.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                      <button className="mini" onClick={() => setForm({ ...form, newThreads: form.newThreads.filter((_, j) => j !== i) })}>×</button>
                    </div>
                    <input value={n.note} placeholder="补一句细节（可空）" onChange={e => setForm({ ...form, newThreads: form.newThreads.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                  </div>
                ))}
              </div>
              <button className="add-row" onClick={() => setForm({ ...form, newThreads: [...form.newThreads, { title: '', note: '' }] })}>＋ 加一条线索</button>
            </div>
            <div className="mfield">这次继续追的线索（来自更早章的待接清单）
              {open.length === 0 && <p className="dim">目前没有待接的线索。</p>}
              {open.length > 0 && (
                <div className="check-list">
                  {open.map(t => (
                    <label key={t.id}>
                      <input type="checkbox" checked={form.followIds.includes(t.id)} onChange={() => setForm({ ...form, followIds: toggleIn(form.followIds, t.id) })} />
                      {t.title}<small>抛出于{chapterLabel(data, t.introducedIn)}</small>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label>这次结清的线索
              <select value={form.resolveId} onChange={e => setForm({ ...form, resolveId: e.target.value })}>
                <option value="">本章不结线索</option>
                {open.map(t => {
                  const missing = (t.related || []).filter(r => !form.attendees.includes(r));
                  return (
                    <option key={t.id} value={t.id} disabled={missing.length > 0}>
                      {t.title}{missing.length > 0 ? `（${missing.join('、')}不在场）` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            {form.resolveId && (
              <label>结清结果<textarea rows="2" value={form.resolveNote} onChange={e => setForm({ ...form, resolveNote: e.target.value })} placeholder="这条线索怎么了结？下回开团要对得上。" /></label>
            )}
            {errors.length > 0 && <div className="errors">{errors.map(e => <span key={e}>• {e}</span>)}</div>}
            <button className="primary full" onClick={add}>保存章节</button>
          </div>
        </div>
      )}

      {reopen && (
        <div className="modal-bg">
          <div className="modal">
            <button className="close" onClick={() => setReopen(null)}>×</button>
            <span className="crumb">REOPEN</span>
            <h2>翻案：{threadById(data, reopen.threadId)?.title}</h2>
            <label>记在哪一章
              <select value={reopen.sessionId} onChange={e => setReopen({ ...reopen, sessionId: Number(e.target.value) })}>
                {data.sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label>翻案原因<textarea rows="3" value={reopen.reason} onChange={e => setReopen({ ...reopen, reason: e.target.value })} placeholder="为什么推翻之前的结论？" /></label>
            <button className="primary full" onClick={confirmReopen}>另起一条翻案记录</button>
          </div>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
