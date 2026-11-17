import type { AnimationFrame, Player, Shape } from './types'

export const clonePlayers = (players: Player[]): Player[] => players.map((player) => ({ ...player }))
export const cloneShapes = (shapes: Shape[]): Shape[] => shapes.map((shape) => ({
  ...shape,
  points: shape.points.map((point) => ({ ...point })),
}))

export function createAnimationFrame(players: Player[], shapes: Shape[], index: number): AnimationFrame {
  return {
    id: `frame-${Date.now()}-${index}`,
    name: `第 ${index + 1} 帧`,
    players: clonePlayers(players),
    shapes: cloneShapes(shapes),
  }
}

export function interpolatePlayers(from: Player[], to: Player[], progress: number): Player[] {
  const result: Player[] = []
  const toPlayers = new Map(to.map((player) => [player.id, player]))
  const fromIds = new Set(from.map((player) => player.id))

  from.forEach((start) => {
    const end = toPlayers.get(start.id)
    if (!end) {
      if (progress < 0.5) result.push({ ...start })
      return
    }
    result.push({
      ...(progress < 0.5 ? start : end),
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    })
  })

  if (progress >= 0.5) {
    to.forEach((player) => {
      if (!fromIds.has(player.id)) result.push({ ...player })
    })
  }
  return result
}
