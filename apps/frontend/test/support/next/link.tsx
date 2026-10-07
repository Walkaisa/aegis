import { type AnchorHTMLAttributes, forwardRef, type MouseEvent } from "react";
import { router } from "./navigation";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean | null; scroll?: boolean };

/** `next/link` for component tests: a plain anchor whose clicks navigate through the test router. */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, prefetch: _prefetch, scroll: _scroll, onClick, ...rest }, ref) {
	const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (!event.defaultPrevented) {
			event.preventDefault();
			router.push(href);
		}
	};
	return <a ref={ref} href={href} onClick={handleClick} {...rest} />;
});

export default Link;
