import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CircleHelp,
  Download,
  Eraser,
  Film,
  FilePlus2,
  Grid2X2,
  Maximize2,
  Minus,
  MousePointer2,
  Palette,
  Pencil,
  Redo2,
  RotateCcw,
  Route,
  Save,
  Pause,
  Play,
  Plus,
  Repeat2,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Type,
  Undo2,
  Users,
  Waves,
  X,
} from 'lucide-react'
import CourtBoard from './components/CourtBoard'
import { applyPreset, createInitialBoard, createPlayers, DRAW_COLORS, loadBoard, TEAM_COLORS } from './boardData'
import { clonePlayers, cloneShapes, createAnimationFrame, interpolatePlayers } from './animation'
import type { BoardState, Player, Point, Shape, ShapeType, Tool } from './types'
import './App.css'

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { id: 'select', label: '移动', icon: MousePointer2, shortcut: 'V' },
  { id: 'arrow', label: '跑动', icon: ArrowUpRight, shortcut: 'A' },
  { id: 'pass', label: '传球', icon: Route, shortcut: 'P' },
  { id: 'dribble', label: '运球', icon: Waves, shortcut: 'D' },
  { id: 'screen', label: '掩护', icon: Minus, shortcut: 'S' },
  { id: 'freehand', label: '自由', icon: Pencil, shortcut: 'F' },
  { id: 'text', label: '文字', icon: Type, shortcut: 'T' },
  { id: 'erase', label: '擦除', icon: Eraser, shortcut: 'E' },
]

function BoardLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="board-logo">
      <path d="M8 8h26l7 7v25H15l-7-7z" fill="#e7bd3f" stroke="#1f251e" strokeWidth="2.5" />
      <path d="M8 8l7 7h26M15 15v25" fill="none" stroke="#1f251e" strokeWidth="2.5" />
      <path d="M22 22h12M22 28h12M22 34h8" stroke="#6b5316" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function BallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3v18M5.7 5.7c4 3.5 4 9.1 0 12.6M18.3 5.7c-4 3.5-4 9.1 0 12.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function ConeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8l4 14H4L8 4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 13h12M3 18h18v3H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [board, setBoard] = useState<BoardState>(loadBoard)
  const [past, setPast] = useState<BoardState[]>([])
  const [future, setFuture] = useState<BoardState[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Shape | null>(null)
  const [saved, setSaved] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [animationOpen, setAnimationOpen] = useState(false)
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPlayers, setPlaybackPlayers] = useState<Player[] | null>(null)
  const [playbackShapes, setPlaybackShapes] = useState<Shape[] | null>(null)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const boardRef = useRef(board)
  const draftRef = useRef<Shape | null>(null)
  const transactionRef = useRef<BoardState | null>(null)
  const activeFrameRef = useRef<string | null>(null)
  const playbackSegmentRef = useRef(0)
  const playbackProgressRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const animationLocked = isPlaying || playbackPlayers !== null

  const notify = (message: string) => setToast(message)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const syncActiveFrame = (state: BoardState): BoardState => {
    const frameId = activeFrameRef.current
    if (!frameId || !state.frames.some((frame) => frame.id === frameId)) return state
    return {
      ...state,
      frames: state.frames.map((frame) => frame.id === frameId ? {
        ...frame,
        players: clonePlayers(state.players),
        shapes: cloneShapes(state.shapes),
      } : frame),
    }
  }

  const commit = (updater: (current: BoardState) => BoardState) => {
    const current = boardRef.current
    const next = syncActiveFrame(updater(current))
    setPast((items) => [...items, current].slice(-60))
    setFuture([])
    boardRef.current = next
    setBoard(next)
    setSaved(false)
  }

  const changeWithoutHistory = (updater: (current: BoardState) => BoardState) => {
    const next = syncActiveFrame(updater(boardRef.current))
    boardRef.current = next
    setBoard(next)
    setSaved(false)
  }

  const stopPlayback = () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    setIsPlaying(false)
    setPlaybackPlayers(null)
    setPlaybackShapes(null)
    playbackProgressRef.current = 0
    playbackSegmentRef.current = 0
  }

  const selectFrame = (frameId: string) => {
    const frame = boardRef.current.frames.find((item) => item.id === frameId)
    if (!frame) return
    stopPlayback()
    activeFrameRef.current = frameId
    setActiveFrameId(frameId)
    const next = {
      ...boardRef.current,
      players: clonePlayers(frame.players),
      shapes: cloneShapes(frame.shapes),
    }
    boardRef.current = next
    setBoard(next)
    setSelectedId(null)
  }

  const toggleAnimation = () => {
    if (animationOpen) {
      stopPlayback()
      activeFrameRef.current = null
      setActiveFrameId(null)
      setAnimationOpen(false)
      return
    }
    const current = boardRef.current
    const firstFrame = current.frames[0] || createAnimationFrame(current.players, current.shapes, 0)
    const next = {
      ...current,
      frames: current.frames.length ? current.frames : [firstFrame],
      players: clonePlayers(firstFrame.players),
      shapes: cloneShapes(firstFrame.shapes),
    }
    boardRef.current = next
    setBoard(next)
    activeFrameRef.current = firstFrame.id
    setActiveFrameId(firstFrame.id)
    setAnimationOpen(true)
    setSelectedId(null)
    setTool('select')
    if (!current.frames.length) setSaved(false)
    notify('添加关键帧并移动球员，即可制作动画')
  }

  const addKeyFrame = () => {
    if (animationLocked) return
    const current = boardRef.current
    const frame = createAnimationFrame(current.players, current.shapes, current.frames.length)
    commit((state) => ({ ...state, frames: [...state.frames, frame] }))
    activeFrameRef.current = frame.id
    setActiveFrameId(frame.id)
    setSelectedId(null)
    notify(`已添加${frame.name}，请调整球员位置`)
  }

  const deleteActiveFrame = () => {
    if (animationLocked || !activeFrameId) return
    const current = boardRef.current
    const index = current.frames.findIndex((frame) => frame.id === activeFrameId)
    const remaining = current.frames.filter((frame) => frame.id !== activeFrameId)
    commit((state) => ({ ...state, frames: state.frames.filter((frame) => frame.id !== activeFrameId) }))
    const nextActive = remaining[Math.min(Math.max(index, 0), remaining.length - 1)]
    if (nextActive) selectFrame(nextActive.id)
    else {
      activeFrameRef.current = null
      setActiveFrameId(null)
    }
  }

  const stepFrame = (direction: number) => {
    const frames = boardRef.current.frames
    const index = frames.findIndex((frame) => frame.id === activeFrameRef.current)
    const target = frames[Math.max(0, Math.min(frames.length - 1, index + direction))]
    if (target) selectFrame(target.id)
  }

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    const frames = boardRef.current.frames
    if (frames.length < 2) {
      notify('至少需要 2 个关键帧才能播放动画')
      return
    }
    if (playbackPlayers) {
      setIsPlaying(true)
      return
    }
    const activeIndex = frames.findIndex((frame) => frame.id === activeFrameRef.current)
    const segment = activeIndex >= 0 && activeIndex < frames.length - 1 ? activeIndex : 0
    playbackSegmentRef.current = segment
    playbackProgressRef.current = 0
    setPlaybackPlayers(clonePlayers(frames[segment].players))
    setPlaybackShapes(cloneShapes(frames[segment].shapes))
    setSelectedId(null)
    setIsPlaying(true)
  }

  useEffect(() => {
    if (!isPlaying) return
    const frames = boardRef.current.frames
    if (frames.length < 2) {
      setIsPlaying(false)
      return
    }
    let segment = Math.min(playbackSegmentRef.current, frames.length - 2)
    let fromFrame = frames[segment]
    let toFrame = frames[segment + 1]
    let startedAt = performance.now() - playbackProgressRef.current * (1100 / speed)

    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / (1100 / speed)))
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      playbackProgressRef.current = progress
      setPlaybackPlayers(interpolatePlayers(fromFrame.players, toFrame.players, eased))
      setPlaybackShapes(cloneShapes(progress < 0.5 ? fromFrame.shapes : toFrame.shapes))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }
      if (segment < frames.length - 2 || loop) {
        segment = segment < frames.length - 2 ? segment + 1 : 0
        playbackSegmentRef.current = segment
        playbackProgressRef.current = 0
        fromFrame = frames[segment]
        toFrame = frames[segment + 1]
        startedAt = now
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const lastFrame = frames[frames.length - 1]
      const next = {
        ...boardRef.current,
        players: clonePlayers(lastFrame.players),
        shapes: cloneShapes(lastFrame.shapes),
      }
      activeFrameRef.current = lastFrame.id
      boardRef.current = next
      setBoard(next)
      setActiveFrameId(lastFrame.id)
      setPlaybackPlayers(null)
      setPlaybackShapes(null)
      setIsPlaying(false)
      playbackProgressRef.current = 0
      playbackSegmentRef.current = 0
    }

    animationFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, speed, loop])

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
  }, [])

  const beginTransaction = () => {
    transactionRef.current = boardRef.current
  }

  const endTransaction = () => {
    const previous = transactionRef.current
    transactionRef.current = null
    if (!previous || previous === boardRef.current) return
    setPast((items) => [...items, previous].slice(-60))
    setFuture([])
  }

  const restoreHistory = (next: BoardState) => {
    stopPlayback()
    activeFrameRef.current = null
    setActiveFrameId(null)
    setAnimationOpen(false)
    boardRef.current = next
    setBoard(next)
    setSelectedId(null)
    setSaved(false)
  }

  const undo = () => {
    if (!past.length) return
    const previous = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture([boardRef.current, ...future])
    restoreHistory(previous)
  }

  const redo = () => {
    if (!future.length) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast([...past, boardRef.current])
    restoreHistory(next)
  }

  const saveBoard = () => {
    localStorage.setItem('basketball-tactical-board-v1', JSON.stringify(boardRef.current))
    setSaved(true)
    notify('战术方案已保存到此浏览器')
  }

  const deleteSelected = () => {
    if (!selectedId || animationLocked) return
    commit((current) => ({
      ...current,
      players: current.players.filter((item) => item.id !== selectedId),
      shapes: current.shapes.filter((item) => item.id !== selectedId),
    }))
    setSelectedId(null)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveBoard()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.code === 'Space' && animationOpen) {
        event.preventDefault()
        togglePlayback()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelected()
        return
      }
      if (event.key === 'Escape') {
        if (animationLocked) stopPlayback()
        setSelectedId(null)
        setHelpOpen(false)
        setTool('select')
        return
      }
      const match = TOOLS.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase())
      if (match && !animationLocked && !event.metaKey && !event.ctrlKey) setTool(match.id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    if (!helpOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [helpOpen])

  const movePlayer = (id: string, point: Point) => {
    changeWithoutHistory((current) => ({
      ...current,
      players: current.players.map((item) => item.id === id ? { ...item, x: point.x, y: point.y } : item),
    }))
  }

  const startShape = (point: Point) => {
    if (tool === 'select' || tool === 'erase' || tool === 'text') return
    const next: Shape = {
      id: `shape-${Date.now()}`,
      type: tool as ShapeType,
      points: [point, point],
      color: drawColor,
    }
    draftRef.current = next
    setDraft(next)
  }

  const updateShape = (point: Point) => {
    const current = draftRef.current
    if (!current) return
    const points = current.type === 'freehand'
      ? [...current.points, point]
      : [current.points[0], point]
    const next = { ...current, points }
    draftRef.current = next
    setDraft(next)
  }

  const finishShape = () => {
    const current = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!current) return
    const length = current.points.slice(1).reduce((sum, point, index) => {
      const previous = current.points[index]
      return sum + Math.hypot(point.x - previous.x, point.y - previous.y)
    }, 0)
    if (length < 12) return
    commit((boardState) => ({ ...boardState, shapes: [...boardState.shapes, current] }))
  }

  const eraseObject = (id: string) => {
    commit((current) => ({
      ...current,
      players: current.players.filter((item) => item.id !== id),
      shapes: current.shapes.filter((item) => item.id !== id),
    }))
    if (selectedId === id) setSelectedId(null)
  }

  const addText = (point: Point) => {
    const text = window.prompt('输入球场标注', '注意协防')
    if (!text?.trim()) return
    const shape: Shape = { id: `text-${Date.now()}`, type: 'text', points: [point], color: drawColor, text: text.trim().slice(0, 24) }
    commit((current) => ({ ...current, shapes: [...current.shapes, shape] }))
    setSelectedId(shape.id)
  }

  const editText = (shape: Shape) => {
    const text = window.prompt('修改标注', shape.text || '')
    if (!text?.trim()) return
    commit((current) => ({
      ...current,
      shapes: current.shapes.map((item) => item.id === shape.id ? { ...item, text: text.trim().slice(0, 24) } : item),
    }))
  }

  const editPlayer = (player: Player) => {
    const number = window.prompt('修改球员号码', player.number)
    if (number === null || !number.trim()) return
    commit((current) => ({
      ...current,
      players: current.players.map((item) => item.id === player.id ? { ...item, number: number.trim().slice(0, 3) } : item),
    }))
  }

  const addPlayer = (color: string) => {
    const selected = board.players.find((item) => item.id === selectedId && item.kind === 'player')
    if (selected) {
      commit((current) => ({
        ...current,
        players: current.players.map((item) => item.id === selected.id ? { ...item, color } : item),
      }))
      notify('已更改选中球员的颜色')
      return
    }
    const count = board.players.filter((item) => item.color === color && item.kind === 'player').length
    const width = board.courtMode === 'full' ? 1000 : 560
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      number: String(count + 1),
      color,
      x: width / 2 + (count % 3) * 28,
      y: 250 + (count % 2) * 55,
      kind: 'player',
    }
    commit((current) => ({ ...current, players: [...current.players, newPlayer] }))
    setSelectedId(newPlayer.id)
    setTool('select')
  }

  const addBall = () => {
    const width = board.courtMode === 'full' ? 1000 : 560
    const ball: Player = { id: `ball-${Date.now()}`, number: '', color: '#d77b27', x: width / 2, y: 280, kind: 'ball' }
    commit((current) => ({ ...current, players: [...current.players, ball] }))
    setSelectedId(ball.id)
    setTool('select')
  }

  const addCone = () => {
    const width = board.courtMode === 'full' ? 1000 : 560
    const count = board.players.filter((item) => item.kind === 'cone').length
    const cone: Player = {
      id: `cone-${Date.now()}`,
      number: '',
      color: '#e86f2c',
      x: width / 2 - 40 + (count % 3) * 40,
      y: 390 + (count % 2) * 40,
      kind: 'cone',
    }
    commit((current) => ({ ...current, players: [...current.players, cone] }))
    setSelectedId(cone.id)
    setTool('select')
    notify('已添加标志桶，可拖动调整位置')
  }

  const clearAnimation = () => {
    stopPlayback()
    activeFrameRef.current = null
    setActiveFrameId(null)
    setAnimationOpen(false)
  }

  const switchCourt = () => {
    const courtMode = board.courtMode === 'full' ? 'half' : 'full'
    clearAnimation()
    commit((current) => ({ ...current, courtMode, players: createPlayers(courtMode), shapes: [], frames: [] }))
    setSelectedId(null)
    notify(courtMode === 'full' ? '已切换为全场' : '已切换为半场')
  }

  const resetBoard = () => {
    if (!window.confirm('新建方案会清空当前球场，确定继续吗？')) return
    const next = createInitialBoard()
    clearAnimation()
    commit(() => next)
    setSelectedId(null)
    setTool('select')
    notify('已新建空白战术方案')
  }

  const exportPng = () => {
    const sourceSvg = svgRef.current
    if (!sourceSvg) return
    notify('正在生成图片…')
    const clone = sourceSvg.cloneNode(true) as SVGSVGElement
    const full = board.courtMode === 'full'
    const width = 2000
    const height = full ? 1120 : 2000
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    const source = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(image, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) {
          notify('图片生成失败，请重试')
          return
        }
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `${board.title || '篮球战术'}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
        notify('PNG 图片已导出')
      }, 'image/png')
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      notify('图片生成失败，请重试')
    }
    image.src = url
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      notify('当前浏览器不支持全屏模式')
    }
  }

  const selectedPlayer = board.players.find((item) => item.id === selectedId)
  const selectedShape = board.shapes.find((item) => item.id === selectedId)
  const objectCount = board.players.length + board.shapes.length
  const displayBoard = playbackPlayers && playbackShapes
    ? { ...board, players: playbackPlayers, shapes: playbackShapes }
    : board
  const activeFrameIndex = board.frames.findIndex((frame) => frame.id === activeFrameId)
  const previousFramePlayers = animationOpen && !animationLocked && activeFrameIndex > 0
    ? board.frames[activeFrameIndex - 1].players
    : null

  return (
    <div className={`app-shell theme-${board.background}`}>
      <header className="app-header">
        <div className="brand">
          <BoardLogo />
          <div className="brand-type"><strong>TACTICAL BOARD</strong><span>BASKETBALL</span></div>
        </div>
        <label className="scheme-title">
          <span>方案</span>
          <input value={board.title} disabled={animationLocked} maxLength={40} aria-label="战术方案名称" onChange={(event) => changeWithoutHistory((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <div className="header-actions">
          <span className={`save-state ${saved ? 'is-saved' : ''}`}><span />{saved ? '已保存' : '未保存'}</span>
          <button className="header-help" onClick={() => setHelpOpen(true)} aria-label="打开使用指南"><CircleHelp size={19} /><span>使用指南</span></button>
        </div>
      </header>

      <div className="app-body">
        <aside className="side-rail" aria-label="方案工具">
          <button onClick={resetBoard} disabled={animationLocked} data-tooltip="新建方案" aria-label="新建方案"><FilePlus2 /></button>
          <button onClick={saveBoard} data-tooltip="保存到浏览器" aria-label="保存到浏览器"><Save /></button>
          <button onClick={exportPng} data-tooltip="导出 PNG" aria-label="导出 PNG 图片"><Download /></button>
          <span className="rail-divider" />
          <button className={board.courtMode === 'half' ? 'active' : ''} disabled={animationLocked} onClick={switchCourt} data-tooltip={board.courtMode === 'full' ? '切换半场' : '切换全场'} aria-label="切换全场或半场"><Grid2X2 /></button>
          <button onClick={() => commit((current) => ({ ...current, background: current.background === 'olive' ? 'midnight' : 'olive' }))} disabled={animationLocked} data-tooltip="切换背景" aria-label="切换背景颜色"><Palette /></button>
          <button className={animationOpen ? 'active' : ''} onClick={toggleAnimation} data-tooltip="动画演示" aria-label="动画演示" aria-pressed={animationOpen}><Film /></button>
          <button onClick={toggleFullscreen} data-tooltip="全屏演示" aria-label="全屏演示"><Maximize2 /></button>
          <div className="rail-spacer" />
          <div className="sport-monogram" aria-label="篮球">BB</div>
        </aside>

        <main className={`main-surface ${animationOpen ? 'animation-active' : ''}`}>
          <div className="context-bar">
            <div className="breadcrumb"><span className="live-dot" /><strong>篮球战术板</strong><span>/</span><span>{board.courtMode === 'full' ? '全场' : '半场'}</span></div>
            <div className="context-actions">
              <label className="preset-select"><Users size={16} /><select aria-label="应用战术示例" defaultValue="" disabled={animationLocked} onChange={(event) => {
                if (!event.target.value) return
                commit((current) => applyPreset(current, event.target.value))
                setSelectedId(null)
                event.target.value = ''
              }}><option value="">战术示例</option><option value="pick-roll">挡拆配合</option><option value="fast-break">快攻推进</option><option value="zone">2–3 区域联防</option></select></label>
              <span className="mode-chip">{board.courtMode === 'full' ? 'FULL COURT' : 'HALF COURT'}</span>
            </div>
          </div>

          <section className="board-stage" aria-label="战术板工作区">
            <div className={`court-frame ${board.courtMode === 'half' ? 'half-frame' : ''}`}>
              <CourtBoard
                board={displayBoard}
                tool={tool}
                drawColor={drawColor}
                selectedId={animationLocked ? null : selectedId}
                draft={draft}
                previousFramePlayers={previousFramePlayers}
                svgRef={svgRef}
                disabled={animationLocked}
                onSelect={setSelectedId}
                onBeginTransaction={beginTransaction}
                onEndTransaction={endTransaction}
                onMovePlayer={movePlayer}
                onStartShape={startShape}
                onUpdateShape={updateShape}
                onFinishShape={finishShape}
                onEraseShape={eraseObject}
                onAddText={addText}
                onEditPlayer={editPlayer}
                onEditText={editText}
              />
            </div>
            <p className="stage-hint">{animationOpen ? (animationLocked ? '动画演示中，可暂停、调速或停止返回关键帧' : activeFrameIndex > 0 ? '半透明轮廓为上一帧位置，虚线显示本帧移动轨迹' : '在当前关键帧调整站位，再添加下一帧') : <>拖动球员调整站位<span>·</span>双击球员修改号码<span>·</span>选择路线工具后在球场上拖动</>}</p>
          </section>

          <fieldset className="control-panel" aria-label="战术编辑工具栏" disabled={animationLocked}>
            <div className="players-control">
              <div className="control-heading"><span>场上对象</span><small>{selectedPlayer?.kind === 'player' ? '点击颜色更换选中球员' : selectedPlayer ? '可拖动或按 Delete 删除' : '点击添加，拖到场上'}</small></div>
              <div className="player-colors">
                {TEAM_COLORS.map((color) => <button key={color} className="add-player" style={{ '--player-color': color } as React.CSSProperties} onClick={() => addPlayer(color)} aria-label={`添加或更换 ${color} 颜色球员`}><span>1</span><i>+</i></button>)}
                <button className="add-ball" onClick={addBall} aria-label="添加篮球" title="添加篮球"><BallIcon /></button>
                <button className="add-ball add-cone" onClick={addCone} aria-label="添加标志桶" title="添加标志桶障碍物"><ConeIcon /></button>
              </div>
            </div>

            <div className="drawing-control">
              <div className="control-heading"><span>战术路线</span><small>选择后在球场拖动</small></div>
              <div className="tool-row">
                {TOOLS.map((item) => {
                  const Icon = item.icon
                  return <button key={item.id} className={`tool-button ${tool === item.id ? 'active' : ''}`} onClick={() => setTool(item.id)} aria-pressed={tool === item.id} title={`${item.label}（${item.shortcut}）`}><Icon size={19} /><span>{item.label}</span></button>
                })}
              </div>
            </div>

            <div className="history-control">
              <div className="control-heading"><span>编辑</span><small>{selectedId ? '已选中 1 个对象' : '未选中对象'}</small></div>
              <div className="history-row">
                <button onClick={undo} disabled={!past.length} title="撤销（⌘Z）" aria-label="撤销"><Undo2 /></button>
                <button onClick={redo} disabled={!future.length} title="重做（⇧⌘Z）" aria-label="重做"><Redo2 /></button>
                <button onClick={deleteSelected} disabled={!selectedId} title="删除选中对象" aria-label="删除选中对象"><Trash2 /></button>
                <button onClick={() => { commit((current) => ({ ...current, shapes: [] })); setSelectedId(null); notify('已清空全部路线') }} disabled={!board.shapes.length} title="清空全部路线" aria-label="清空全部路线"><RotateCcw /></button>
              </div>
            </div>
          </fieldset>

          {animationOpen && <section className="animation-panel" aria-label="动画演示工具栏">
            <div className="animation-heading"><Film size={17} /><div><strong>动画演示</strong><small>{isPlaying ? `第 ${playbackSegmentRef.current + 1} 段播放中` : playbackPlayers ? '已暂停，可继续播放' : `${board.frames.length} 个关键帧`}</small></div></div>
            <div className="frame-strip" aria-label="关键帧列表">
              {board.frames.map((frame, index) => <button key={frame.id} data-frame-id={frame.id} className={`frame-button ${activeFrameId === frame.id ? 'active' : ''}`} disabled={animationLocked} onClick={() => selectFrame(frame.id)} aria-label={`选择第 ${index + 1} 帧`} aria-pressed={activeFrameId === frame.id}><span>{index + 1}</span>{index === 0 ? '起始' : index === board.frames.length - 1 ? '结束' : '关键帧'}</button>)}
              <button className="add-frame" onClick={addKeyFrame} disabled={animationLocked} aria-label="添加关键帧" title="复制当前场面为新关键帧"><Plus size={16} /><span>添加帧</span></button>
            </div>
            <div className="playback-controls">
              <button onClick={() => stepFrame(-1)} disabled={animationLocked || activeFrameIndex <= 0} aria-label="上一关键帧" title="上一关键帧"><SkipBack /></button>
              <button className="play-button" onClick={togglePlayback} disabled={board.frames.length < 2 && !isPlaying} aria-label={isPlaying ? '暂停动画' : playbackPlayers ? '继续播放' : '播放动画'} title="播放 / 暂停（空格）">{isPlaying ? <Pause /> : <Play />}</button>
              <button onClick={stopPlayback} disabled={!animationLocked} aria-label="停止动画" title="停止并返回活动关键帧"><Square /></button>
              <button onClick={() => stepFrame(1)} disabled={animationLocked || activeFrameIndex >= board.frames.length - 1} aria-label="下一关键帧" title="下一关键帧"><SkipForward /></button>
              <button onClick={deleteActiveFrame} disabled={animationLocked || !board.frames.length} aria-label="删除当前关键帧" title="删除当前关键帧"><Trash2 /></button>
            </div>
            <div className="playback-options">
              <label>速度<select aria-label="动画速度" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
              <button className={`loop-button ${loop ? 'active' : ''}`} onClick={() => setLoop((value) => !value)} aria-label="循环播放" aria-pressed={loop} title="循环播放"><Repeat2 size={17} /><span>循环</span></button>
            </div>
          </section>}

          <div className="bottom-status">
            <div className="ink-colors" aria-label="路线颜色">{DRAW_COLORS.map((color) => <button key={color} disabled={animationLocked} className={drawColor === color ? 'active' : ''} style={{ '--ink-color': color } as React.CSSProperties} onClick={() => setDrawColor(color)} aria-label={`选择路线颜色 ${color}`} />)}</div>
            <span>{objectCount} 个对象</span>
            <span className="selection-status">{selectedPlayer ? `选中：${selectedPlayer.kind === 'cone' ? '标志桶' : selectedPlayer.kind === 'ball' ? '篮球' : `${selectedPlayer.number} 号球员`}` : selectedShape ? `选中：${selectedShape.type === 'text' ? selectedShape.text : '战术路线'}` : '点击对象可选中'}</span>
            <span className="local-note">本地编辑 · 可导出高清图片</span>
          </div>
        </main>
      </div>

      {helpOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false) }}>
        <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭使用指南"><X /></button>
          <span className="help-kicker">QUICK START</span>
          <h2 id="help-title">三步画出你的战术</h2>
          <ol className="help-steps">
            <li><span>01</span><div><strong>安排站位</strong><p>拖动球员与篮球到目标位置；双击球员可修改号码，点击颜色可添加或换色。</p></div></li>
            <li><span>02</span><div><strong>绘制路线</strong><p>选择跑动、传球、运球或掩护，在球场上按下并拖动。自由工具支持手绘。</p></div></li>
            <li><span>03</span><div><strong>保存与分享</strong><p>方案可保存在当前浏览器，也可以导出为高清 PNG 图片用于训练和讲解。</p></div></li>
          </ol>
          <div className="shortcut-grid"><span><kbd>V</kbd> 移动</span><span><kbd>A</kbd> 跑动</span><span><kbd>P</kbd> 传球</span><span><kbd>⌘ Z</kbd> 撤销</span><span><kbd>Del</kbd> 删除</span><span><kbd>Esc</kbd> 返回移动</span></div>
          <button className="primary-action" onClick={() => setHelpOpen(false)}><Check size={18} />开始画战术</button>
        </section>
      </div>}

      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  )
}
