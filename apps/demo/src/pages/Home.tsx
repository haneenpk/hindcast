import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import hero from "../assets/photos/hero-living-room.webp";
import { categories, products } from "../products";
import { ProductCard } from "../ui";

const VALUES = [
  {
    title: "Solid wood, never veneer",
    body: "Every surface you touch is the same timber all the way through — so a scratch sands out instead of showing chipboard.",
  },
  {
    title: "Made in runs of forty",
    body: "Small batches from two workshops we visit every season. When a run sells out, the next one takes about six weeks.",
  },
  {
    title: "Joinery that outlives us",
    body: "Dovetails, mortise and tenon, no glue-and-staple shortcuts. Everything carries a thirty-year guarantee on the frame.",
  },
];

export function HomePage() {
  const [category, setCategory] = useState("All");
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  const shown =
    category === "All" ? products : products.filter((p) => p.category === category);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Autumn collection · 2026</p>
          <h1>
            Rooms you
            <br />
            actually <em>live</em> in.
          </h1>
          <p className="hero-lede">
            Solid wood, honest joinery and nothing that needs replacing in three
            years. Made in small runs, shipped flat, built to be kept.
          </p>
          <div className="hero-actions">
            <a href="#collection" className="button">
              Shop the collection
            </a>
            <a href="#studio" className="link-arrow">
              How we make it →
            </a>
          </div>
        </div>
        <div className="hero-media">
          <img src={hero} alt="A calm living room with a linen sofa and an olive tree" />
        </div>
      </section>

      <section className="promises" aria-label="Our promises">
        <ul>
          <li>Free delivery over $300</li>
          <li>30-day returns, collected from your door</li>
          <li>30-year guarantee on every frame</li>
        </ul>
      </section>

      <section className="collection" id="collection">
        <div className="section-head">
          <h2>
            The collection
            <small>{shown.length} pieces</small>
          </h2>
          <div className="chips" role="group" aria-label="Filter by category">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="product-grid">
          {shown.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      <section className="studio" id="studio">
        <h2 className="studio-quote">
          We make fewer things, and make them <em>to be kept.</em>
        </h2>
        <div className="values">
          {VALUES.map((value, i) => (
            <div key={value.title} className="value">
              <span className="value-index">0{i + 1}</span>
              <div>
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
