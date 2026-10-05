/**
 * Every icon comes from Iconify's Phosphor set (regular weight, with fill
 * variants for active navigation), compiled at build time by unplugin-icons.
 * The thin, even stroke matches the printed, editorial look.
 */
import type { ComponentType, SVGProps } from "react";

import House from "~icons/ph/house";
import HouseFill from "~icons/ph/house-fill";
import Books from "~icons/ph/books";
import BooksFill from "~icons/ph/books-fill";
import Brain from "~icons/ph/brain";
import BrainFill from "~icons/ph/brain-fill";
import Timer from "~icons/ph/timer";
import TimerFill from "~icons/ph/timer-fill";
import ChartBar from "~icons/ph/chart-bar";
import ChartBarFill from "~icons/ph/chart-bar-fill";
import PlusCircle from "~icons/ph/plus-circle";
import Sun from "~icons/ph/sun";
import Moon from "~icons/ph/moon";
import Fire from "~icons/ph/fire";
import FireFill from "~icons/ph/fire-fill";
import Lightning from "~icons/ph/lightning";
import CheckCircle from "~icons/ph/check-circle";
import XCircle from "~icons/ph/x-circle";
import Info from "~icons/ph/info";
import Trophy from "~icons/ph/trophy";
import Star from "~icons/ph/star";
import StarFill from "~icons/ph/star-fill";
import Sparkle from "~icons/ph/sparkle";
import MagnifyingGlass from "~icons/ph/magnifying-glass";
import DotsThree from "~icons/ph/dots-three";
import Trash from "~icons/ph/trash";
import Copy from "~icons/ph/copy";
import PencilSimple from "~icons/ph/pencil-simple";
import DownloadSimple from "~icons/ph/download-simple";
import UploadSimple from "~icons/ph/upload-simple";
import Clock from "~icons/ph/clock";
import ArrowCounterClockwise from "~icons/ph/arrow-counter-clockwise";
import Cards from "~icons/ph/cards";
import Target from "~icons/ph/target";
import Lightbulb from "~icons/ph/lightbulb";
import GraduationCap from "~icons/ph/graduation-cap";
import FloppyDisk from "~icons/ph/floppy-disk";
import ClipboardText from "~icons/ph/clipboard-text";
import MagicWand from "~icons/ph/magic-wand";
import ListChecks from "~icons/ph/list-checks";
import Shuffle from "~icons/ph/shuffle";
import ArrowUUpLeft from "~icons/ph/arrow-u-up-left";
import Pause from "~icons/ph/pause";
import Play from "~icons/ph/play";
import SkipForward from "~icons/ph/skip-forward";
import Coffee from "~icons/ph/coffee";
import FlowerLotus from "~icons/ph/flower-lotus";
import Monitor from "~icons/ph/monitor";
import SpeakerHigh from "~icons/ph/speaker-high";
import Vibrate from "~icons/ph/vibrate";
import UsersThree from "~icons/ph/users-three";
import Medal from "~icons/ph/medal";
import Eye from "~icons/ph/eye";
import Crown from "~icons/ph/crown";
import BookmarkSimple from "~icons/ph/bookmark-simple";
import PersonSimpleWalk from "~icons/ph/person-simple-walk";
import Flag from "~icons/ph/flag";
import Broadcast from "~icons/ph/broadcast";
import GameController from "~icons/ph/game-controller";
import Gear from "~icons/ph/gear";
import Warning from "~icons/ph/warning";
import RocketLaunch from "~icons/ph/rocket-launch";
import NotePencil from "~icons/ph/note-pencil";
import CaretLeft from "~icons/ph/caret-left";
import CaretRight from "~icons/ph/caret-right";
import ArrowRight from "~icons/ph/arrow-right";
import ArrowLeft from "~icons/ph/arrow-left";
import FileText from "~icons/ph/file-text";
import FileArrowUp from "~icons/ph/file-arrow-up";
import LockSimple from "~icons/ph/lock-simple";
import SquaresFour from "~icons/ph/squares-four";
import Scan from "~icons/ph/scan";
import Notebook from "~icons/ph/notebook";
import Alarm from "~icons/ph/alarm";
import Minus from "~icons/ph/minus";
import X from "~icons/ph/x";
import Check from "~icons/ph/check";
import Plus from "~icons/ph/plus";
import DotsSixVertical from "~icons/ph/dots-six-vertical";
import PuzzlePiece from "~icons/ph/puzzle-piece";
import DiamondFill from "~icons/ph/diamond-fill";
import TriangleFill from "~icons/ph/triangle-fill";
import CircleFill from "~icons/ph/circle-fill";
import SquareFill from "~icons/ph/square-fill";
import SealCheck from "~icons/ph/seal-check";
import PencilLine from "~icons/ph/pencil-line";

// Deck glyphs
import BookOpen from "~icons/ph/book-open";
import Flask from "~icons/ph/flask";
import Globe from "~icons/ph/globe-hemisphere-west";
import Calculator from "~icons/ph/calculator";
import Palette from "~icons/ph/palette";
import Dna from "~icons/ph/dna";
import Atom from "~icons/ph/atom";
import Scroll from "~icons/ph/scroll";
import MusicNotes from "~icons/ph/music-notes";
import Code from "~icons/ph/code";
import Bank from "~icons/ph/bank";
import Heartbeat from "~icons/ph/heartbeat";
import Scales from "~icons/ph/scales";
import ChartLineUp from "~icons/ph/chart-line-up";
import Translate from "~icons/ph/translate";
import ChatCircleText from "~icons/ph/chat-circle-text";
import Leaf from "~icons/ph/leaf";
import Planet from "~icons/ph/planet";

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const I = {
  home: House,
  homeFill: HouseFill,
  library: Books,
  libraryFill: BooksFill,
  review: Brain,
  reviewFill: BrainFill,
  focus: Timer,
  focusFill: TimerFill,
  progress: ChartBar,
  progressFill: ChartBarFill,
  create: PlusCircle,
  sun: Sun,
  moon: Moon,
  fire: Fire,
  fireFill: FireFill,
  bolt: Lightning,
  success: CheckCircle,
  error: XCircle,
  info: Info,
  award: Trophy,
  star: StarFill,
  starOutline: Star,
  sparkle: Sparkle,
  search: MagnifyingGlass,
  more: DotsThree,
  trash: Trash,
  copy: Copy,
  edit: PencilSimple,
  import: DownloadSimple,
  export: UploadSimple,
  clock: Clock,
  restart: ArrowCounterClockwise,
  cards: Cards,
  target: Target,
  hint: Lightbulb,
  cap: GraduationCap,
  save: FloppyDisk,
  paste: ClipboardText,
  magic: MagicWand,
  checklist: ListChecks,
  shuffle: Shuffle,
  undo: ArrowUUpLeft,
  pause: Pause,
  play: Play,
  skip: SkipForward,
  coffee: Coffee,
  meditate: FlowerLotus,
  monitor: Monitor,
  sound: SpeakerHigh,
  haptics: Vibrate,
  users: UsersThree,
  medal: Medal,
  eye: Eye,
  crown: Crown,
  bookmark: BookmarkSimple,
  walking: PersonSimpleWalk,
  flag: Flag,
  live: Broadcast,
  game: GameController,
  settings: Gear,
  warning: Warning,
  trophy: Trophy,
  rocket: RocketLaunch,
  compose: NotePencil,
  back: CaretLeft,
  chevron: CaretRight,
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  document: FileText,
  upload: FileArrowUp,
  lock: LockSimple,
  grid: SquaresFour,
  scan: Scan,
  notes: Notebook,
  alarm: Alarm,
  minus: Minus,
  x: X,
  check: Check,
  plus: Plus,
  grip: DotsSixVertical,
  puzzle: PuzzlePiece,
  diamond: DiamondFill,
  triangle: TriangleFill,
  circle: CircleFill,
  square: SquareFill,
  seal: SealCheck,
  write: PencilLine,
} satisfies Record<string, Icon>;

/** Glyphs a deck can use. */
export const DECK_ICONS = {
  book: BookOpen,
  science: Flask,
  globe: Globe,
  math: Calculator,
  art: Palette,
  biology: Dna,
  physics: Atom,
  history: Scroll,
  music: MusicNotes,
  code: Code,
  civics: Bank,
  health: Heartbeat,
  law: Scales,
  data: ChartLineUp,
  language: Translate,
  speech: ChatCircleText,
  nature: Leaf,
  space: Planet,
  idea: Lightbulb,
  rocket: RocketLaunch,
} satisfies Record<string, Icon>;

export type DeckIconKey = keyof typeof DECK_ICONS;

/** Printed-ink palette (see --sys-* in index.css). Keys are kept stable for saved decks. */
export const COLORS = ["blue", "indigo", "purple", "pink", "red", "orange", "yellow", "green", "mint", "teal", "gray"] as const;
export type ColorKey = (typeof COLORS)[number];
export const colorVar = (c: ColorKey) => `var(--sys-${c})`;
