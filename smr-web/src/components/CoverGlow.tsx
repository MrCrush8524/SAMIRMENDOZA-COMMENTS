interface CoverGlowProps {
  coverUrl?: string | null;
  alt?: string;
}

/**
 * The book cover on Now Playing, sitting on a soft dim cobalt bloom that radiates from behind
 * it -- a large blurred radial glow underneath a smaller sharp cover image, matching the locked
 * design across both the Android and web builds.
 */
export function CoverGlow({ coverUrl, alt }: CoverGlowProps) {
  return (
    <div className="cover-glow">
      <div className="cover-glow__bloom" />
      <div className="cover-glow__frame">
        {coverUrl ? (
          <img src={coverUrl} alt={alt ?? ""} />
        ) : (
          <div className="cover-glow__placeholder" />
        )}
      </div>
    </div>
  );
}
