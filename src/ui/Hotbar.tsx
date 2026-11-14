import { getBlockDefinition, type BlockId } from "../core/world/blocks";

interface Props {
  /** 9 个快捷格当前装的方块，顺序即格子顺序 */
  slots: readonly BlockId[];
  activeSlot: number;
  selected: BlockId;
  onSelectSlot: (index: number) => void;
  onTogglePalette: () => void;
  paletteOpen: boolean;
}

/** V0.6.1（DDR-0002）：MC 式 9 格快捷栏 + 「所有方块」分类入口。 */
export function Hotbar({
  slots, activeSlot, selected, onSelectSlot, onTogglePalette, paletteOpen,
}: Props) {
  return (
    <div className="hotbar" role="toolbar" aria-label="Block selection">
      {slots.map((id, index) => {
        const block = getBlockDefinition(id);
        const isActive = activeSlot === index && selected === id;
        return (
          <button
            className={`hotbar-slot ${isActive ? "selected" : ""}`}
            key={`${index}-${id}`}
            onClick={() => onSelectSlot(index)}
            title={`${block.name} (${index + 1})`}
            aria-label={`Select ${block.name}`}
            aria-pressed={isActive}
          >
            <span className={`block-swatch ${block.id}`} style={{ backgroundColor: block.swatch }} />
            <span className="slot-number">{index + 1}</span>
          </button>
        );
      })}
      <button
        className={`hotbar-slot hotbar-palette-toggle${paletteOpen ? " selected" : ""}`}
        onClick={onTogglePalette}
        aria-label="All blocks"
        aria-expanded={paletteOpen}
        aria-pressed={paletteOpen}
        title="All blocks by category (E)"
      >
        <span className="hotbar-palette-icon" aria-hidden="true">▦</span>
        <span className="slot-number">E</span>
      </button>
    </div>
  );
}
