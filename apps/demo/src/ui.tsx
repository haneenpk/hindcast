import { Link } from "react-router-dom";
import { formatPrice, type Product } from "./products";

// A stepper rather than <input type="number">: the recorder masks every
// input, so a number field would replay as "*". Quantity isn't private —
// keeping it out of an input keeps it readable in the replay.
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 9,
  label,
  small = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label: string;
  small?: boolean;
}) {
  return (
    <div
      className={small ? "stepper stepper-sm" : "stepper"}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.slug}`} className="product-card">
      <div className="product-media" style={{ backgroundColor: product.tone }}>
        <img src={product.image} alt={product.name} loading="eager" />
      </div>
      <div className="product-caption">
        <div className="product-caption-row">
          <span className="product-name">{product.name}</span>
          <span className="price">{formatPrice(product.price)}</span>
        </div>
        <span className="eyebrow">{product.category}</span>
      </div>
    </Link>
  );
}
