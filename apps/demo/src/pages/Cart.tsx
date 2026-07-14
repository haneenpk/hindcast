import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { getCart, removeFromCart, setQty, subscribe } from "../cart";
import { findProduct, formatPrice } from "../products";

export function CartPage() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const lines = cart
    .map((line) => ({ line, product: findProduct(line.slug) }))
    .filter((entry) => entry.product !== undefined);

  const total = lines.reduce(
    (sum, { line, product }) => sum + line.qty * (product?.price ?? 0),
    0,
  );

  if (lines.length === 0) {
    return (
      <section className="page">
        <h1>Your cart is empty.</h1>
        <p>
          <Link to="/">Back to the shop</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Cart</h1>
      <ul className="cart-list">
        {lines.map(({ line, product }) => (
          <li key={line.slug} className="cart-line">
            <span
              className="cart-swatch"
              style={{ backgroundColor: product?.tone }}
              aria-hidden
            />
            <span className="cart-name">
              <Link to={`/products/${line.slug}`}>{product?.name}</Link>
            </span>
            <input
              type="number"
              min={0}
              max={9}
              value={line.qty}
              aria-label={`Quantity of ${product?.name}`}
              onChange={(event) =>
                setQty(line.slug, Number(event.target.value) || 0)
              }
            />
            <span className="cart-price">
              {formatPrice((product?.price ?? 0) * line.qty)}
            </span>
            <button
              className="button-quiet"
              onClick={() => removeFromCart(line.slug)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="cart-total">
        <span>Total</span>
        <span className="price-lg">{formatPrice(total)}</span>
      </div>
      <Link to="/checkout" className="button-primary checkout-link">
        Check out
      </Link>
    </section>
  );
}
