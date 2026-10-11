import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { Activity, ArrowRight, BarChart3, Check, ChevronRight, CircleHelp, Copy, Crown, Database, FileSpreadsheet, Flame, Layers3, LoaderCircle, LogIn, Medal, Radio, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';
import './style.css';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'https://data-quiz-arena.onrender.comreplace(/\/$/, '');
const socket = io(SERVER_URL, { autoConnect: true, reconnection: true, reconnectionAttempts: Infinity, timeout: 10000 });
const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
const topics = [
  { icon: BarChart3, title: 'Data Analysis', subtitle: 'Patterns, metrics & insights', tone: 'violet' },
  { icon: FileSpreadsheet, title: 'Excel', subtitle: 'Formulas & smart workflows', tone: 'green' },
  { icon: Database, title: 'SQL', subtitle: 'Queries, joins & logic', tone: 'blue' },
  { icon: Layers3, title: 'Power BI', subtitle: 'Models, DAX & reports', tone: 'amber' }
];

function App() {
  const [connection, setConnection] = useState(socket.connected ? 'connected' : 'connecting');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState('create');
  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(socket.id || null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onConnect = () => { setConnection('connected'); setMyId(socket.id); };
    const onDisconnect = () => setConnection('disconnected');
    const onUpdate = data => { setRoom(data); setBusy(false); if (data.status !== 'question') { setSelected(null); setReceipt(null); } };
    const onJoined = data => { setMyId(data.playerId); setJoinCode(data.code); setError(''); setBusy(false); };
    const onError = data => { setError(data?.message || 'Something went wrong.'); setBusy(false); };
    const onReceipt = data => setReceipt(data);
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('room:update', onUpdate);
    socket.on('room:joined', onJoined); socket.on('game:error', onError); socket.on('answer:receipt', onReceipt);
    const ticker = setInterval(() => setNow(Date.now()), 100);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('room:update', onUpdate); socket.off('room:joined', onJoined); socket.off('game:error', onError); socket.off('answer:receipt', onReceipt); clearInterval(ticker); };
  }, []);

  const me = room?.players?.find(p => p.id === (myId || socket.id));
  const seconds = room?.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : 0;
  const progress = room?.status === 'question' ? Math.max(0, Math.min(100, ((room.deadline - now) / 20000) * 100)) : 0;
  const isHost = room && room.hostId === (myId || socket.id);
  const sortedPlayers = useMemo(() => [...(room?.players || [])].sort((a,b) => b.score-a.score || b.correct-a.correct || a.name.localeCompare(b.name)), [room?.players]);

  function submitRoom() {
    setError('');
    if (!name.trim()) { setError('Add your nickname to enter the arena.'); return; }
    if (connection !== 'connected') { setError('Connecting to the game server. Try again in a moment.'); return; }
    setBusy(true);
    if (mode === 'create') socket.emit('room:create', { name: name.trim() });
    else socket.emit('room:join', { name: name.trim(), code: joinCode.trim() });
  }
  function startGame() { setError(''); socket.emit('game:start'); }
  function answer(index) { if (selected !== null || room?.status !== 'question' || seconds <= 0) return; setSelected(index); socket.emit('answer:submit', { optionIndex: index }); }
  async function copyCode() {
    try { await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setError(`Room code: ${room.code}. Copy it manually to share with your friends.`); }
  }
  function backHome() { socket.disconnect(); setRoom(null); setError(''); setReceipt(null); setSelected(null); socket.connect(); }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#home" onClick={e => { e.preventDefault(); if (!room) setMode('create'); }}><span className="brand-mark"><Activity size={19}/></span><span>data<span className="brand-accent">arena</span><small>THE LIVE QUIZ BATTLE</small></span></a><div className="topbar-right"><span className={`connection ${connection}`}><i/>{connection === 'connected' ? 'Server online' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting'}</span><span className="pill"><Radio size={13}/> LIVE MULTIPLAYER</span></div></header>
    {!room ? <main className="home-layout">
      <section className="hero"><div className="eyebrow"><Sparkles size={14}/> THINK FAST. SCORE BIG.</div><h1>Put your data<br/>skills to the <span>test.</span></h1><p className="hero-copy">A fast-paced quiz battle across Excel, SQL, Power BI and data analysis. Challenge your crew and claim the top spot.</p><div className="hero-stats"><div><strong>10</strong><span>Questions</span></div><div><strong>20<span className="stat-unit">s</span></strong><span>Per question</span></div><div><strong>∞</strong><span>Rival energy</span></div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-center"><Activity size={34}/></div><div className="float-card float-top"><span className="mini-dot green-dot"/> Live scores <strong>+150</strong></div><div className="float-card float-bottom"><Trophy size={16}/><span>Top performer</span><strong>#1</strong></div><span className="spark spark-one">✳</span><span className="spark spark-two">✦</span></div></section>
      <section className="join-column"><div className="join-card"><div className="card-heading"><div><span className="section-kicker">ENTER THE ARENA</span><h2>Ready to compete?</h2></div><div className="heading-icon"><Flame size={20}/></div></div><div className="mode-switch"><button className={mode === 'create' ? 'active' : ''} onClick={() => {setMode('create');setError('');}}>Create a room</button><button className={mode === 'join' ? 'active' : ''} onClick={() => {setMode('join');setError('');}}>Join a room</button></div><label className="field-label" htmlFor="nickname">YOUR NICKNAME</label><input id="nickname" value={name} onChange={e => setName(e.target.value.slice(0,20))} placeholder="e.g. QueryMaster" maxLength={20} onKeyDown={e => e.key === 'Enter' && submitRoom()} />{mode === 'join' && <><label className="field-label code-label" htmlFor="room-code">ROOM CODE</label><input id="room-code" className="code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0,6))} placeholder="ABC123" maxLength={6} onKeyDown={e => e.key === 'Enter' && submitRoom()}/></>}<button className="primary-btn" onClick={submitRoom} disabled={busy || connection !== 'connected'}>{busy ? <LoaderCircle className="spin" size={18}/> : mode === 'create' ? <Sparkles size={17}/> : <LogIn size={17}/>} {mode === 'create' ? 'Create your arena' : 'Join the battle'} <ArrowRight size={17}/></button>{error && <div className="error-note"><X size={15}/>{error}</div>}<div className="secure-note"><ShieldCheck size={15}/> No account needed. Just a nickname.</div></div><div className="topics-card"><div className="topics-title"><span>INSIDE THE ARENA</span><span className="topic-count">04 TOPICS</span></div><div className="topic-grid">{topics.map(t => <div className="topic-item" key={t.title}><div className={`topic-icon ${t.tone}`}><t.icon size={18}/></div><div><strong>{t.title}</strong><span>{t.subtitle}</span></div></div>)}</div></div><div className="how-line"><CircleHelp size={15}/><span>One room. 10 questions. One winner.</span></div></section>
    </main> : <main className="game-layout"><section className="game-main">
      <div className="game-topline"><button className="back-link" onClick={backHome}>← Leave room</button><div className="room-chip">ROOM <strong>{room.code}</strong><button title="Copy room code" onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>}</button></div></div>
      {room.status === 'lobby' && <div className="lobby-panel"><div className="lobby-symbol"><Users size={27}/></div><div className="section-kicker">THE SQUAD IS ASSEMBLING</div><h1>Waiting for players<span>.</span></h1><p>Share your room code and get your crew in here. The host starts when everyone's ready.</p><button className="share-code" onClick={copyCode}><span><small>YOUR ROOM CODE</small><strong>{room.code}</strong></span>{copied ? <Check/> : <Copy/>}</button><div className="lobby-players"><div className="subhead"><span>PLAYERS IN ROOM</span><span>{room.players.length}/30 joined</span></div><div className="player-chips">{room.players.map((p,i)=><div className="player-chip" key={p.id}><span className={`avatar avatar-${i%5}`}>{initials(p.name)}</span><span>{p.name}{p.id === room.hostId && <Crown size={12} className="host-crown"/>}</span>{p.id === room.hostId && <em>HOST</em>}</div>)}</div></div>{isHost ? <button className="primary-btn start-btn" onClick={startGame} disabled={room.players.length < 2}><Flame size={18}/> {room.players.length < 2 ? 'Waiting for one more player' : 'Start the quiz'} <ArrowRight size={17}/></button> : <div className="waiting-note"><span className="pulse-dot"/> Waiting for the host to start the game…</div>}<div className="lobby-foot"><ShieldCheck size={15}/> 10 questions · 20 seconds each · speed wins</div></div>}
      {room.status === 'question' && room.question && <div className="question-panel"><div className="question-meta"><span className="category-tag">{room.question.category}</span><span className="question-count">QUESTION <strong>{room.questionIndex+1}</strong> / {room.totalQuestions}</span></div><div className="progress-track"><div style={{width:`${((room.questionIndex+1)/room.totalQuestions)*100}%`}}/></div><div className={`timer ${seconds<=5?'urgent':''}`}><span className="timer-ring"><Activity size={18}/></span><strong>00:{String(seconds).padStart(2,'0')}</strong><span>TIME LEFT</span></div><h1>{room.question.text}</h1><p className="choose-hint">Choose your answer below. Speed matters!</p><div className="answer-grid">{room.question.options.map((option,i)=><button key={option} className={`answer-option option-${i} ${selected===i?'chosen':''} ${selected!==null?'locked':''}`} disabled={selected!==null || seconds<=0} onClick={()=>answer(i)}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{selected===i && <Check size={17}/>}</button>)}</div>{receipt ? <div className={`answer-status ${receipt.correct?'good':'bad'}`}>{receipt.correct ? <><Check size={17}/> Correct! +{receipt.earned} points</> : <><X size={17}/> Not quite — keep going!</>}</div> : selected!==null ? <div className="answer-status neutral"><LoaderCircle size={16} className="spin"/> Answer submitted…</div> : <div className="question-footer"><span><Users size={15}/> {room.players.filter(p=>p.answered).length} / {room.players.length} answered</span><span><Flame size={15}/> Fast answers earn up to 100 pts</span></div>}</div>}
      {room.status === 'reveal' && <div className="reveal-panel"><div className="reveal-icon"><Check size={30}/></div><div className="section-kicker">ANSWER REVEALED</div><h1>{room.lastResult?.correctCount || 0} players got it right<span>.</span></h1><p className="explanation">{room.lastResult?.explanation}</p><div className="correct-answer"><span>CORRECT ANSWER</span><strong>{room.lastResult?.correctIndex != null ? room.lastResult.correctIndex + 1 : ''}. {room.question?.options?.[room.lastResult?.correctIndex] || ''}</strong></div><div className="waiting-note"><span className="pulse-dot"/> Next question loading…</div></div>}
      {room.status === 'finished' && <div className="results-panel"><div className="winner-icon"><Trophy size={34}/></div><div className="section-kicker">FINAL RESULTS</div><h1>{sortedPlayers[0]?.name || 'The winner'} <span>wins!</span></h1><p>That's a wrap. The data has spoken.</p><div className="podium">{sortedPlayers.slice(0,3).map((p,i)=><div className={`podium-place place-${i+1}`} key={p.id}><div className={`podium-avatar avatar-${i}`}>{initials(p.name)}</div><strong>{p.name}</strong><span>{p.score.toLocaleString()} pts</span><div className="podium-block"><Medal size={18}/><b>{i+1}</b></div></div>)}</div><button className="primary-btn" onClick={backHome}><Sparkles size={17}/> Play another round <ArrowRight size={17}/></button></div>}
    </section><aside className="leaderboard"><div className="leader-head"><div><span className="section-kicker">THE RANKINGS</span><h2><Trophy size={19}/> Leaderboard</h2></div><span className="live-indicator"><i/> LIVE</span></div><div className="leader-sub"><span>PLAYER</span><span>SCORE</span></div><div className="leader-list">{sortedPlayers.map((p,i)=><div className={`leader-row ${p.id===(myId||socket.id)?'is-me':''}`} key={p.id}><div className={`rank rank-${i+1}`}>{i===0&&room.status!=='lobby'?<Crown size={15}/>:String(i+1).padStart(2,'0')}</div><div className={`avatar avatar-${i%5}`}>{initials(p.name)}</div><div className="leader-name"><strong>{p.name}{p.id===(myId||socket.id)&&<small>YOU</small>}</strong><span>{p.connected?'In the arena':'Disconnected'}{p.id===room.hostId?' · Host':''}</span></div><strong className="leader-score">{p.score.toLocaleString()}</strong></div>)}{sortedPlayers.length===0&&<div className="empty-leader">Players will appear here.</div>}</div><div className="leader-footer"><div><span className="footer-dot"/> {sortedPlayers.filter(p=>p.connected).length} players online</div><span>{room.status==='lobby'?'LOBBY':room.status==='finished'?'FINAL':'Q'+(room.questionIndex+1)+' / 10'}</span></div><div className="score-tip"><div className="tip-icon"><Flame size={16}/></div><div><strong>Speed is everything</strong><span>Correct answers earn 50–100 points based on how fast you respond.</span></div></div></aside></main>}
    <footer className="footer"><span>© 2026 DATA ARENA</span><span>BUILT FOR THE DATA-CURIOUS <span className="footer-star">✳</span></span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
