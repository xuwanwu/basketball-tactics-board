export type CourtMode = 'full' | 'half'
export type BackgroundTheme = 'olive' | 'midnight'
export type Tool = 'select' | 'arrow' | 'pass' | 'dribble' | 'screen' | 'freehand' | 'text' | 'erase'
export type ShapeType = Exclude<Tool, 'select' | 'text' | 'erase'> | 'text'

export interface Point {
  x: number
  y: number
}

export interface Player {
  id: string
  number: string
  color: string
  x: number
  y: number
  kind: 'player' | 'ball' | 'cone'
}

export interface Shape {
  id: string
  type: ShapeType
  points: Point[]
  color: string
  text?: string
}

export interface AnimationFrame {
  id: string
  name: string
  players: Player[]
  shapes: Shape[]
}

export interface BoardState {
  title: string
  courtMode: CourtMode
  background: BackgroundTheme
  players: Player[]
  shapes: Shape[]
  frames: AnimationFrame[]
}

export interface CourtGeometry {
  width: number
  height: number
}
