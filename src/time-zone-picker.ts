import type { Language } from "./model";

const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
let serial = 0;

export function zoneField(
  label: string,
  field: string,
  value: string,
  language: Language,
): string {
  const id = `zone-${++serial}`;
  const openLabel = language === "zh" ? "展开时区列表" : "Open time zones";
  return `<div class="zone-picker"><label for="${id}">${escape(label)}</label><div class="zone-control"><input id="${id}" data-field="${field}" data-zone-input type="text" value="${escape(value)}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" aria-haspopup="listbox"><button type="button" data-zone-toggle tabindex="-1" aria-label="${openLabel}"><span aria-hidden="true">⌄</span></button></div><div id="${id}-list" class="zone-options" role="listbox" aria-label="${escape(label)}" hidden></div></div>`;
}

interface OpenPicker {
  input: HTMLInputElement;
  list: HTMLElement;
  values: string[];
  active: number;
}

export function bindTimeZonePicker(root: HTMLElement): () => void {
  let current: OpenPicker | null = null;
  let committing = false;
  const close = () => {
    if (!current) return;
    current.input.setAttribute("aria-expanded", "false");
    current.input.removeAttribute("aria-activedescendant");
    current.list.hidden = true;
    current = null;
  };
  const highlight = (index: number) => {
    if (!current) return;
    const previous = current.list.children[current.active];
    previous?.setAttribute("aria-selected", "false");
    current.active = index;
    const option = current.list.children[index] as HTMLElement | undefined;
    if (!option) {
      current.input.removeAttribute("aria-activedescendant");
      return;
    }
    option.setAttribute("aria-selected", "true");
    current.input.setAttribute("aria-activedescendant", option.id);
    const top = option.offsetTop,
      bottom = top + option.offsetHeight;
    if (top < current.list.scrollTop) current.list.scrollTop = top;
    else if (bottom > current.list.scrollTop + current.list.clientHeight)
      current.list.scrollTop = bottom - current.list.clientHeight;
  };
  const open = (input: HTMLInputElement, filter: boolean) => {
    close();
    const list = input
      .closest(".zone-picker")!
      .querySelector<HTMLElement>(".zone-options")!;
    const query = input.value.trim().toLowerCase().replaceAll("_", " ");
    const values = filter
      ? zones.filter((zone) =>
          zone.toLowerCase().replaceAll("_", " ").includes(query),
        )
      : zones;
    list.innerHTML = values.length
      ? values
          .map(
            (zone, index) =>
              `<button type="button" role="option" id="${input.id}-option-${index}" data-zone-choice="${escape(zone)}" tabindex="-1" aria-selected="false">${escape(zone)}</button>`,
          )
          .join("")
      : `<span class="zone-empty">${document.documentElement.lang.startsWith("zh") ? "没有匹配时区" : "No matching time zones"}</span>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    current = { input, list, values, active: -1 };
    if (!filter) highlight(values.indexOf(input.value.trim()));
  };
  const choose = (zone: string) => {
    if (!current) return;
    const input = current.input;
    input.value = zone;
    close();
    input.focus({ preventScroll: true });
    // Use the same input event as typed edits, without reopening this popup.
    committing = true;
    try {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } finally {
      committing = false;
    }
  };
  root.addEventListener("pointerdown", (event) => {
    if (
      (event.target as Element).closest(
        "[data-zone-toggle], [data-zone-choice]",
      )
    )
      event.preventDefault();
  });
  root.addEventListener("click", (event) => {
    const target = event.target as Element;
    const toggle = target.closest("[data-zone-toggle]");
    if (toggle) {
      const input = toggle
        .closest(".zone-picker")!
        .querySelector<HTMLInputElement>("[data-zone-input]")!;
      if (current?.input === input) {
        close();
        return;
      }
      open(input, false);
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    const choice = target.closest<HTMLElement>("[data-zone-choice]");
    if (choice && current) choose(choice.dataset.zoneChoice!);
  });
  root.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (!committing && input.hasAttribute("data-zone-input")) open(input, true);
  });
  root.addEventListener("keydown", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.hasAttribute("data-zone-input")) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape" && current) event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!current || current.input !== input) {
        open(input, false);
        return;
      }
      if (!current.values.length) return;
      const next =
        event.key === "ArrowDown" ? current.active + 1 : current.active - 1;
      highlight(Math.max(0, Math.min(current.values.length - 1, next)));
    } else if (
      event.key === "Enter" &&
      current?.input === input &&
      current.active >= 0
    ) {
      event.preventDefault();
      choose(current.values[current.active]);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (
      current &&
      !current.input.closest(".zone-picker")!.contains(event.target as Node)
    )
      close();
  });
  root.addEventListener("focusout", (event) => {
    if (
      current &&
      !current.input
        .closest(".zone-picker")!
        .contains(event.relatedTarget as Node | null)
    )
      close();
  });
  return close;
}
