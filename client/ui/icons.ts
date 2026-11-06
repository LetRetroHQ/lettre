// Icons as files: client/ui/icons/*.svg, each a complete, viewable SVG that the build imports
// as text and the editor serves inline, so an icon can be opened, previewed, and diffed as
// the drawing it is. One registry, one renderer; the sidebar's static sprite in index.html
// is separate because it paints before any script runs.

import infoFilled from "@phosphor-icons/core/assets/fill/info-fill.svg";
import article from "@phosphor-icons/core/assets/regular/article.svg";
import book from "@phosphor-icons/core/assets/regular/book-open.svg";
import check from "@phosphor-icons/core/assets/regular/check.svg";
import circleCheck from "@phosphor-icons/core/assets/regular/check-circle.svg";
import code from "@phosphor-icons/core/assets/regular/code.svg";
import copyout from "@phosphor-icons/core/assets/regular/copy.svg";
import desktop from "@phosphor-icons/core/assets/regular/desktop.svg";
import phone from "@phosphor-icons/core/assets/regular/device-mobile.svg";
import mail from "@phosphor-icons/core/assets/regular/envelope-simple.svg";
import preview from "@phosphor-icons/core/assets/regular/eye.svg";
import settings from "@phosphor-icons/core/assets/regular/gear-six.svg";
import branch from "@phosphor-icons/core/assets/regular/git-branch.svg";
import info from "@phosphor-icons/core/assets/regular/info.svg";
import link from "@phosphor-icons/core/assets/regular/link.svg";
import lines from "@phosphor-icons/core/assets/regular/list.svg";
import ul from "@phosphor-icons/core/assets/regular/list-bullets.svg";
import ol from "@phosphor-icons/core/assets/regular/list-numbers.svg";
import readonly from "@phosphor-icons/core/assets/regular/lock-key.svg";
import search from "@phosphor-icons/core/assets/regular/magnifying-glass.svg";
import circleMinus from "@phosphor-icons/core/assets/regular/minus-circle.svg";
import send from "@phosphor-icons/core/assets/regular/paper-plane-tilt.svg";
import paperclip from "@phosphor-icons/core/assets/regular/paperclip.svg";
import editable from "@phosphor-icons/core/assets/regular/pencil-simple.svg";
import plus from "@phosphor-icons/core/assets/regular/plus.svg";
import quote from "@phosphor-icons/core/assets/regular/quotes.svg";
import bold from "@phosphor-icons/core/assets/regular/text-b.svg";
import heading from "@phosphor-icons/core/assets/regular/text-h.svg";
import indent from "@phosphor-icons/core/assets/regular/text-indent.svg";
import italic from "@phosphor-icons/core/assets/regular/text-italic.svg";
import upload from "@phosphor-icons/core/assets/regular/upload-simple.svg";
import x from "@phosphor-icons/core/assets/regular/x.svg";
import lettre from "../../public/lettre-icon.svg";
import { type Html, unsafeHtml } from "./html";

const lettreIcon = unsafeHtml(
  lettre
    .replaceAll('="black"', '="currentColor"')
    .replace(
      'xmlns="http://www.w3.org/2000/svg"',
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"',
    ),
);

const decorative = (svg: string) =>
  unsafeHtml(
    svg.replace(
      'xmlns="http://www.w3.org/2000/svg"',
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"',
    ),
  );

// The files are trusted icon drawings, so vouching for them here is the one place icons
// become markup; every other use goes through icon().
const ICONS = {
  article: decorative(article),
  bold: decorative(bold),
  check: decorative(check),
  code: decorative(code),
  copyout: decorative(copyout),
  editable: decorative(editable),
  heading: decorative(heading),
  indent: decorative(indent),
  info: decorative(info),
  "info-filled": decorative(infoFilled),
  italic: decorative(italic),
  lettre: lettreIcon,
  letretro: lettreIcon,
  lines: decorative(lines),
  link: decorative(link),
  ol: decorative(ol),
  paperclip: decorative(paperclip),
  plus: decorative(plus),
  preview: decorative(preview),
  quote: decorative(quote),
  readonly: decorative(readonly),
  search: decorative(search),
  send: decorative(send),
  settings: decorative(settings),
  ul: decorative(ul),
  upload: decorative(upload),
  book: decorative(book),
  branch: decorative(branch),
  "circle-check": decorative(circleCheck),
  "circle-minus": decorative(circleMinus),
  desktop: decorative(desktop),
  mail: decorative(mail),
  phone: decorative(phone),
  x: decorative(x),
} as const;

export type IconName = keyof typeof ICONS;

/** Whether a string names an icon; for call sites that pick one by a runtime key. */
export function isIconName(name: string): name is IconName {
  return Object.hasOwn(ICONS, name);
}

/** The inline markup of an icon, decorative (aria-hidden) and sized by its container. */
export function icon(name: IconName): Html {
  return ICONS[name];
}
