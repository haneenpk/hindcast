import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { checkStock } from "../api";
import { addToCart } from "../cart";
import { findProduct, formatPrice } from "../products";

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [stockNote, setStockNote] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const product = slug ? findProduct(slug) : undefined;
  if (!product) {
    return (
      <section className="page">
        <h1>We don&apos;t stock that.</h1>
        <p>
          <Link to="/">Back to the shop</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="product-page">
      <div
        className="product-hero"
        style={{ backgroundColor: product.tone }}
        aria-hidden
      >
        <span>{product.name}</span>
      </div>

      <div className="product-info">
        <p className="crumb">
          <Link to="/">Shop</Link> / {product.category}
        </p>
        <h1>{product.name}</h1>
        <p className="price-lg">{formatPrice(product.price)}</p>
        <p>{product.details}</p>

        <div className="buy-row">
          <label>
            Qty
            <input
              type="number"
              min={1}
              max={9}
              value={qty}
              onChange={(event) =>
                setQty(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </label>
          <button
            className="button-primary"
            onClick={() => {
              addToCart(product.slug, qty);
              navigate("/cart");
            }}
          >
            Add to cart
          </button>
        </div>

        <div className="stock-row">
          <button
            className="button-quiet"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              setStockNote(null);
              checkStock(product.slug)
                .then((available) => setStockNote(`${available} in stock`))
                .catch(() =>
                  setStockNote(
                    "Couldn't check availability — try again in a minute.",
                  ),
                )
                .finally(() => setChecking(false));
            }}
          >
            {checking ? "Checking…" : "Check availability"}
          </button>
          {stockNote ? <span className="stock-note">{stockNote}</span> : null}
        </div>
      </div>
    </section>
  );
}
