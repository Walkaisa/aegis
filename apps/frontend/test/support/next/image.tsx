import type { ImgHTMLAttributes } from "react";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & { src: string; unoptimized?: boolean; priority?: boolean };

/** `next/image` for component tests: the plain image the static export renders as well. */
export default function Image({ unoptimized: _unoptimized, priority: _priority, alt, ...rest }: ImageProps) {
	// biome-ignore lint/performance/noImgElement: stands in for next/image, which renders this element in the static export
	return <img alt={alt} {...rest} />;
}
