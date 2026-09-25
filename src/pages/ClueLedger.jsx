import React, { useMemo, useState } from 'react';
import {
  clueStates, makeChapterEntry, makeReversal, pendingBefore,
  sortEntries, validateChapterEntry, validateReversal,
} from '../logic/clues';

// 页面层：线索账。数据读写走 props，规则判定全部交给 logic/clues.js
const blankDraft = () => ({ chapterId: '', present: [], presentCustom: '', introduced: [], pursued: [], resolvedId: '' });
const blankRow = () => ({ text: '', characters: [], custom: '' });
const splitNames = s => s.split(/[,，、]/).map(x => x.trim()).filter(Boolean);
const toggle = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

export default function ClueLedger({ sessions, characters, entries = [], onChange, notify }) {
  const states = useMemo(() => clueStates(entries, sessions), [entries, sessions]);
  const byId = useMemo(() => new Map(states.map(c => [c.id, c])), [states]);
  const pending = states.filter(c => c.status === 'open');
  const resolvedList = states.filter(c => c.status === 'resolved');
  const stream = useMemo(() => sortEntries(entries, sessions), [entries, sessions]);
  const nameOptions = useMemo(() => {
    const s = new Set(characters.map(c => c.name));
    states.forEach(c => c.characters.forEach(n => s.add(n)));
    return [...s];
  }, [characters, states]);

  const [draft, setDraft] = useState(blankDraft);
  const [row, setRow] = useState(blankRow);
  const [errors, setErrors] = useState([]);
  const [rev, setRev] = useState({ clueId: null, reason: '', error: '' });

  const titleOf = id => (sessions.find(s => s.id === id) || {}).title || '（章节已不存在）';
  const opts = draft.chapterId === '' ? [] : pendingBefore(entries, sessions, draft.chapterId);
  const resolvedClue = draft.resolvedId ? byId.get(draft.resolvedId) : null;
  const presentNow = [...draft.present, ...splitNames(draft.presentCustom)];
  const missing = resolvedClue ? resolvedClue.characters.filter(n => !presentNow.includes(n)) : [];

  const addRow = () => {
    if (!row.text.trim()) return;
    const characters = [...new Set([...row.characters, ...splitNames(row.custom)])];
    setDraft({ ...draft, introduced: [...draft.introduced, { text: row.text.trim(), characters }] });
    setRow(blankRow());
  };

  const save = () => {
    const entry = makeChapterEntry({
      chapterId: draft.chapterId,
      present: presentNow,
      introduced: draft.introduced,
      pursued: draft.pursued,
      resolvedId: draft.resolvedId || null,
    });
    const errs = validateChapterEntry(entry, entries, sessions);
    setErrors(errs);
    if (errs.length) return;
    onChange([...entries, entry]);
    setDraft(blankDraft());
    setRow(blankRow());
    notify('章节线索已记入账本');
  };

  const confirmReversal = () => {
    const errs = validateReversal(rev.clueId, rev.reason, entries, sessions);
    if (errs.length) { setRev({ ...rev, error: errs[0] }); return; }
    // 翻案记在当前最新一章名下，原结清账不动
    const last = sessions[sessions.length - 1];
    onChange([...entries, makeReversal({ clueId: rev.clueId, reason: rev.reason, chapterId: last && last.id })]);
    setRev({ clueId: null, reason: '', error: '' });
    notify('已翻案：线索回到待接清单');
  };

  return <div className="ledger-layout">
    <section className="ledger-main">
      <div className="timeline-intro">
        <div><span>OPEN CLUES</span><h2>待接清单 · 下回开团从这里接</h2></div>
        <span className="count">{pending.length} OPEN</span>
      </div>
      <p className="ledger-note">每章记一笔：新抛出的线索、继续追的待接线索、这次结清的一条。结清只能选更早章抛出的，且相关角色要在场；翻案另起一条并写明原因，原账不动。</p>
      {pending.length === 0 && <div className="ledger-empty">没有待接的线索。在右侧为某一章记一笔，抛出新的线索。</div>}
      <div className="clue-grid">
        {pending.map(c => <article className="clue-card" key={c.id}>
          <div className="clue-meta">
            <span className="chip gold">待接</span>
            {c.reversals.length > 0 && <span className="chip">翻案重开 ×{c.reversals.length}</span>}
          </div>
          <h4>{c.text}</h4>
          <div className="clue-meta">
            {c.characters.map(n => <span className="chip" key={n}>{n}</span>)}
            <span className="clue-from">抛出于 {titleOf(c.introducedChapterId)}</span>
          </div>
        </article>)}
      </div>

      <div className="timeline-intro">
        <div><span>LEDGER</span><h2>账目流水</h2></div>
        <span className="count">{stream.length} ENTRIES</span>
      </div>
      <div className="stream">
        {stream.length === 0 && <div className="ledger-empty">账本还是空的。</div>}
        {stream.map(e => (e.kind === 'reversal' ? (
          <div className="stream-row reversal" key={e.id}>
            <span className="ic">↺</span>
            <div>
              <small>{titleOf(e.chapterId)} · 翻案</small>
              <p>「{(byId.get(e.clueId) || {}).text || '未知线索'}」重开 —— {e.reason}</p>
            </div>
          </div>
        ) : (
          <div className="stream-row" key={e.id}>
            <span className="ic">✦</span>
            <div>
              <small>{titleOf(e.chapterId)}</small>
              {(e.present || []).length > 0 && <p>在场　{e.present.join('、')}</p>}
              {(e.introduced || []).map(c => <p key={c.id}><b>新抛出</b>{c.text}{c.characters.length > 0 && <em>（{c.characters.join('、')}）</em>}</p>)}
              {(e.pursued || []).map(id => <p key={id}><b>继续追</b>{(byId.get(id) || {}).text || '未知线索'}</p>)}
              {e.resolvedId && <p><b>结清</b>{(byId.get(e.resolvedId) || {}).text || '未知线索'}</p>}
            </div>
          </div>
        )))}
      </div>
    </section>

    <section className="ledger-side">
      <div className="lform">
        <div><span className="crumb">NEW ENTRY</span><h3>为章节记一笔</h3></div>
        <label>章节
          <select value={draft.chapterId} onChange={e => setDraft({ ...draft, chapterId: e.target.value === '' ? '' : Number(e.target.value), pursued: [], resolvedId: '' })}>
            <option value="">选择章节…</option>
            {sessions.map(s => <option value={s.id} key={s.id}>{s.title}</option>)}
          </select>
        </label>
        <div className="lfield">
          <small>在场角色（相关角色不在场不能结清）</small>
          <div className="checkrow">{nameOptions.map(n => <button type="button" key={n} className={'checkchip' + (draft.present.includes(n) ? ' on' : '')} onClick={() => setDraft({ ...draft, present: toggle(draft.present, n) })}>{n}</button>)}</div>
          <input value={draft.presentCustom} onChange={e => setDraft({ ...draft, presentCustom: e.target.value })} placeholder="其他在场者，逗号分隔（可空）" />
        </div>
        <div className="lfield">
          <small>本章新抛出的线索</small>
          {draft.introduced.map((c, i) => <div className="added" key={i}>
            <span>{c.text}{c.characters.length > 0 && <em>（{c.characters.join('、')}）</em>}</span>
            <button type="button" onClick={() => setDraft({ ...draft, introduced: draft.introduced.filter((_, j) => j !== i) })}>×</button>
          </div>)}
          <input value={row.text} onChange={e => setRow({ ...row, text: e.target.value })} placeholder="线索内容，例：钟楼夜半钟声的来源" />
          <div className="checkrow">{nameOptions.map(n => <button type="button" key={n} className={'checkchip' + (row.characters.includes(n) ? ' on' : '')} onClick={() => setRow({ ...row, characters: toggle(row.characters, n) })}>{n}</button>)}</div>
          <input value={row.custom} onChange={e => setRow({ ...row, custom: e.target.value })} placeholder="相关角色，逗号分隔（可空）" />
          <button type="button" className="outline" onClick={addRow}>＋ 加入这条线索</button>
        </div>
        <div className="lfield">
          <small>继续追（本章之前的待接线索）</small>
          {draft.chapterId === '' && <p className="hint">先选择章节</p>}
          {draft.chapterId !== '' && opts.length === 0 && <p className="hint">这章之前没有待接的线索</p>}
          {opts.map(c => <label className="pickrow" key={c.id}>
            <input type="checkbox" checked={draft.pursued.includes(c.id)} onChange={() => setDraft({ ...draft, pursued: toggle(draft.pursued, c.id) })} />
            <span>{c.text}</span>
          </label>)}
        </div>
        <div className="lfield">
          <small>这次结清的一条（只能选更早章抛出的）</small>
          <select value={draft.resolvedId} onChange={e => setDraft({ ...draft, resolvedId: e.target.value })}>
            <option value="">本章不结清</option>
            {opts.map(c => <option value={c.id} key={c.id}>{c.text}</option>)}
          </select>
          {missing.length > 0 && <p className="warn">相关角色不在场：{missing.join('、')}，勾选在场后才能结清</p>}
        </div>
        {errors.length > 0 && <div className="lerrors">{errors.map((x, i) => <span key={i}>· {x}</span>)}</div>}
        <button className="primary full" onClick={save}>记入账本</button>
      </div>

      <div className="lresolved">
        <div className="timeline-intro">
          <div><span>RESOLVED</span><h2>已结清单</h2></div>
          <span className="count">{resolvedList.length}</span>
        </div>
        {resolvedList.length === 0 && <div className="ledger-empty">还没有结清的线索。</div>}
        {resolvedList.map(c => <article className="clue-card done" key={c.id}>
          <div className="clue-meta"><span className="chip">已结清</span><span className="clue-from">结清于 {titleOf(c.resolvedChapterId)}</span></div>
          <h4>{c.text}</h4>
          <div className="clue-meta">{c.characters.map(n => <span className="chip" key={n}>{n}</span>)}</div>
          {rev.clueId === c.id ? (
            <div className="revbox">
              <input autoFocus value={rev.reason} onChange={e => setRev({ ...rev, reason: e.target.value, error: '' })} placeholder="翻案原因（必填）" />
              {rev.error && <p className="warn">{rev.error}</p>}
              <div className="revbtns">
                <button className="primary" onClick={confirmReversal}>确认翻案</button>
                <button className="outline" onClick={() => setRev({ clueId: null, reason: '', error: '' })}>取消</button>
              </div>
            </div>
          ) : (
            <button className="linkbtn" onClick={() => setRev({ clueId: c.id, reason: '', error: '' })}>↺ 翻案（另起一条并写明原因）</button>
          )}
        </article>)}
      </div>
    </section>
  </div>;
}
