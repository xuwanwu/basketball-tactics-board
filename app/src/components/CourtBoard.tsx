import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { BoardState, CourtGeometry, Player, Point, Shape, Tool } from '../types'

interface CourtBoardProps {
  board: BoardState
  tool: Tool
  drawColor: string
  selectedId: string | null
  draft: Shape | null
  previousFramePlayers?: Player[] | null
  svgRef: React.RefObject<SVGSVGElement | null>
  onSelect: (id: string | null) => void
  onBeginTransaction: () => void
  onEndTransaction: () => void
  onMovePlayer: (id: string, point: Point) => void
  onStartShape: (point: Point) => void
  onUpdateShape: (point: Point) => void
  onFinishShape: () => void
  onEraseShape: (id: string) => void
  onAddText: (point: Point) => void
  onEditPlayer: (player: Player) => void
  onEditText: (shape: Shape) => void
  disabled?: boolean
}

const COURT = '#D19546'
const LINES = '#f5f0dd'
// 球场线外的可绘制缓冲区：1 米 ≈ 35 单位，约 3 米 = 105 单位（含原 10 单位边框，故此处为 95）
const OOB = 95
const geometryFor = (mode: BoardState['courtMode']): CourtGeometry => mode === 'full'
  ? { width: 1000, height: 560 }
  : { width: 560, height: 560 }

function markerId(color: string) {
  return `arrow-${color.replace('#', '')}`
}

function HalfCourtMarkings({ half }: { half: boolean }) {
  return (
    <>
      <path d="M 12 62 L 174 62 A 244 244 0 0 1 174 498 L 12 498" />
      <rect x="12" y="195" width="190" height="170" />
      <path d="M 202 195 A 85 85 0 0 1 202 365" />
      <path d="M 70 228 A 62 62 0 0 1 70 332" />
      <line x1="55" y1="224" x2="55" y2="336" />
      <circle cx="76" cy="280" r="10" />
      <line x1="55" y1="280" x2="76" y2="280" />
      {[92, 126, 160].map((x) => <g key={x}><line x1={x} y1="186" x2={x} y2="195" /><line x1={x} y1="365" x2={x} y2="374" /></g>)}
      {half && <path d="M 548 222 A 58 58 0 0 0 548 338" />}
    </>
  )
}

function Basketball() {
  return (
    <>
      <circle r="15" fill="#d77b27" stroke="#55391f" strokeWidth="2" />
      <path d="M -15 0 H 15 M 0 -15 V 15 M -11 -11 Q 0 0 -11 11 M 11 -11 Q 0 0 11 11" fill="none" stroke="#55391f" strokeWidth="1.6" />
    </>
  )
}

function ConeFigure() {
  return (
    <>
      <rect x="-18" y="12" width="36" height="7" rx="2" fill="#bd4c22" stroke="#61301f" strokeWidth="2" />
      <path d="M -12 12 L -5 -17 Q 0 -22 5 -17 L 12 12 Z" fill="#e86f2c" stroke="#61301f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M -8 -1 H 8 L 10 6 H -10 Z" fill="#f6ead5" />
      <ellipse cx="0" cy="-16" rx="4" ry="2" fill="#74371f" />
    </>
  )
}

function PlayerFigure({ player }: { player: Player }) {
  if (player.kind === 'ball') return <Basketball />
  if (player.kind === 'cone') return <ConeFigure />
  return <>
    <circle r="22" fill={player.color} stroke="#20251f" strokeWidth="2.5" />
    <circle r="18.5" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
    <text x="0" y="7" textAnchor="middle" fill={player.color === '#eee9d8' || player.color === '#e6c434' ? '#252a24' : '#fffdf2'} fontSize="19" fontWeight="800" pointerEvents="none">{player.number}</text>
  </>
}

export default function CourtBoard({
  board,
  tool,
  drawColor,
  selectedId,
  draft,
  previousFramePlayers = null,
  svgRef,
  onSelect,
  onBeginTransaction,
  onEndTransaction,
  onMovePlayer,
  onStartShape,
  onUpdateShape,
  onFinishShape,
  onEraseShape,
  onAddText,
  onEditPlayer,
  onEditText,
  disabled = false,
}: CourtBoardProps) {
  const dragPlayer = useRef<string | null>(null)
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null)
  const drawing = useRef(false)
  const geometry = geometryFor(board.courtMode)
  const half = board.courtMode === 'half'

  const toPoint = (event: ReactPointerEvent<SVGElement>): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const transformed = point.matrixTransform(svg.getScreenCTM()!.inverse())
    return {
      x: Math.max(-OOB, Math.min(geometry.width + OOB, transformed.x)),
      y: Math.max(-OOB, Math.min(geometry.height + OOB, transformed.y)),
    }
  }

  const handleBoardPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0) return
    const point = toPoint(event)
    if (tool === 'select' || tool === 'erase') {
      onSelect(null)
      return
    }
    if (tool === 'text') {
      onAddText(point)
      return
    }
    drawing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(null)
    onStartShape(point)
  }

  const handleBoardPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawing.current) onUpdateShape(toPoint(event))
  }

  const handleBoardPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    onFinishShape()
  }

  const handlePlayerDown = (event: ReactPointerEvent<SVGGElement>, player: Player) => {
    if (disabled) return
    if (tool === 'erase') {
      event.stopPropagation()
      onEraseShape(player.id)
      return
    }
    if (tool !== 'select' || event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragPlayer.current = player.id
    setDraggingPlayerId(player.id)
    onSelect(player.id)
    onBeginTransaction()
  }

  const handlePlayerMove = (event: ReactPointerEvent<SVGGElement>) => {
    if (!dragPlayer.current) return
    onMovePlayer(dragPlayer.current, toPoint(event))
  }

  const handlePlayerUp = () => {
    if (!dragPlayer.current) return
    dragPlayer.current = null
    setDraggingPlayerId(null)
    onEndTransaction()
  }

  const renderShape = (shape: Shape, isDraft = false) => {
    const common = {
      stroke: shape.color,
      strokeWidth: isDraft ? 5 : 4,
      fill: 'none',
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      opacity: isDraft ? 0.72 : 1,
    }
    const selected = selectedId === shape.id
    const interaction = {
      'data-shape-id': shape.id,
      className: `board-shape ${tool === 'erase' ? 'erase-hover' : ''}`,
      onPointerDown: (event: ReactPointerEvent<SVGElement>) => {
        event.stopPropagation()
        if (tool === 'erase') onEraseShape(shape.id)
        else if (tool === 'select') onSelect(shape.id)
      },
      onDoubleClick: (event: React.MouseEvent<SVGElement>) => {
        event.stopPropagation()
        if (shape.type === 'text') onEditText(shape)
      },
    }

    if (shape.type === 'text') {
      const point = shape.points[0]
      return <g key={shape.id} {...interaction}>
        {selected && <rect x={point.x - 7} y={point.y - 28} width={(shape.text?.length || 1) * 25 + 18} height="39" rx="4" fill="none" stroke="#e3b93e" strokeWidth="2" strokeDasharray="5 4" />}
        <text x={point.x} y={point.y} fill={shape.color} fontSize="25" fontWeight="700" className="board-text">{shape.text}</text>
      </g>
    }

    const points = shape.points
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    const end = points[points.length - 1]
    const start = points[0]
    let element

    if (shape.type === 'freehand') {
      element = <path d={path} {...common} />
    } else if (shape.type === 'dribble') {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.hypot(dx, dy) || 1
      const nx = -dy / length
      const ny = dx / length
      const tail = Math.min(16, length / 3) // 终点前留一段沿主方向的直线，使箭头指向前进方向而非锯齿斜边
      const usable = (length - tail) / length
      const waves = Math.max(2, Math.floor((length * usable) / 24))
      let wavePath = `M ${start.x} ${start.y}`
      for (let i = 1; i <= waves * 2; i += 1) {
        const t = (i / (waves * 2)) * usable
        const amplitude = i === waves * 2 ? 0 : (i % 2 === 0 ? -9 : 9)
        wavePath += ` L ${start.x + dx * t + nx * amplitude} ${start.y + dy * t + ny * amplitude}`
      }
      wavePath += ` L ${end.x} ${end.y}`
      element = <path d={wavePath} {...common} markerEnd={`url(#${markerId(shape.color)})`} />
    } else {
      element = <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...common}
        strokeDasharray={shape.type === 'pass' ? '12 10' : undefined}
        markerEnd={shape.type === 'arrow' || shape.type === 'pass' ? `url(#${markerId(shape.color)})` : undefined} />
      if (shape.type === 'screen') {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy) || 1
        const nx = -dy / length * 13
        const ny = dx / length * 13
        element = <g>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...common} />
          <line x1={end.x - nx} y1={end.y - ny} x2={end.x + nx} y2={end.y + ny} {...common} />
        </g>
      }
    }

    return <g key={shape.id} {...interaction}>
      {element}
      {selected && <path d={path} fill="none" stroke="#e3b93e" strokeWidth="10" opacity="0.28" strokeLinecap="round" />}
    </g>
  }

  return (
    <svg
      ref={svgRef}
      className={`court-svg tool-${tool} ${disabled ? 'is-playback' : ''}`}
      viewBox={`${-OOB} ${-OOB} ${geometry.width + OOB * 2} ${geometry.height + OOB * 2}`}
      role="img"
      aria-disabled={disabled}
      aria-label={half ? '篮球半场战术编辑区' : '篮球全场战术编辑区'}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
      onPointerCancel={handleBoardPointerUp}
    >
      <defs>
        {[drawColor, '#f4efdc', '#252b25', '#e3b93e', '#d84b3e', '#3984c6'].filter((color, index, all) => all.indexOf(color) === index).map((color) => (
          <marker key={color} id={markerId(color)} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 1 1 L 11 6 L 1 11 z" fill={color} />
          </marker>
        ))}
      </defs>

      <rect
        x={-OOB}
        y={-OOB}
        width={geometry.width + OOB * 2}
        height={geometry.height + OOB * 2}
        rx="16"
        fill="rgba(28, 33, 26, 0.34)"
        pointerEvents="none"
      />

      <g className="court-markings" fill="none" stroke={LINES} strokeWidth="4">
        <rect x="10" y="10" width={geometry.width - 20} height="540" fill={COURT} strokeWidth="6" />
        {half ? <HalfCourtMarkings half /> : <>
          <HalfCourtMarkings half={false} />
          <g transform="translate(1000 0) scale(-1 1)"><HalfCourtMarkings half={false} /></g>
          <line x1="500" y1="10" x2="500" y2="550" />
          <circle cx="500" cy="280" r="58" />
        </>}
      </g>
      <text x={geometry.width - 22} y="535" textAnchor="end" fill="#f5f0dd" opacity="0.22" fontSize="15" letterSpacing="1.5" pointerEvents="none">TACTICAL BOARD</text>

      <g>{board.shapes.map((shape) => renderShape(shape))}{draft && renderShape(draft, true)}</g>

      <g className="animation-guides" aria-hidden="true">
        {previousFramePlayers && board.players.map((player) => {
          const previous = previousFramePlayers.find((item) => item.id === player.id)
          if (!previous || Math.hypot(player.x - previous.x, player.y - previous.y) < 2) return null
          const middle1 = { x: previous.x + (player.x - previous.x) / 3, y: previous.y + (player.y - previous.y) / 3 }
          const middle2 = { x: previous.x + (player.x - previous.x) * 2 / 3, y: previous.y + (player.y - previous.y) * 2 / 3 }
          const points = [previous, middle1, middle2, player].map((point) => `${point.x},${point.y}`).join(' ')
          return <g key={`guide-${player.id}`} data-animation-guide={player.id}>
            <polyline data-animation-path={player.id} points={points} fill="none" stroke={player.color} strokeWidth="2.5" strokeDasharray="7 9" strokeLinejoin="round" opacity="0.9" />
            <g data-animation-ghost={player.id} transform={`translate(${previous.x} ${previous.y})`} opacity="0.5">
              <PlayerFigure player={player} />
            </g>
            {draggingPlayerId !== player.id && <g fill={player.color} stroke={COURT} strokeWidth="1.5">
              <circle data-animation-node={`${player.id}-1`} cx={middle1.x} cy={middle1.y} r="5.5" fillOpacity="0.8" />
              <circle data-animation-node={`${player.id}-2`} cx={middle2.x} cy={middle2.y} r="5.5" fillOpacity="0.8" />
            </g>}
          </g>
        })}
      </g>

      <g>
        {board.players.map((player) => (
          <g
            key={player.id}
            data-player-id={player.id}
            className={`board-player ${selectedId === player.id ? 'selected' : ''}`}
            transform={`translate(${player.x} ${player.y})`}
            onPointerDown={(event) => handlePlayerDown(event, player)}
            onPointerMove={handlePlayerMove}
            onPointerUp={handlePlayerUp}
            onPointerCancel={handlePlayerUp}
            onDoubleClick={(event) => { event.stopPropagation(); if (player.kind === 'player') onEditPlayer(player) }}
            role="button"
            aria-label={player.kind === 'cone' ? '标志桶，可拖动' : player.kind === 'ball' ? '篮球，可拖动' : `${player.number} 号球员，可拖动，双击修改号码`}
            tabIndex={0}
          >
            {selectedId === player.id && <circle r={player.kind === 'ball' ? 23 : 27} fill="none" stroke="#f5cf55" strokeWidth="3" strokeDasharray="5 4" />}
            <PlayerFigure player={player} />
          </g>
        ))}
      </g>
    </svg>
  )
}
