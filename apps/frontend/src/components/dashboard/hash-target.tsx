"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** How long the target of a link is kept in view while its page is still loading. */
const SETTLE_MS = 3000;

/** Anything the reader does to scroll on their own ends the following. */
const READER_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Keeps the target of a `/page#section` link in view. Pages load their data after the first render,
 * so the router scrolls while the page is still short, and content that loads above the target
 * pushes it out of view again. Until the page settles or the reader scrolls, the target is aligned
 * again whenever the page changes its height.
 */
export function HashTarget() {
	// A new page starts over, with the fragment it was opened with.
	return <FollowHash key={usePathname()} />;
}

function FollowHash() {
	useEffect(() => {
		const id = decodeURIComponent(window.location.hash.slice(1));
		if (!id) {
			return;
		}

		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
		});

		const stop = () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			window.clearTimeout(timer);
			for (const event of READER_EVENTS) {
				window.removeEventListener(event, stop);
			}
		};

		const timer = window.setTimeout(stop, SETTLE_MS);
		for (const event of READER_EVENTS) {
			window.addEventListener(event, stop, { passive: true });
		}
		observer.observe(document.body);
		return stop;
	}, []);

	return null;
}
