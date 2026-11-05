import { BLOCKS, type BlockId } from "../core/world/blocks";

interface Props {
  selected: BlockId;
  onSelect: (id: BlockId) => void;
}

export function Hotbar({ selected, onSelect }: Props) {
  return (
    <div className="hotbar" role="toolbar" aria-label="Block selection">
      {BLOCKS.map((block, index) => (
        <button
          className={`hotbar-slot ${selected === block.id ? "selected" : ""}`}
          key={block.id}
          onClick={() => onSelect(block.id)}
          title={`${block.name} (${index + 1})`}
          aria-label={`Select ${block.name}`}
          aria-pressed={selected === block.id}
        >
          <span className={`block-swatch ${block.id}`} style={{ backgroundColor: block.swatch }} />
          <span className="slot-number">{index + 1}</span>
        </button>
      ))}
    </div>
  );
}
