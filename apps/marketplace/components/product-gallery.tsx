"use client";
import Image from "next/image";
import { useState } from "react";

export function ProductGallery({
  primary,
  images,
  title,
  mobileImage,
}: {
  primary: string;
  images: string[];
  title: string;
  mobileImage?: string;
}) {
  const [selected, setSelected] = useState(primary);
  const all = images.filter((x) => x !== primary);
  return (
    <section className="design-gallery" aria-label="Design image gallery">
      <div className="design-gallery__primary">
        <Image
          src={selected}
          alt={title}
          fill
          priority
          sizes="(max-width:760px) 100vw, 58vw"
          unoptimized
          className={
            mobileImage && selected === primary ? "desktop-product-image" : ""
          }
        />
        {mobileImage && selected === primary && (
          <Image
            src={mobileImage}
            alt={title}
            fill
            priority
            sizes="100vw"
            className="mobile-product-image"
            unoptimized
          />
        )}
        <span className="catalog-badge">Handmade</span>
      </div>
      {images.length > 0 && (
        <div className="design-gallery__thumbs">
          {all.map((src, index) => (
            <button
              aria-label={`View detail ${index + 1}`}
              aria-pressed={selected === src}
              onClick={() => setSelected(src)}
              key={src}
            >
              <Image
                src={src}
                alt={`${title}, detail ${index + 1}`}
                fill
                sizes="(max-width:760px) 30vw, 19vw"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
      {selected !== primary && (
        <button className="gallery-reset" onClick={() => setSelected(primary)}>
          Return to full design
        </button>
      )}
    </section>
  );
}
