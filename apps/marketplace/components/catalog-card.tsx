interface CatalogCardProps {
  boutique: string;
  href: string;
  imageUrl: string;
  label?: string;
  meta: string;
  title: string;
}

export function CatalogCard({
  boutique,
  href,
  imageUrl,
  label,
  meta,
  title,
}: CatalogCardProps) {
  return (
    <article className="catalog-card">
      <a href={href}>
        <div
          aria-label={title}
          className="catalog-card__image"
          role="img"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          {label && <span className="catalog-badge">{label}</span>}
        </div>
        <div className="catalog-card__copy">
          <p>{boutique}</p>
          <h3>{title}</h3>
          <span>{meta}</span>
        </div>
      </a>
    </article>
  );
}
