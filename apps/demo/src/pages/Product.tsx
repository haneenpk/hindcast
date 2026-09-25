import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { checkStock } from "../api";
import { addToCart } from "../cart";
import { findProduct, formatPrice, products } from "../products";
import { ProductCard, QtyStepper } from "../ui";

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [stockNote, setStockNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  // "Pairs well with" navigates product → product on the same route, so
  // the per-product state has to reset itself.
  useEffect(() => {
    setQty(1);
    setStockNote(null);
  }, [slug]);

  const product = slug ? findProduct(slug) : undefined;
  if (!product) {
    return (
      <section className="empty-state">
        <h1>We don&apos;t stock that.</h1>
        <Link to="/" className="button">
          Back to the shop
        </Link>
      </section>
    );
  }

  const related = products
    .filter((p) => p.slug !== product.slug)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 3);

  return (
    <>
      <p className="crumb">
        <Link to="/">Shop</Link> / {product.category} / {product.name}
      </p>

      <section className="product-page">
        <div className="product-gallery" style={{ backgroundColor: product.tone }}>
          <img src={product.image} alt={product.name} />
        </div>

        <div className="product-info">
          <div>
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
          </div>
          <p className="price-lg">{formatPrice(product.price)}</p>
          <p className="product-details">{product.details}</p>

          <div className="buy-row">
            <QtyStepper value={qty} onChange={setQty} label="Quantity" />
            <button
              type="button"
              className="button button-block"
              onClick={() => {
                addToCart(product.slug, qty);
                navigate("/cart");
              }}
            >
              Add to cart — {formatPrice(product.price * qty)}
            </button>
          </div>

          <div className="stock-row">
            <button
              type="button"
              className="text-button"
              disabled={checking}
              onClick={() => {
                setChecking(true);
                setStockNote(null);
                checkStock(product.slug)
                  .then((available) =>
                    setStockNote({ text: `${available} in stock`, ok: true }),
                  )
                  .catch(() =>
                    setStockNote({
                      text: "Couldn't check availability — try again in a minute.",
                      ok: false,
                    }),
                  )
                  .finally(() => setChecking(false));
              }}
            >
              {checking ? "Checking…" : "Check availability"}
            </button>
            {stockNote ? (
              <span className={stockNote.ok ? "stock-note ok" : "stock-note"}>
                {stockNote.text}
              </span>
            ) : null}
          </div>

          <dl className="specs">
            {product.specs.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <ul className="assurances">
            <li>Ships in 2–3 weeks, flat-packed</li>
            <li>Free returns within 30 days</li>
            <li>30-year guarantee on the frame</li>
          </ul>
        </div>
      </section>

      <section className="related">
        <h2>Pairs well with</h2>
        <div className="product-grid">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
