import { getBlockDefinition, type BlockId } from "../core/world/blocks";
import { BLOCK_GROUPS } from "../core/world/blockCategories";

interface Props {
  activeSlot: number;
  assigned: readonly BlockId[];
  onAssign: (id: BlockId) => void;
  onClose: () => void;
}

/** MC 式「所有方块」面板：按类别浏览，点一下放进当前选中的快捷格。 */
export function BlockPalette({ activeSlot, assigned, onAssign, onClose }: Props) {
  return (
    <section className="block-palette" aria-label="All blocks">
      <header className="block-palette-head">
        <span className="block-palette-title">所有方块 · 按类别</span>
        <span className="block-palette-hint">点一个方块，放进第 {activeSlot + 1} 格</span>
        <button className="block-palette-close" onClick={onClose} aria-label="Close all blocks">×</button>
      </header>
      {BLOCK_GROUPS.map((group) => (
        <div className="block-palette-group" key={group.id}>
          <div className="block-palette-group-label">{group.label}</div>
          <div className="block-palette-grid">
            {group.blockIds.map((id) => {
              const block = getBlockDefinition(id);
              const inSlot = assigned.indexOf(id);
              return (
                <button
                  key={id}
                  className={`block-palette-item${inSlot >= 0 ? " in-quickbar" : ""}`}
                  aria-label={`Assign ${block.name} to slot ${activeSlot + 1}`}
                  title={`${block.name}（放进第 ${activeSlot + 1} 格）`}
                  onClick={() => onAssign(id)}
                >
                  <span className={`block-swatch ${block.id}`} style={{ backgroundColor: block.swatch }} />
                  <span className="block-palette-item-name">{block.name}</span>
                  {inSlot >= 0 && <span className="block-palette-item-slot">{inSlot + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
