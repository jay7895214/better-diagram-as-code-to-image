import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { colorPickerPlugin } from "../extensions/colorPicker";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface EditorProps {
  code: string;
  onChange: (value: string) => void;
  isDarkMode?: boolean;
}

export function Editor({ code, onChange, isDarkMode = false }: EditorProps) {
  const { t } = useTranslation();

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text);
        toast.success(t("editor.paste") + " " + t("export.downloadSuccess").replace("下載成功", "成功").replace("Download successful", "successful").replace("下载成功", "成功"));
      }
    } catch {
      toast.error("Failed to paste from clipboard");
    }
  };

  return (
    <div className="editor-wrapper">
      <div className="editor-scroll-area">
        <CodeMirror
          value={code}
          height="100%"
          theme={isDarkMode ? oneDark : "light"}
          extensions={[colorPickerPlugin]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
        />
      </div>
      <button 
        className="editor-paste-btn"
        onClick={handlePasteClick}
        title={t("editor.paste")}
      >
        <ClipboardPaste size={18} />
      </button>
    </div>
  );
}
