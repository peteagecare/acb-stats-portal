declare module "page-flip" {
  export type FlipEvent = { data: number };
  export type SizeType = "fixed" | "stretch";

  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: SizeType;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromImages(images: string[]): void;
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    flipNext(): void;
    flipPrev(): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: "flip", cb: (e: FlipEvent) => void): void;
    on(event: string, cb: (e: { data: unknown }) => void): void;
  }
}
