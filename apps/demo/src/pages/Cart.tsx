import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { getCart, removeFromCart, setQty, subscribe } from "../cart";
import { findProduct, formatPrice } from "../products";
import { QtyStepper } from "../ui";

export const FREE_DELIVERY_FROM = 300;
export const DELIVERY_FEE = 25;

export function CartPage() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const lines = cart.flatMap((line) => {
    const product = findProduct(line.slug);
    return product ? [{ line, product }] : [];
  });

  const subtotal = lines.reduce((sum, { line, product }) => sum + line.qty * product.price, 0);
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;

  if (lines.length === 0) {
    return (
      <section className="empty-state">
        <p className="eyebrow">Your cart</p>
        <h1>Nothing in here yet.</h1>
        <p className="muted">Everything in the shop is made to order in small runs.</p>
        <Link to="/" className="button">
          Browse the collection
        </Link>
      </section>
    );
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Your cart</p>
        <h1>{lines.length === 1 ? "One piece" : `${lines.length} pieces`}, nearly home.</h1>
      </header>

      <div className="cart-layout">
        <ul className="cart-list">
          {lines.map(({ line, product }) => (
            <li key={line.slug} className="cart-line">
              <Link
                to={`/products/${line.slug}`}
                className="cart-thumb"
                style={{ backgroundColor: product.tone }}
              >
                <img src={product.image} alt={product.name} />
              </Link>
              <div className="cart-line-body">
                <div>
                  <Link to={`/products/${line.slug}`} className="cart-line-name">
                    {product.name}
                  </Link>
                  <p className="eyebrow">{product.category}</p>
                </div>
                <QtyStepper
                  small
                  value={line.qty}
                  min={1}
                  onChange={(next) => setQty(line.slug, next)}
                  label={`Quantity of ${product.name}`}
                />
              </div>
              <div className="cart-line-end">
                <span className="price">{formatPrice(product.price * line.qty)}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeFromCart(line.slug)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <h2>Summary</h2>
          <div className="summary-row">
            <span className="muted">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span className="muted">Delivery</span>
            <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(subtotal + delivery)}</span>
          </div>
          <Link to="/checkout" className="button button-block">
            Check out
          </Link>
          <p className="summary-note">Taxes included · 30-day returns</p>
        </aside>
      </div>
    </>
  );
}
