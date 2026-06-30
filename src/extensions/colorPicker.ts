import { ViewPlugin, DecorationSet, Decoration, WidgetType, EditorView, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// 匹配 3, 4, 6, 8 碼的 Hex 色碼
const colorRegex = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

interface ColorPickerWrapper extends HTMLSpanElement {
  _colorPickerFrom?: number;
  _colorPickerTo?: number;
}

class ColorPickerWidget extends WidgetType {
  constructor(readonly color: string, readonly from: number, readonly to: number) {
    super();
  }

  eq(other: ColorPickerWidget) {
    return other.color === this.color && other.from === this.from && other.to === this.to;
  }

  updateDOM(dom: HTMLElement) {
    dom.style.backgroundColor = this.color;
    const input = dom.querySelector("input");
    if (input) {
      input.value = expandHex(this.color);
    }
    const wrapper = dom as ColorPickerWrapper;
    wrapper._colorPickerFrom = this.from;
    wrapper._colorPickerTo = this.to;
    return true;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("span") as ColorPickerWrapper;
    wrap._colorPickerFrom = this.from;
    wrap._colorPickerTo = this.to;
    
    wrap.className = "cm-color-picker-wrapper";
    wrap.style.display = "inline-block";
    wrap.style.width = "14px";
    wrap.style.height = "14px";
    wrap.style.borderRadius = "4px";
    wrap.style.overflow = "hidden";
    wrap.style.marginLeft = "4px";
    wrap.style.marginRight = "4px";
    wrap.style.verticalAlign = "middle";
    wrap.style.transform = "translateY(-1px)";
    wrap.style.border = "1px solid rgba(128, 128, 128, 0.3)";
    wrap.style.position = "relative";
    
    // 設定背景色為解析到的顏色 (支援透明度展示)
    wrap.style.backgroundColor = this.color;

    const input = document.createElement("input");
    input.type = "color";
    // 原生 input type="color" 僅支援 #RRGGBB 六碼格式
    input.value = expandHex(this.color);
    
    input.className = "cm-color-picker-input";
    input.style.opacity = "0"; // 將 input 變透明，讓它覆蓋在 wrap 元素上
    input.style.width = "100%";
    input.style.height = "100%";
    input.style.cursor = "pointer";
    input.style.position = "absolute";
    input.style.top = "0";
    input.style.left = "0";
    input.style.padding = "0";
    input.style.margin = "0";
    input.style.border = "none";

    // 當使用者在原生選色器中挑選顏色時，即時更新 Editor 中的文字
    input.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      view.dispatch({
        changes: { from: wrap._colorPickerFrom!, to: wrap._colorPickerTo!, insert: target.value }
      });
    });

    wrap.appendChild(input);
    return wrap;
  }
}

// 將 3 碼 / 4 碼 / 8 碼 Hex 轉換成 6 碼，以符合 input type="color" 要求
function expandHex(hex: string) {
  if (hex.length === 4 || hex.length === 5) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex.slice(0, 7); // 取前 7 碼 (#RRGGBB)
}

function buildDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match;
    while ((match = colorRegex.exec(text))) {
      const start = from + match.index;
      const end = start + match[0].length;
      const widget = Decoration.widget({
        widget: new ColorPickerWidget(match[0], start, end),
        side: 1 // 將 Widget 放在色碼文字的右邊
      });
      builder.add(end, end, widget);
    }
  }
  return builder.finish();
}

export const colorPickerPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: v => v.decorations
  }
);
