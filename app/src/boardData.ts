import type { BoardState, CourtMode, Player, Shape } from './types'

export const TEAM_COLORS = ['#d84b3e', '#2868b2', '#e6c434', '#eee9d8', '#292e28']
export const DRAW_COLORS = ['#f4efdc', '#252b25', '#e3b93e', '#d84b3e', '#3984c6']

const player = (id: string, number: string, color: string, x: number, y: number): Player => ({
  id,
  number,
  color,
  x,
  y,
  kind: 'player',
})

export function createPlayers(mode: CourtMode): Player[] {
  const full = mode === 'full'
  const red = full
    ? [[690, 120], [805, 280], [690, 440], [875, 180], [875, 380]]
    : [[230, 120], [355, 280], [230, 440], [435, 180], [435, 380]]
  const blue = full
    ? [[755, 160], [715, 330], [610, 280], [825, 230], [825, 345]]
    : [[290, 160], [265, 340], [160, 280], [375, 230], [375, 345]]

  return [
    ...red.map(([x, y], index) => player(`red-${index + 1}`, String(index + 1), TEAM_COLORS[0], x, y)),
    ...blue.map(([x, y], index) => player(`blue-${index + 1}`, String(index + 1), TEAM_COLORS[1], x, y)),
    { id: 'ball-1', number: '', color: '#d77b27', x: full ? 650 : 205, y: 280, kind: 'ball' },
  ]
}

export function createInitialBoard(): BoardState {
  return {
    title: '新建战术方案',
    courtMode: 'full',
    background: 'olive',
    players: createPlayers('full'),
    shapes: [],
    frames: [],
  }
}

function line(id: string, type: Shape['type'], points: Shape['points'], color = '#f4efdc'): Shape {
  return { id, type, points, color }
}

export function applyPreset(board: BoardState, preset: string): BoardState {
  const players = createPlayers(board.courtMode)
  const full = board.courtMode === 'full'
  const shift = full ? 500 : 0
  let shapes: Shape[] = []
  let title = board.title

  if (preset === 'pick-roll') {
    title = '挡拆配合'
    shapes = [
      line('preset-1', 'arrow', [{ x: 185 + shift, y: 280 }, { x: 330 + shift, y: 280 }]),
      line('preset-2', 'arrow', [{ x: 330 + shift, y: 280 }, { x: 360 + shift, y: 150 }]),
      line('preset-3', 'screen', [{ x: 295 + shift, y: 310 }, { x: 295 + shift, y: 250 }]),
    ]
  } else if (preset === 'fast-break') {
    title = '快攻推进'
    shapes = [
      line('preset-1', 'dribble', [{ x: 170 + shift, y: 280 }, { x: 355 + shift, y: 170 }]),
      line('preset-2', 'arrow', [{ x: 230 + shift, y: 440 }, { x: 430 + shift, y: 390 }]),
      line('preset-3', 'arrow', [{ x: 230 + shift, y: 120 }, { x: 430 + shift, y: 110 }]),
      line('preset-4', 'pass', [{ x: 355 + shift, y: 170 }, { x: 450 + shift, y: 280 }], '#e3b93e'),
    ]
  } else if (preset === 'zone') {
    title = '2–3 区域联防'
    const positions = full
      ? [[730, 170], [730, 390], [820, 280], [910, 150], [910, 410]]
      : [[230, 170], [230, 390], [320, 280], [410, 150], [410, 410]]
    positions.forEach(([x, y], index) => {
      players[index + 5].x = x
      players[index + 5].y = y
    })
    shapes = [
      line('preset-1', 'screen', [{ x: 275 + shift, y: 135 }, { x: 275 + shift, y: 425 }], '#e3b93e'),
      line('preset-2', 'screen', [{ x: 390 + shift, y: 110 }, { x: 390 + shift, y: 450 }], '#e3b93e'),
    ]
  }

  return { ...board, title, players, shapes }
}

export function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem('basketball-tactical-board-v1')
    if (!raw) return createInitialBoard()
    const saved = JSON.parse(raw) as BoardState
    if (!Array.isArray(saved.players) || !Array.isArray(saved.shapes)) return createInitialBoard()
    return { ...saved, frames: Array.isArray(saved.frames) ? saved.frames : [] }
  } catch {
    return createInitialBoard()
  }
}
