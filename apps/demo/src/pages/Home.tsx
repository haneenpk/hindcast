import { Link } from "react-router-dom";
import { formatPrice, products } from "../products";

export function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Rooms you actually live in.</h1>
        <p>
          Solid wood, honest joinery, nothing that needs replacing in three
          years. Made in small runs, shipped flat, built to be kept.
        </p>
      </section>

      <section className="product-grid">
        {products.map((product) => (
          <Link
            key={product.slug}
            to={`/products/${product.slug}`}
            className="product-card"
          >
            <span
              className="product-tile"
              style={{ backgroundColor: product.tone }}
            >
              <span className="product-tile-name">{product.name}</span>
            </span>
            <span className="product-meta">
              <span>{product.name}</span>
              <span className="price">{formatPrice(product.price)}</span>
            </span>
            <span className="product-blurb">{product.blurb}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
