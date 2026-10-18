import { cx } from "./cx";

export function Wizard({ celebrate = false, floating = false }: { celebrate?: boolean; floating?: boolean }) {
  return (
    <img
      src="/art/wizard.png?v=clean"
      alt=""
      className={cx("sprite", "wizard", floating && "wizard-float", celebrate && "celebrate")}
    />
  );
}

export function Mascot({ celebrate = false, floating = false }: { celebrate?: boolean; floating?: boolean }) {
  return (
    <img
      src="/art/mascot.png?v=clean"
      alt=""
      className={cx("sprite", "mascot", floating && "mascot-float", celebrate && "celebrate")}
    />
  );
}
