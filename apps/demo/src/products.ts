import bookshelf from "./assets/photos/oak-bookshelf.webp";
import chair from "./assets/photos/linen-lounge-chair.webp";
import desk from "./assets/photos/walnut-writing-desk.webp";
import lamp from "./assets/photos/brass-table-lamp.webp";
import pendant from "./assets/photos/rattan-pendant-light.webp";
import tables from "./assets/photos/marble-nesting-tables.webp";
import throwBlanket from "./assets/photos/wool-throw-blanket.webp";
import vase from "./assets/photos/ceramic-table-vase.webp";

export interface Product {
  slug: string;
  name: string;
  price: number;
  category: string;
  image: string;
  /** Background shown behind the photo while it decodes. */
  tone: string;
  blurb: string;
  details: string;
  specs: [label: string, value: string][];
}

export const products: Product[] = [
  {
    slug: "walnut-writing-desk",
    name: "Walnut Writing Desk",
    price: 499,
    category: "Workspace",
    image: desk,
    tone: "#e9e7e3",
    blurb: "A slim desk in solid black walnut.",
    details:
      "Sized for a hallway or a bedroom corner — room for a laptop, a lamp and not much else, on purpose. Solid black walnut on tapered legs, finished in hard-wax oil.",
    specs: [
      ["Dimensions", "110 × 45 × 76 cm"],
      ["Material", "Solid black walnut"],
      ["Finish", "Hard-wax oil"],
    ],
  },
  {
    slug: "brass-table-lamp",
    name: "Brass Table Lamp",
    price: 149,
    category: "Lighting",
    image: lamp,
    tone: "#d9d3cb",
    blurb: "Fluted opal glass on a brushed-brass stem.",
    details:
      "The fluted opal-glass shade softens the bulb into an even, low glow. Brushed-brass stem on a weighted base, inline dimmer, 2700K bulb in the box.",
    specs: [
      ["Height", "42 cm"],
      ["Material", "Brass, opal glass"],
      ["Bulb", "E14, 2700K, included"],
    ],
  },
  {
    slug: "linen-lounge-chair",
    name: "Linen Lounge Chair",
    price: 645,
    category: "Seating",
    image: chair,
    tone: "#ebe7e0",
    blurb: "Solid oak frame, stonewashed linen cushions.",
    details:
      "Low, deep and made for reading. A solid oak frame holds loose seat and back cushions in stonewashed flax linen; the covers zip off for washing.",
    specs: [
      ["Dimensions", "68 × 78 × 80 cm"],
      ["Frame", "Solid white oak"],
      ["Cover", "Stonewashed flax linen"],
    ],
  },
  {
    slug: "oak-bookshelf",
    name: "Oak Bookshelf",
    price: 329,
    category: "Storage",
    image: bookshelf,
    tone: "#e6e3de",
    blurb: "Open shelving in solid white oak.",
    details:
      "Open on every side, so it can stand against a wall or divide a room. Seven fixed shelves rated to 20 kg each, with an anti-tip strap and no visible fasteners.",
    specs: [
      ["Dimensions", "200 × 60 × 30 cm"],
      ["Material", "Solid white oak"],
      ["Load", "20 kg per shelf"],
    ],
  },
  {
    slug: "ceramic-table-vase",
    name: "Ceramic Table Vase",
    price: 58,
    category: "Decor",
    image: vase,
    tone: "#ece8e1",
    blurb: "Wheel-thrown stoneware, matte chalk glaze.",
    details:
      "Thrown by hand, then glazed in a dry, matte chalk white with a raw clay foot. Each one comes out of the kiln a little different — that's the point.",
    specs: [
      ["Height", "32 cm"],
      ["Material", "Stoneware"],
      ["Glaze", "Matte chalk"],
    ],
  },
  {
    slug: "wool-throw-blanket",
    name: "Wool Throw Blanket",
    price: 95,
    category: "Textiles",
    image: throwBlanket,
    tone: "#c9ccd2",
    blurb: "Undyed merino in slate, with a loose fringe.",
    details:
      "Woven from undyed merino lambswool in a soft slate, brushed on both sides and finished with a loose, knotted fringe. Warm without weight.",
    specs: [
      ["Size", "130 × 180 cm"],
      ["Material", "100% merino wool"],
      ["Care", "Cool hand wash"],
    ],
  },
  {
    slug: "rattan-pendant-light",
    name: "Rattan Pendant Light",
    price: 129,
    category: "Lighting",
    image: pendant,
    tone: "#f0ede8",
    blurb: "A hand-woven rattan cylinder, 38 cm.",
    details:
      "Natural rattan woven by hand over a light steel frame. Throws a warm, patterned light across the ceiling; two metres of fabric cord with a ceiling rose.",
    specs: [
      ["Diameter", "38 cm"],
      ["Material", "Natural rattan"],
      ["Cord", "2 m, fabric-wrapped"],
    ],
  },
  {
    slug: "marble-nesting-tables",
    name: "Marble Nesting Tables",
    price: 389,
    category: "Tables",
    image: tables,
    tone: "#e7e7e7",
    blurb: "Honed Carrara on brushed-brass hoops, a pair.",
    details:
      "Two honed Carrara tops on brushed-brass hoop bases. Nest them together in front of the sofa, or split them between the sofa and a chair.",
    specs: [
      ["Diameters", "60 and 45 cm"],
      ["Top", "Honed Carrara marble"],
      ["Base", "Brushed brass"],
    ],
  },
];

export const categories = ["All", ...new Set(products.map((p) => p.category))];

export function findProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-US")}`;
}
