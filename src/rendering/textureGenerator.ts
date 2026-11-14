import * as THREE from "three";


/**
 * V042-007 程序化纹理生成器。
 *
 * 按 V0.4.2 Visual Style Guide v1.0 第 5 条："Use hand-authored or
 * procedurally generated original textures." 使用 Canvas 2D 在运行时/构建时
 * 程序化生成 16×16 原创纹理，无外部资产文件依赖。
 *
 * 纹理设计依据 V042-004 视觉评论的关键修复项：
 * - Meadow Grass：花朵 ≥2 且分布不对称，草叶 ≥3 种绿色变化（原创性强化）
 * - Gravel vs Layered Stone：明度分离 ≥15%
 * - 全部纹理低噪点、控制像素簇（"Crafted, not noisy"）
 *
 * 每个纹理函数接收 16×16 的 ImageData 画布，逐像素写入颜色。
 */

const TEX_SIZE = 16;

type PixelWriter = (x: number, y: number) => string; // 返回 CSS 颜色


/** 确定性伪随机数（同一 seed 稳定输出，避免每次运行纹理漂移） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 用像素写入函数生成一个 16×16 canvas */
function generateCanvas(writer: PixelWriter): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      ctx.fillStyle = writer(x, y);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/* ---------- 各方块纹理绘制函数 ---------- */

/** Meadow Grass top：草叶杂色（3 种绿）+ 2 朵不对称白花（V042-004 关键修复 #3） */
function grassTop(): HTMLCanvasElement {
  const rng = mulberry32(42);
  const greens = ["#79A943", "#6E9C3C", "#84B54C"]; // 3 种绿色变化
  // 白花位置不对称：(3,4) 和 (11,10)
  const flowers = new Set(["3,4", "11,10", "4,4", "3,5", "11,11", "12,10"]);
  return generateCanvas((x, y) => {
    if (flowers.has(`${x},${y}`)) return "#F5F0E0"; // 花瓣
    if (x === 3 && y === 6) return "#E6A23B"; // 花蕊
    if (x === 11 && y === 12) return "#E6A23B"; // 花蕊
    const idx = Math.floor(rng() * greens.length);
    return greens[idx];
  });
}

/** Meadow Grass side：上 1/4 绿草缘 + 下 3/4 棕色土壤 */
function grassSide(): HTMLCanvasElement {
  const rng = mulberry32(43);
  const greens = ["#79A943", "#6E9C3C", "#84B54C"];
  const browns = ["#80502F", "#8B6346", "#754a2a"];
  return generateCanvas((_x, y) => {
    if (y < 4) return greens[Math.floor(rng() * greens.length)];
    return browns[Math.floor(rng() * browns.length)];
  });
}

/** Dark Soil：深棕色低噪点土壤（top/side/bottom 共用图案） */
function darkSoil(): HTMLCanvasElement {
  const rng = mulberry32(44);
  const browns = ["#80502F", "#75482A", "#8A5A36", "#6E4326"];
  return generateCanvas((_x, _y) => browns[Math.floor(rng() * browns.length)]);
}

/** Layered Stone：灰色层状石块（水平岩层 + 砌缝暗线） */
function layeredStone(): HTMLCanvasElement {
  const rng = mulberry32(45);
  const grays = ["#8A8C8E", "#7E8284", "#94969A"];
  return generateCanvas((_x, y) => {
    // 每 4 行一个岩层，层间暗缝
    if (y % 4 === 0) return "#5F6365";
    // 层内偶有暗色裂纹
    if (rng() < 0.08) return "#6B6F71";
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** Honey Oak：暖金黄水平木板纹（板间暗缝 + 木纹纤维） */
function honeyOak(): HTMLCanvasElement {
  const rng = mulberry32(46);
  const tones = ["#B77A3E", "#C28548", "#AA7038"];
  return generateCanvas((_x, y) => {
    if (y % 5 === 0) return "#8A5A2E"; // 板缝
    if (rng() < 0.06) return "#9A6636"; // 木纹纤维
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Clay Brick：橙红砖 + 浅灰缝交错砌法（行错位，与参照保持差异） */
function clayBrick(): HTMLCanvasElement {
  const rng = mulberry32(47);
  const bricks = ["#B85D3C", "#C26744", "#AC5436"];
  return generateCanvas((x, y) => {
    const row = Math.floor(y / 4);
    const offset = row % 2 === 0 ? 0 : 4; // 交错砌法（错位 4px）
    if (y % 4 === 3) return "#D9CFC0"; // 水平缝
    if ((x + offset) % 8 === 0) return "#D9CFC0"; // 垂直缝
    if (rng() < 0.05) return "#A04E30"; // 砖面杂色
    return bricks[Math.floor(rng() * bricks.length)];
  });
}

/** Foundation Concrete：素灰混凝土 + 微噪点（无装饰，"地基"角色） */
function foundationConcrete(): HTMLCanvasElement {
  const rng = mulberry32(48);
  const grays = ["#C0C0C0", "#B8B8B8", "#C8C8C8", "#BEBEBE"];
  return generateCanvas((_x, _y) => grays[Math.floor(rng() * grays.length)]);
}

/** Window Frame side：木框 + 中心蓝色玻璃窗格 */
function windowFrameSide(): HTMLCanvasElement {
  const rng = mulberry32(49);
  const timber = ["#B77A3E", "#AA7038"];
  const glass = "#A8D8E8";
  return generateCanvas((x, y) => {
    const inFrame = x < 3 || x > 12 || y < 3 || y > 12; // 3px 木框
    if (inFrame) return timber[Math.floor(rng() * timber.length)];
    // 窗格十字条
    if (x === 7 || x === 8 || y === 7 || y === 8) return "#8A5A2E";
    return glass;
  });
}

/** Stair Block side：石阶纹理（阶梯轮廓暗带） */
function stairStoneSide(): HTMLCanvasElement {
  const rng = mulberry32(50);
  const grays = ["#8A8C8E", "#7E8284", "#94969A"];
  return generateCanvas((x, y) => {
    // 阶梯：左侧高右侧低的暗带轮廓
    const stepEdge = x < 8 ? (y === 3 ? true : false) : (y === 7 ? true : false);
    if (stepEdge) return "#5F6365";
    if (rng() < 0.08) return "#6B6F71";
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** Gravel：碎石颗粒（高对比颗粒，与 Layered Stone 明度分离 ≥15%，关键修复 #4） */
function gravel(): HTMLCanvasElement {
  const rng = mulberry32(51);
  const lightGrays = ["#B5B5B5", "#A8A8A8", "#C2C2C2"];
  return generateCanvas((_x, _y) => {
    if (rng() < 0.15) return "#787878"; // 颗粒间阴影，增强对比
    return lightGrays[Math.floor(rng() * lightGrays.length)];
  });
}

/** Warm Sandstone：暖米色砂岩分层 */
function warmSandstone(): HTMLCanvasElement {
  const rng = mulberry32(52);
  const tones = ["#D4C49E", "#CCBC96", "#DCCEA8"];
  return generateCanvas((_x, y) => {
    if (y % 6 === 0) return "#B8A87E"; // 层缝
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Slate Tile：深蓝灰瓦片层叠 */
function slateTile(): HTMLCanvasElement {
  const rng = mulberry32(53);
  const tones = ["#454D5B", "#3E4652", "#4C5564"];
  return generateCanvas((_x, y) => {
    if (y % 4 === 0) return "#323A46"; // 瓦缝
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Walnut Timber：深棕胡桃木水平板纹 */
function walnutTimber(): HTMLCanvasElement {
  const rng = mulberry32(54);
  const tones = ["#70452E", "#7A4C34", "#663E28"];
  return generateCanvas((_x, y) => {
    if (y % 5 === 0) return "#52321F"; // 板缝
    if (rng() < 0.06) return "#5E3A24"; // 木纹
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Limestone Brick：米白大块石 */
function limestoneBrick(): HTMLCanvasElement {
  const rng = mulberry32(55);
  const tones = ["#D9C79E", "#D1BF96", "#E0CFA6"];
  return generateCanvas((x, y) => {
    const row = Math.floor(y / 4);
    const offset = row % 2 === 0 ? 0 : 4;
    if (y % 4 === 3) return "#BFB292"; // 缝
    if ((x + offset) % 8 === 0) return "#BFB292";
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Moss Rock：灰石 + 苔藓绿斑块 */
function mossRock(): HTMLCanvasElement {
  const rng = mulberry32(56);
  const grays = ["#8A8C8E", "#7E8284"];
  const moss = ["#6B8E23", "#5E8020"];
  return generateCanvas((x, y) => {
    // 苔藓簇：以 (4,4) 和 (11,9) 为中心的斑块
    const d1 = (x - 4) * (x - 4) + (y - 4) * (y - 4);
    const d2 = (x - 11) * (x - 11) + (y - 9) * (y - 9);
    if (d1 < 9 || d2 < 12) return moss[Math.floor(rng() * moss.length)];
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** Plaster Wall：浅米灰泥 + 底边踢脚线 */
function plasterWall(): HTMLCanvasElement {
  const rng = mulberry32(57);
  const tones = ["#E8E8D8", "#E0E0D0", "#EDEDDF"];
  return generateCanvas((_x, y) => {
    if (y >= 13) return "#8A5A2E"; // 底部踢脚线
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Timber Frame Wall side：深木框架 + 米色填充（半木结构） */
function timberFrameSide(): HTMLCanvasElement {
  const rng = mulberry32(58);
  const timber = "#70452E";
  const infill = ["#E0D5B8", "#D8CCAE"];
  return generateCanvas((x, y) => {
    // 外框 + 对角支撑
    if (x < 2 || x > 13 || y < 2 || y > 13) return timber;
    if (Math.abs(x - y) < 2 || Math.abs(x + y - 15) < 2) return timber; // 对角撑
    return infill[Math.floor(rng() * infill.length)];
  });
}

/** Tunnel Lining：拱形衬砌（顶部拱带） */
function tunnelLining(): HTMLCanvasElement {
  const rng = mulberry32(59);
  const stone = ["#454D5B", "#3E4652"];
  const mortar = "#323A46";
  return generateCanvas((x, y) => {
    // 拱形带：距中心 (8, 16) 半径 10-13 的弧带
    const dx = x - 8;
    const dy = y - 16;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 9 && dist < 13) {
      if (rng() < 0.2) return mortar;
      return stone[Math.floor(rng() * stone.length)];
    }
    return mortar;
  });
}

/** Pillar side：方形石柱（竖向凹槽） */
function pillarSide(): HTMLCanvasElement {
  const rng = mulberry32(60);
  const grays = ["#8A8C8E", "#7E8284"];
  return generateCanvas((x, _y) => {
    if (x === 4 || x === 11) return "#5F6365"; // 竖向凹槽
    if (rng() < 0.08) return "#6B6F71";
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** Arch Keystone side：拱心石（楔形纹） */
function archKeystoneSide(): HTMLCanvasElement {
  const rng = mulberry32(61);
  const grays = ["#8A8C8E", "#7E8284"];
  return generateCanvas((x, y) => {
    // 中心楔形亮带
    if (Math.abs(x - 8) < 2 && y > 2) return "#9EA0A4";
    if (rng() < 0.08) return "#6B6F71";
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** Footing Carved side：雕刻基座（底边凹台） */
function footingCarvedSide(): HTMLCanvasElement {
  const rng = mulberry32(62);
  const grays = ["#8A8C8E", "#7E8284"];
  return generateCanvas((x, y) => {
    if (y === 0 || y === 15) return "#5F6365"; // 上下凹台
    if ((x < 3 || x > 12) && y > 12) return "#5F6365"; // 底部凹台
    if (rng() < 0.08) return "#6B6F71";
    return grays[Math.floor(rng() * grays.length)];
  });
}

/** 单色土壤 bottom（草地 bottom 与 dirt 相同） */
function soilBottom(): HTMLCanvasElement {
  return darkSoil();
}

/* ---------- V0.5 水工程方块纹理 ---------- */

/** Water Source top：深蓝水面 + 同心波纹（原创，非参照像素） */
function waterSourceTop(): HTMLCanvasElement {
  const rng = mulberry32(70);
  const tones = ["#2E6BB8", "#3576C6", "#3B7DD8"];
  return generateCanvas((x, y) => {
    const dist = Math.max(Math.abs(x - 8), Math.abs(y - 8)); // 切比雪夫同心环
    if (dist % 3 === 0 && rng() < 0.6) return "#4A8CE4"; // 波纹亮环
    return tones[Math.floor(rng() * tones.length)];
  });
}

/** Water Source side：石砌井壁 + 中部水面带 */
function waterSourceSide(): HTMLCanvasElement {
  const rng = mulberry32(71);
  const stone = ["#7E8284", "#8A8C8E"];
  return generateCanvas((_x, y) => {
    if (y >= 6 && y <= 9) return y === 6 || y === 9 ? "#2456A0" : ["#2E6BB8", "#3B7DD8"][Math.floor(rng() * 2)];
    if (y % 5 === 0) return "#5F6365"; // 石缝
    return stone[Math.floor(rng() * stone.length)];
  });
}

/** Drain Channel top：石板 + 中央凹槽（深色导水槽） */
function drainChannelTop(): HTMLCanvasElement {
  const rng = mulberry32(72);
  const stone = ["#6E7580", "#787F8A", "#646B76"];
  return generateCanvas((x, y) => {
    if (y >= 6 && y <= 9) {
      if (x % 5 === 0) return "#4A505A"; // 槽内横档
      return "#3E444E"; // 凹槽
    }
    return stone[Math.floor(rng() * stone.length)];
  });
}

/** Drain Channel side：石板 + 侧面槽口开口 */
function drainChannelSide(): HTMLCanvasElement {
  const rng = mulberry32(73);
  const stone = ["#6E7580", "#787F8A"];
  return generateCanvas((x, y) => {
    if (y >= 7 && y <= 10 && (x <= 2 || x >= 13)) return "#3E444E"; // 两端槽口
    if (y % 5 === 0) return "#525860";
    return stone[Math.floor(rng() * stone.length)];
  });
}

/** Water Pipe side：石壳 + 竖向蓝色管道 */
function waterPipeSide(): HTMLCanvasElement {
  const rng = mulberry32(74);
  const shell = ["#8A8C8E", "#7E8284"];
  return generateCanvas((x, y) => {
    if (x >= 5 && x <= 10) {
      if (x === 5 || x === 10) return "#2E5E8C"; // 管缘
      return (x + y) % 4 === 0 ? "#4A90C2" : "#4186B8"; // 管身高光
    }
    return shell[Math.floor(rng() * shell.length)];
  });
}

/** Water Pipe cap：石壳 + 蓝色管口圆环 */
function waterPipeCap(): HTMLCanvasElement {
  const rng = mulberry32(75);
  const shell = ["#8A8C8E", "#7E8284"];
  return generateCanvas((x, y) => {
    const dist = (x - 8) * (x - 8) + (y - 8) * (y - 8);
    if (dist < 9) return "#2E5E8C"; // 管口
    if (dist < 16) return "#4A90C2"; // 环带
    return shell[Math.floor(rng() * shell.length)];
  });
}

/* ---------- V0.6.1 电力 / 水联动方块：16×16 程序化原创纹样（V061-007） ----------
 * 设计：V061_Block_Style_Board.md §1/§2 / ADR-0013 决策 1~4。
 * - 每个 ID 恰有 top + side 两个专属绘制函数，bottom 复用既有共享函数 → 9×2 = +18 格。
 * - 图案由确定性坐标判据构成，底色用 mulberry32 固定 seed 做低噪点色差（"Crafted, not noisy"）。
 * - 通电态不进图集：逐段点亮由派生 overlay / 独立材质实例完成，绝不烘焙第二套纹理。
 * - 形状（触点 / 闸板 / 叶轮 / 十字）是双态主区分手段，颜色只作辅助，满足 AC-6735。
 */
interface ElectricalFaceSpec {
  seed: number;
  tones: readonly string[];
  motif: (x: number, y: number) => string | null;
}

function electricalFace(spec: ElectricalFaceSpec): () => HTMLCanvasElement {
  return () => {
    const rng = mulberry32(spec.seed);
    return generateCanvas((x, y) =>
      spec.motif(x, y) ?? spec.tones[Math.floor(rng() * spec.tones.length)]
    );
  };
}

/** 电源：深石底 + 中心暖金圆符号 + 四角铆钉（源恒供，不做灭态）。 */
const powerSourceTop = electricalFace({
  seed: 90, tones: ["#4A4A52", "#53535C", "#42424A"],
  motif: (x, y) => {
    const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
    if (d >= 16 && d <= 25) return "#E6B44A";
    if (d < 9) return "#8A6A2E";
    if ((x === 1 || x === 14) && (y === 1 || y === 14)) return "#C9A15B";
    return null;
  },
});
const powerSourceSide = electricalFace({
  seed: 91, tones: ["#4A4A52", "#53535C"],
  motif: (_x, y) => (y === 0 || y === 15 ? "#2F2F36" : null),
});

/** 电线：浅石灰底 + 中央深灰细线十字（六向暗示，通电时逐段点亮）。 */
const wireTop = electricalFace({
  seed: 92, tones: ["#C4BDA6", "#BDB69F", "#CDC6AF"],
  motif: (x, y) => {
    if (x >= 6 && x <= 9 && y >= 6 && y <= 9) return "#3E3C36";
    if (x === 7 || x === 8 || y === 7 || y === 8) return "#5A574E";
    return null;
  },
});
const wireSide = electricalFace({
  seed: 93, tones: ["#C4BDA6", "#BDB69F"],
  motif: (_x, y) => (y === 7 || y === 8 ? "#5A574E" : y % 5 === 0 ? "#A9A28D" : null),
});

/** 开关（断开）：石底 + 明显错开的两触点 + 抬起的拨杆。 */
const switchOpenTop = electricalFace({
  seed: 94, tones: ["#6E7378", "#757A80", "#676C71"],
  motif: (x, y) => {
    if (x >= 2 && x <= 4 && y >= 8 && y <= 10) return "#D8C58A";
    if (x >= 11 && x <= 13 && y >= 3 && y <= 5) return "#D8C58A";
    if (x >= 4 && x <= 10 && y === 13 - Math.floor((x - 4) / 2)) return "#B9A67A";
    return null;
  },
});
const switchOpenSide = electricalFace({
  seed: 95, tones: ["#6E7378", "#757A80"],
  motif: (x, y) => (x >= 4 && x <= 10 && y === 12 - Math.floor((x - 4) / 2) ? "#B9A67A" : null),
});

/** 开关（合上）：同石底 + 两触点接通 + 放平的拨杆。 */
const switchClosedTop = electricalFace({
  seed: 96, tones: ["#6E7378", "#757A80", "#676C71"],
  motif: (x, y) => {
    if (y >= 7 && y <= 8 && x >= 2 && x <= 13) return "#D8C58A";
    if (x >= 6 && x <= 9 && y >= 4 && y <= 5) return "#B9A67A";
    return null;
  },
});
const switchClosedSide = electricalFace({
  seed: 97, tones: ["#6E7378", "#757A80"],
  motif: (_x, y) => (y === 7 || y === 8 ? "#D8C58A" : null),
});

/** 灯：灰白灯罩 + 暗芯（通电态由独立材质实例 emissive / overlay 呈现，不烘焙第二套）。 */
const lampTop = electricalFace({
  seed: 98, tones: ["#D8D4C4", "#D2CEBE", "#E0DCCC"],
  motif: (x, y) => {
    const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
    if (d < 9) return "#4A4A44";
    if (x === 0 || x === 15 || y === 0 || y === 15) return "#A9A69A";
    return null;
  },
});
const lampSide = electricalFace({
  seed: 99, tones: ["#D8D4C4", "#D2CEBE"],
  motif: (_x, y) => (y >= 6 && y <= 9 ? "#4A4A44" : y === 0 || y === 15 ? "#A9A69A" : null),
});

/** 信标：深色柱体 + 暗色顶窗 + 上向短条（形状而非发光仪表盘）。 */
const beaconTop = electricalFace({
  seed: 100, tones: ["#3F4A54", "#45515C", "#39434C"],
  motif: (x, y) => {
    if (x >= 5 && x <= 10 && y >= 5 && y <= 10) return "#2B333B";
    if (x === 7 || x === 8) return "#5C6B78";
    return null;
  },
});
const beaconSide = electricalFace({
  seed: 101, tones: ["#3F4A54", "#45515C"],
  motif: (x, y) => (y <= 3 ? "#2B333B" : x % 5 === 0 ? "#5C6B78" : null),
});

/** 水泵：蓝灰泵体 + 静止叶轮 + 出口侧金色小标记。 */
const pumpTop = electricalFace({
  seed: 102, tones: ["#4F7F96", "#5889A0", "#48758B"],
  motif: (x, y) => {
    const d = (x - 8) ** 2 + (y - 8) ** 2;
    if (d < 16 && (x + y) % 3 === 0) return "#8FC0D6";
    if (d >= 16 && d <= 25) return "#2E5E7C";
    if (x >= 13 && y >= 6 && y <= 9) return "#E6B44A";
    return null;
  },
});
const pumpSide = electricalFace({
  seed: 103, tones: ["#4F7F96", "#5889A0"],
  motif: (x, y) => (x >= 12 && y >= 5 && y <= 10 ? "#E6B44A" : y % 5 === 0 ? "#2E5E7C" : null),
});

/** 阀门（开）：蓝灰阀体 + 通道贯通纹样。 */
const valveOpenTop = electricalFace({
  seed: 104, tones: ["#3F6B82", "#47738B", "#3A6278"],
  motif: (_x, y) => {
    if (y === 5 || y === 10) return "#2E5E7C";
    if (y >= 6 && y <= 9) return "#6FB6D8";
    return null;
  },
});
const valveOpenSide = electricalFace({
  seed: 105, tones: ["#3F6B82", "#47738B"],
  motif: (_x, y) => (y >= 6 && y <= 9 ? "#6FB6D8" : y === 5 || y === 10 ? "#2E5E7C" : null),
});

/** 阀门（闭）：同阀体 + 明显横断闸板（形状区分，不依赖动画或颜色）。 */
const valveClosedTop = electricalFace({
  seed: 106, tones: ["#3F6B82", "#47738B", "#3A6278"],
  motif: (x, y) => {
    if (x >= 7 && x <= 8) return "#213A48";
    if (y >= 6 && y <= 9 && x < 7) return "#4A7F9B";
    if (x === 0 || x === 15) return "#2E5E7C";
    return null;
  },
});
const valveClosedSide = electricalFace({
  seed: 107, tones: ["#3F6B82", "#47738B"],
  motif: (x, y) => (x >= 7 && x <= 8 ? "#213A48" : y === 0 || y === 15 ? "#2E5E7C" : null),
});

/* ---------- 纹理注册表 ---------- */
interface TextureSet {
  top: THREE.CanvasTexture;
  side: THREE.CanvasTexture;
  bottom: THREE.CanvasTexture;
}

/**
 * 垂直切片 + 全部 V0.4.2 块的纹理工厂映射。
 * key = `${blockId}:${face}`
 */
const GENERATORS: Record<string, () => HTMLCanvasElement> = {
  "grass:top": grassTop,
  "grass:side": grassSide,
  "grass:bottom": soilBottom,
  "dirt:top": darkSoil,
  "dirt:side": darkSoil,
  "dirt:bottom": darkSoil,
  "stone:top": layeredStone,
  "stone:side": layeredStone,
  "stone:bottom": layeredStone,
  "wood:top": honeyOak,
  "wood:side": honeyOak,
  "wood:bottom": honeyOak,
  "sand:top": warmSandstone, // sand 复用 sandstone 语法（暖色系）
  "sand:side": warmSandstone,
  "sand:bottom": warmSandstone,
  "brick:top": clayBrick,
  "brick:side": clayBrick,
  "brick:bottom": clayBrick,
  "glass:top": () => generateCanvas(() => "#BFE8EC"),
  "glass:side": () => generateCanvas(() => "#A8DCE4"),
  "glass:bottom": () => generateCanvas(() => "#BFE8EC"),
  "sandstone_warm:top": warmSandstone,
  "sandstone_warm:side": warmSandstone,
  "sandstone_warm:bottom": warmSandstone,
  "rock_moss:top": mossRock,
  "rock_moss:side": mossRock,
  "rock_moss:bottom": mossRock,
  "gravel:top": gravel,
  "gravel:side": gravel,
  "gravel:bottom": gravel,
  "wood_walnut:top": walnutTimber,
  "wood_walnut:side": walnutTimber,
  "wood_walnut:bottom": walnutTimber,
  "brick_limestone:top": limestoneBrick,
  "brick_limestone:side": limestoneBrick,
  "brick_limestone:bottom": limestoneBrick,
  "tile_slate:top": slateTile,
  "tile_slate:side": slateTile,
  "tile_slate:bottom": slateTile,
  "foundation_concrete:top": foundationConcrete,
  "foundation_concrete:side": foundationConcrete,
  "foundation_concrete:bottom": foundationConcrete,
  "footing_carved:top": foundationConcrete,
  "footing_carved:side": footingCarvedSide,
  "footing_carved:bottom": footingCarvedSide,
  "wall_plaster:top": plasterWall,
  "wall_plaster:side": plasterWall,
  "wall_plaster:bottom": plasterWall,
  "wall_timber_frame:top": honeyOak,
  "wall_timber_frame:side": timberFrameSide,
  "wall_timber_frame:bottom": honeyOak,
  "tunnel_lining:top": tunnelLining,
  "tunnel_lining:side": tunnelLining,
  "tunnel_lining:bottom": tunnelLining,
  "pillar_corner:top": layeredStone,
  "pillar_corner:side": pillarSide,
  "pillar_corner:bottom": layeredStone,
  "arch_keystone:top": layeredStone,
  "arch_keystone:side": archKeystoneSide,
  "arch_keystone:bottom": layeredStone,
  "stair_stone:top": layeredStone,
  "stair_stone:side": stairStoneSide,
  "stair_stone:bottom": layeredStone,
  "window_frame:top": honeyOak,
  "window_frame:side": windowFrameSide,
  "window_frame:bottom": honeyOak,

  /* ---------- V0.5 水工程方块 ---------- */
  "water_source:top": waterSourceTop,
  "water_source:side": waterSourceSide,
  "water_source:bottom": waterSourceSide,
  "drain_channel:top": drainChannelTop,
  "drain_channel:side": drainChannelSide,
  "drain_channel:bottom": layeredStone,
  "water_pipe_blue:top": waterPipeCap,
  "water_pipe_blue:side": waterPipeSide,
  "water_pipe_blue:bottom": waterPipeCap,

  /* ---------- V0.6.1 电力 / 水联动方块（V061-007 正式纹样） ----------
   * top / side 为 9 类各自的专属绘制函数（18 个新瓦片）；bottom 一律复用既有共享函数。
   * 通电 / 断电双态不进图集：由派生 overlay 网格与独立材质实例呈现。
   */
  "power_source_low_voltage:top": powerSourceTop,
  "power_source_low_voltage:side": powerSourceSide,
  "power_source_low_voltage:bottom": layeredStone,
  "wire_basic:top": wireTop,
  "wire_basic:side": wireSide,
  "wire_basic:bottom": foundationConcrete,
  "switch_open:top": switchOpenTop,
  "switch_open:side": switchOpenSide,
  "switch_open:bottom": layeredStone,
  "switch_closed:top": switchClosedTop,
  "switch_closed:side": switchClosedSide,
  "switch_closed:bottom": layeredStone,
  "lamp_basic:top": lampTop,
  "lamp_basic:side": lampSide,
  "lamp_basic:bottom": plasterWall,
  "signal_beacon:top": beaconTop,
  "signal_beacon:side": beaconSide,
  "signal_beacon:bottom": layeredStone,
  "water_pump_basic:top": pumpTop,
  "water_pump_basic:side": pumpSide,
  "water_pump_basic:bottom": waterPipeSide,
  "water_valve_open:top": valveOpenTop,
  "water_valve_open:side": valveOpenSide,
  "water_valve_open:bottom": waterPipeSide,
  "water_valve_closed:top": valveClosedTop,
  "water_valve_closed:side": valveClosedSide,
  "water_valve_closed:bottom": waterPipeSide,
};

/**
 * 生成指定方块指定面的 16×16 CanvasTexture。
 * 未注册的 key 返回 undefined（调用方使用 fallback 纯色材质）。
 */
export function generateBlockTexture(blockId: string, face: "top" | "side" | "bottom"): THREE.CanvasTexture | undefined {
  const gen = GENERATORS[`${blockId}:${face}`];
  if (!gen) return undefined;
  const canvas = gen();
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // 体素像素风：禁用平滑
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 生成方块的全部三面纹理；任一面缺失时返回 undefined（整体回退）。 */
export function generateTextureSet(blockId: string): TextureSet | undefined {
  const top = generateBlockTexture(blockId, "top");
  const side = generateBlockTexture(blockId, "side");
  const bottom = generateBlockTexture(blockId, "bottom");
  if (!top || !side || !bottom) return undefined;
  return { top, side, bottom };
}

/** 纹理注册表是否包含指定方块（供测试与诊断）。 */
export function hasTextureSet(blockId: string): boolean {
  return GENERATORS[`${blockId}:top`] !== undefined;
}

/** 纹理注册表是否包含指定方块的指定面（供 V042-013 资产校验，不依赖 DOM）。 */
export function hasFaceTexture(blockId: string, face: "top" | "side" | "bottom"): boolean {
  return GENERATORS[`${blockId}:${face}`] !== undefined;
}

/** 拥有纹理集的全部方块 ID 列表（去重，供测试与诊断）。 */
export const BLOCK_IDS_WITH_TEXTURES: string[] = [...new Set(
  Object.keys(GENERATORS)
    .filter((key) => key.endsWith(":top"))
    .map((key) => key.slice(0, -4))
)];

/** 导出内部常量供测试。 */
export const TEXTURE_SIZE = TEX_SIZE;

/* ---------- 纹理图集（atlas，draw call 优化） ---------- */

/** 图集网格：8×8 个 16px 瓦片 = 128×128 canvas
 * V061-007 运行时实测：31（V0.6 基线）+ 18（9 类电力方块 top/side）= 49 / 64，余量 15。
 * 上限不扩容；双态不进图集。 */
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

export interface BlockAtlas {
  texture: THREE.CanvasTexture;
  /** `${blockId}:${face}` → 瓦片列/行（行 0 在画布顶部） */
  uvMap: Record<string, { col: number; row: number }>;
  cols: number;
  rows: number;
}

/**
 * 将全部方块面纹理烘焙进单张图集。
 * 相同绘制函数共享同一瓦片（darkSoil 被 dirt 三面 + grass bottom 复用等）。
 * V061-007 运行时实测 49 个唯一瓦片，小于 64 格上限；溢出仍直接抛错、不静默扩容。
 * NearestFilter + 关闭 mipmap 避免瓦片间渗色。
 */
export function buildBlockAtlas(): BlockAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * TEX_SIZE;
  canvas.height = ATLAS_ROWS * TEX_SIZE;
  const ctx = canvas.getContext("2d")!;

  const slotByFn = new Map<() => HTMLCanvasElement, { col: number; row: number }>();
  const uvMap: BlockAtlas["uvMap"] = {};
  let next = 0;
  for (const [key, gen] of Object.entries(GENERATORS)) {
    let slot = slotByFn.get(gen);
    if (!slot) {
      if (next >= ATLAS_COLS * ATLAS_ROWS) {
        throw new Error(`Block atlas overflow: more than ${ATLAS_COLS * ATLAS_ROWS} unique tiles`);
      }
      slot = { col: next % ATLAS_COLS, row: Math.floor(next / ATLAS_COLS) };
      slotByFn.set(gen, slot);
      // 绘制一次瓦片到图集
      ctx.drawImage(gen(), slot.col * TEX_SIZE, slot.row * TEX_SIZE);
      next++;
    }
    uvMap[key] = slot;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false; // UV 按画布坐标计算（见 createBlockGeometry）
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, uvMap, cols: ATLAS_COLS, rows: ATLAS_ROWS };
}

/**
 * 为方块生成 UV 已映射到图集的 BoxGeometry 克隆。
 * BoxGeometry 面顺序：px, nx, py(top), ny(bottom), pz, nz；
 * 每面 4 顶点默认 UV 为 (0,1)(1,1)(0,0)(1,0)。
 * flipY=false 时画布 v 向下增长，故 V = (row + (1 - v)) / rows。
 */
export function createBlockGeometry(
  blockId: string,
  atlas: BlockAtlas,
  base: THREE.BoxGeometry
): THREE.BoxGeometry {
  const geometry = base.clone();
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const defaultUV = [
    [0, 1], [1, 1], [0, 0], [1, 0],
  ];
  const faceTiles = ["side", "side", "top", "bottom", "side", "side"];
  for (let face = 0; face < 6; face++) {
    const slot = atlas.uvMap[`${blockId}:${faceTiles[face]}`];
    if (!slot) continue; // 无纹理的块保留默认 UV（走 fallback 材质）
    for (let j = 0; j < 4; j++) {
      const i = face * 4 + j;
      const [u, v] = defaultUV[j];
      uv.setXY(
        i,
        (slot.col + u) / atlas.cols,
        (slot.row + (1 - v)) / atlas.rows
      );
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
