export interface Product {
  slug: string;
  name: string;
  price: number;
  category: string;
  tone: string;
  blurb: string;
  details: string;
}

export const products: Product[] = [
  {
    slug: "walnut-writing-desk",
    name: "Walnut Writing Desk",
    price: 499,
    category: "Desks",
    tone: "#8a5a3b",
    blurb: "Solid black walnut with two soft-close drawers.",
    details:
      "140 × 70 cm, 76 cm tall. Solid black walnut top with a cable grommet, dovetailed drawers, hard-wax oil finish. Ships flat; assembles with eight bolts.",
  },
  {
    slug: "brass-task-lamp",
    name: "Brass Task Lamp",
    price: 89,
    category: "Lighting",
    tone: "#a98146",
    blurb: "Machined brass, double-jointed arm, warm 2700K bulb included.",
    details:
      "Solid machined brass with a weighted steel base. Double-jointed arm holds any angle. Inline dimmer, E14 socket, 2700K filament bulb in the box.",
  },
  {
    slug: "linen-lounge-chair",
    name: "Linen Lounge Chair",
    price: 645,
    category: "Seating",
    tone: "#9b9273",
    blurb: "Kiln-dried beech frame in stonewashed flax linen.",
    details:
      "Kiln-dried beech frame, sinuous-spring seat, high-resilience foam wrapped in feather. Stonewashed Belgian flax; the cover zips off for cleaning.",
  },
  {
    slug: "oak-bookshelf",
    name: "Oak Bookshelf",
    price: 329,
    category: "Storage",
    tone: "#b08d5f",
    blurb: "Five fixed shelves in quartersawn white oak.",
    details:
      "180 × 80 × 30 cm. Quartersawn white oak, five fixed shelves rated to 25 kg each, anti-tip wall strap included. No visible fasteners.",
  },
  {
    slug: "ceramic-table-vase",
    name: "Ceramic Table Vase",
    price: 38,
    category: "Decor",
    tone: "#7d8a8c",
    blurb: "Wheel-thrown stoneware in a matte glacier glaze.",
    details:
      "Wheel-thrown stoneware, 22 cm tall, matte glacier glaze with a raw clay foot. Each one comes out of the kiln slightly different — that's the point.",
  },
  {
    slug: "wool-throw-blanket",
    name: "Wool Throw Blanket",
    price: 75,
    category: "Textiles",
    tone: "#8d6b6b",
    blurb: "Undyed merino, brushed both sides, 130 × 180 cm.",
    details:
      "100% undyed merino lambswool, brushed on both sides, twisted fringe. 130 × 180 cm, 640 g. Dry clean or a careful hand wash.",
  },
  {
    slug: "rattan-pendant-light",
    name: "Rattan Pendant Light",
    price: 129,
    category: "Lighting",
    tone: "#b59a68",
    blurb: "Hand-woven rattan shade, 45 cm, fabric-wrapped cord.",
    details:
      "Hand-woven natural rattan on a steel ring, 45 cm across. Two-metre fabric-wrapped cord with a ceiling rose. Throws a patterned, unhurried light.",
  },
  {
    slug: "marble-side-table",
    name: "Marble Side Table",
    price: 259,
    category: "Tables",
    tone: "#8f8f95",
    blurb: "Honed Carrara top on a blackened steel base.",
    details:
      "45 cm round honed Carrara marble on a powder-coated steel tripod. 52 cm tall. Every top is cut from a different slab, so the veining is yours alone.",
  },
];

export function findProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function formatPrice(price: number): string {
  return `$${price}`;
}
